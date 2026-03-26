import { query } from '../config/database.js';

class EnvironmentalMetrics {
  static async createAirQualityMetric(data) {
    const { aqi, pm25, pm10, no2, so2, o3, co, location_id = 1 } = data;
    
    const result = await query(
      `INSERT INTO air_quality_metrics 
       (location_id, aqi, pm25, pm10, no2, so2, o3, co)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [location_id, aqi, pm25, pm10, no2, so2, o3, co]
    );
    
    return result.rows[0];
  }

  static async createWeatherMetric(data) {
    const {
      temperature,
      humidity,
      wind_speed,
      wind_direction,
      precipitation,
      pressure,
      visibility,
      uv_index,
      location_id = 1
    } = data;
    
    const result = await query(
      `INSERT INTO weather_metrics 
       (location_id, temperature, humidity, wind_speed, wind_direction, 
        precipitation, pressure, visibility, uv_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [location_id, temperature, humidity, wind_speed, wind_direction,
       precipitation, pressure, visibility, uv_index]
    );
    
    return result.rows[0];
  }

  static async createAlert(data) {
    const {
      type,
      severity,
      message,
      details,
      location_id = 1
    } = data;
    // Normalize details: if already a string, use as-is; otherwise stringify
    const detailsPayload = typeof details === 'string' ? details : JSON.stringify(details);

    const result = await query(
      `INSERT INTO environmental_alerts 
       (location_id, type, severity, message, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [location_id, type, severity, message, detailsPayload]
    );
    
    return result.rows[0];
  }

  // Insert multiple alerts (accepts an array of alert objects)
  static async createAlerts(alerts = []) {
    if (!Array.isArray(alerts) || alerts.length === 0) return [];

    // Use the single createAlert helper for simplicity and to preserve logging/validation
    const created = [];
    for (const a of alerts) {
      // Ensure details is a JSON object or string - avoid double-stringifying
      const normalized = {
        ...a,
        details: typeof a.details === 'string' ? a.details : JSON.stringify(a.details)
      };
      const alert = await this.createAlert(normalized);
      created.push(alert);
    }

    return created;
  }

  static async updateRealTimeMetrics(locationId = 1, airQualityId, weatherId) {
    // First deactivate old metrics
    await query(
      `UPDATE real_time_metrics 
       SET last_updated = NOW() - INTERVAL '1 day'
       WHERE location_id = $1`,
      [locationId]
    );
    
    // Insert new real-time metrics
    const result = await query(
      `INSERT INTO real_time_metrics 
       (location_id, air_quality_id, weather_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [locationId, airQualityId, weatherId]
    );
    
    return result.rows[0];
  }

  static async getLatestMetrics(locationId = 1) {
    console.log('\n📊 Fetching Latest Metrics from Database');
    console.log('──────────────────────────────────');
    console.log('📍 Location ID:', locationId);
    
    const result = await query(
      `SELECT 
         rtm.*,
         aq.*,
         wm.*,
         json_agg(ea.*) as alerts
       FROM real_time_metrics rtm
       JOIN air_quality_metrics aq ON rtm.air_quality_id = aq.id
       JOIN weather_metrics wm ON rtm.weather_id = wm.id
       LEFT JOIN environmental_alerts ea 
         ON ea.location_id = rtm.location_id 
         AND ea.is_active = true
       WHERE rtm.location_id = $1
       GROUP BY rtm.id, aq.id, wm.id
       ORDER BY rtm.last_updated DESC
       LIMIT 1`,
      [locationId]
    );
    
    if (result.rows[0]) {
      console.log('✅ Found metrics in database');
      console.log('⏱️  Last Updated:', result.rows[0].last_updated);
      console.log('🌡️  Temperature:', result.rows[0].temperature);
      console.log('💨 Air Quality:', result.rows[0].aqi);
    } else {
      console.log('⚠️  No metrics found in database');
    }
    console.log('──────────────────────────────────\n');
    
    return result.rows[0];
  }

  static async getMetricsHistory(type, duration, locationId = 1) {
    const table = type === 'air_quality' ? 'air_quality_metrics' : 'weather_metrics';
    
    const result = await query(
      `SELECT * FROM ${table}
       WHERE location_id = $1
       AND timestamp > NOW() - INTERVAL '${duration} hours'
       ORDER BY timestamp ASC`,
      [locationId]
    );
    
    return result.rows;
  }

  static async getActiveAlerts(locationId = 1) {
    const result = await query(
      `SELECT * FROM environmental_alerts
       WHERE location_id = $1
       AND is_active = true
       ORDER BY timestamp DESC`,
      [locationId]
    );
    
    return result.rows;
  }

  static async getHistoricalMetrics(locationId = 1, days = 30) {
    const result = await query(
      `SELECT 
        aq.*, wm.*,
        TO_CHAR(aq.timestamp, 'YYYY-MM-DD HH24:MI:SS') as timestamp
      FROM air_quality_metrics aq
      JOIN weather_metrics wm ON 
        wm.location_id = aq.location_id AND 
        DATE_TRUNC('hour', wm.timestamp) = DATE_TRUNC('hour', aq.timestamp)
      WHERE aq.location_id = $1
      AND aq.timestamp > NOW() - ($2 || ' days')::interval
      ORDER BY aq.timestamp ASC`,
      [locationId, days]
    );
    
    return result.rows;
  }
}

export default EnvironmentalMetrics;