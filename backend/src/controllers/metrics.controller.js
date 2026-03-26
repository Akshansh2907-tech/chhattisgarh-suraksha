import EnvironmentalDataService from '../services/environmental-data.service.js';
import EnvironmentalMetrics from '../models/environmental-metrics.js';
import { query } from '../config/database.js';

export const getCurrentMetrics = async (req, res, next) => {
  try {
    console.log('\n📊 GET /api/metrics/current');
    console.log('──────────────────────────────────');
    console.log('⏱️  Time:', new Date().toISOString());

    // Check if mock data is requested
    if (req.query._mock === 'true') {
      console.log('⚠️  Using mock data (requested via query parameter)');
      res.locals.isMockData = true;
      return res.status(200).json({
        success: true,
        data: {
          air_quality: 75,
          temperature: 32,
          humidity: 65,
          noise_level: 60,
          last_updated: new Date().toISOString(),
          _mock: true
        }
      });
    }

    // Get latest metrics
    console.log('🔍 Checking database for latest metrics...');
    let metrics = await EnvironmentalMetrics.getLatestMetrics();

    // If no metrics exist or data is older than 30 minutes, fetch new data
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (!metrics || new Date(metrics.last_updated) < thirtyMinutesAgo) {
      console.log('⚠️  Metrics are outdated or missing, fetching new data...');
      console.log('📍 Location: Raipur (21.2514, 81.6296)');
      try {
        metrics = await EnvironmentalDataService.updateRealTimeMetrics();
        console.log('✅ New metrics fetched successfully');
      } catch (fetchErr) {
        console.error('⚠️ Failed to update real-time metrics from external APIs:', fetchErr?.message || fetchErr);
        // Attempt to return the last-known metrics from DB instead of failing hard
        try {
          // Try to return the last-known joined metrics first
          let fallback = await EnvironmentalMetrics.getLatestMetrics();
          if (fallback) {
            console.log('ℹ️ Returning last-known metrics from DB as fallback');
            metrics = fallback;
          } else {
            // If no real_time_metrics row exists, try best-effort: return latest air and latest weather separately
            console.log('ℹ️ No real_time_metrics row found; attempting best-effort merge of latest air and weather rows');
            const latestAir = await query(`SELECT * FROM air_quality_metrics WHERE location_id = $1 ORDER BY timestamp DESC LIMIT 1`, [1]);
            const latestWeather = await query(`SELECT * FROM weather_metrics WHERE location_id = $1 ORDER BY timestamp DESC LIMIT 1`, [1]);

            const airRow = latestAir.rows[0] || null;
            const weatherRow = latestWeather.rows[0] || null;

            if (airRow || weatherRow) {
              // Build a combined metrics object similar to what getLatestMetrics would return
              metrics = {
                last_updated: (airRow?.timestamp || weatherRow?.timestamp) || new Date().toISOString(),
                aqi: airRow?.aqi ?? null,
                pm25: airRow?.pm25 ?? null,
                pm10: airRow?.pm10 ?? null,
                no2: airRow?.no2 ?? null,
                so2: airRow?.so2 ?? null,
                o3: airRow?.o3 ?? null,
                co: airRow?.co ?? null,
                temperature: weatherRow?.temperature ?? null,
                humidity: weatherRow?.humidity ?? null,
                wind_speed: weatherRow?.wind_speed ?? null,
                wind_direction: weatherRow?.wind_direction ?? null,
                precipitation: weatherRow?.precipitation ?? null,
                pressure: weatherRow?.pressure ?? null,
                alerts: []
              };
              console.log('ℹ️ Returning combined latest air/weather metrics as fallback');
            } else {
              // Re-throw original error so middleware handles it (no metrics available)
              throw fetchErr;
            }
          }
        } catch (fallbackErr) {
          console.error('❌ Fallback to DB metrics also failed:', fallbackErr?.message || fallbackErr);
          throw fetchErr; // preserve original intent
        }
      }
    } else {
      console.log('✅ Using cached metrics from database');
    }

    console.log('📈 Current Metrics:', JSON.stringify(metrics, null, 2));
    console.log('──────────────────────────────────\n');

    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('❌ Error in getCurrentMetrics:', error);
    next(error);
  }
};

export const getActiveAlerts = async (req, res, next) => {
  try {
    // Check if mock data is requested
    if (req.query._mock === 'true') {
      res.locals.isMockData = true;
      return res.status(200).json({
        success: true,
        data: [
          {
            id: 'mock-1',
            type: 'air_quality',
            severity: 'high',
            message: 'High air pollution levels detected',
            created_at: new Date().toISOString(),
            _mock: true
          }
        ]
      });
    }

    const rawAlerts = await EnvironmentalMetrics.getActiveAlerts();

    // Normalize alerts to a frontend-friendly shape
    const alerts = rawAlerts.map(a => {
      let details = a.details;
      try {
        if (typeof details === 'string') details = JSON.parse(details);
      } catch (e) {
        // leave as-is if parsing fails
      }

      return {
        id: a.id,
        type: a.type || 'general',
        severity: a.severity || 'low',
        title: a.message ? `${(a.type || 'Alert').toUpperCase()}` : 'Alert',
        message: a.message || (details?.message || 'Important update'),
        details,
        timestamp: a.timestamp || a.created_at || new Date().toISOString(),
        location: a.location_id ? 'Raipur' : 'Unknown'
      };
    });

    res.status(200).json({
      success: true,
      data: alerts
    });
  } catch (error) {
    next(error);
  }
};

export const getMetricsHistory = async (req, res, next) => {
  try {
    const { type, duration = '24', _mock } = req.query;

    // Check if mock data is requested
    if (_mock === 'true') {
      res.locals.isMockData = true;
      return res.status(200).json({
        success: true,
        data: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
          value: Math.floor(Math.random() * 100),
          type: type || 'air_quality',
          _mock: true
        }))
      });
    }

    // Get historical data - support weather, air_quality and combined 'all'
    const durationHours = parseInt(duration);

    if (type === 'weather') {
      // For weather metrics
      const result = await query(`
        SELECT
          wm.timestamp as timestamp,
          wm.temperature,
          wm.humidity,
          wm.wind_speed,
          wm.wind_direction
        FROM weather_metrics wm
        WHERE wm.timestamp > NOW() - INTERVAL '${durationHours} hours'
        ORDER BY wm.timestamp ASC
      `);

      return res.status(200).json({ success: true, data: result.rows });
    }

    if (type === 'all') {
      // Aggregate metrics by hour to align air quality and weather measurements
      const result = await query(`
        SELECT
          DATE_TRUNC('hour', COALESCE(a.timestamp, w.timestamp)) AT TIME ZONE 'UTC' AS timestamp,
          AVG(a.aqi)      FILTER (WHERE a.aqi IS NOT NULL)     AS aqi,
          AVG(a.pm25)     FILTER (WHERE a.pm25 IS NOT NULL)    AS pm25,
          AVG(a.pm10)     FILTER (WHERE a.pm10 IS NOT NULL)    AS pm10,
          AVG(w.temperature) FILTER (WHERE w.temperature IS NOT NULL) AS temperature,
          AVG(w.humidity)    FILTER (WHERE w.humidity IS NOT NULL)    AS humidity
        FROM air_quality_metrics a
        FULL OUTER JOIN weather_metrics w
          ON DATE_TRUNC('hour', a.timestamp) = DATE_TRUNC('hour', w.timestamp)
        WHERE COALESCE(a.timestamp, w.timestamp) > NOW() - INTERVAL '${durationHours} hours'
        GROUP BY DATE_TRUNC('hour', COALESCE(a.timestamp, w.timestamp))
        ORDER BY timestamp ASC
      `);

      // Normalize returned rows: timestamp should be ISO string and numeric fields as numbers
      const normalized = result.rows.map(r => ({
        timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : null,
        aqi: r.aqi != null ? Math.round(Number(r.aqi)) : null,
        pm25: r.pm25 != null ? Number(r.pm25) : null,
        pm10: r.pm10 != null ? Number(r.pm10) : null,
        temperature: r.temperature != null ? Number(r.temperature) : null,
        humidity: r.humidity != null ? Number(r.humidity) : null
      }));

      return res.status(200).json({ success: true, data: normalized });
    }

    // Default: air quality metrics
    const result = await query(`
      SELECT
        timestamp as timestamp,
        aqi,
        pm25,
        pm10,
        no2,
        so2,
        o3,
        co
      FROM air_quality_metrics
      WHERE timestamp > NOW() - INTERVAL '${durationHours} hours'
      ORDER BY timestamp ASC
    `);

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

export const forceMetricsUpdate = async (req, res, next) => {
  try {
    const metrics = await EnvironmentalDataService.updateRealTimeMetrics();
    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
};