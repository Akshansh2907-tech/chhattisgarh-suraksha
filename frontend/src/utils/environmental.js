import api from './api';
import axios from 'axios';

const OPENAQ_LATEST = 'https://api.openaq.org/v2/latest';
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Cache storage
const metricsCache = {
  data: null,
  timestamp: null
};

export const environmentalAPI = {
  // Get current metrics with caching and fallback strategy
  getCurrentMetrics: async (lat, lon) => {
    try {
      // Check cache first
      const now = Date.now();
      if (metricsCache.data && metricsCache.timestamp && (now - metricsCache.timestamp < CACHE_DURATION)) {
        return metricsCache.data;
      }

      // Try backend first
      const url = '/metrics/current' + (lat && lon ? `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` : '');
      const res = await api.get(url);
      
      if (res?.data?.success && res?.data?.data) {
        const formattedData = {
          data: {
            success: true,
            data: {
              ...res.data.data,
              last_updated: res.data.data.last_updated || new Date().toISOString()
            }
          }
        };
        
        // Update cache
        metricsCache.data = formattedData;
        metricsCache.timestamp = now;
        
        return formattedData;
      }
      
      throw new Error('Invalid backend response');
    } catch (err) {
      // Don't fall back for auth errors
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }

      console.warn('Backend metrics unavailable, using external APIs:', err.message);
      try {
        return await environmentalAPI.fetchExternalMetrics(lat, lon);
      } catch (externalError) {
        console.error('External APIs also failed:', externalError);
        // Return fallback data instead of throwing
        return {
          data: {
            success: true,
            data: {
              aqi: null,
              pm25: null,
              pm10: null,
              temperature: null,
              humidity: null,
              wind_speed: null,
              wind_direction: null,
              precipitation: null,
              last_updated: new Date().toISOString(),
              source: 'fallback'
            }
          }
        };
      }
    }
  },

  // Fetch metrics from external APIs
  fetchExternalMetrics: async (lat, lon) => {
    const latCoord = typeof lat === 'number' ? lat : 21.2514;
    const lonCoord = typeof lon === 'number' ? lon : 81.6296;

    try {
      // Parallel API calls for better performance
      const [weatherResp, aqResp] = await Promise.all([
        // Weather data from Open-Meteo
        axios.get(OPEN_METEO, {
          params: {
            latitude: latCoord,
            longitude: lonCoord,
            current: [
              'temperature_2m',
              'relative_humidity_2m',
              'precipitation',
              'wind_speed_10m',
              'wind_direction_10m'
            ].join(','),
            timezone: 'auto'
          }
        }),
        
        // Air quality data from OpenAQ
        axios.get(OPENAQ_LATEST, {
          params: {
            coordinates: `${latCoord},${lonCoord}`,
            radius: 10000,
            limit: 100,
            parameters: ['pm25', 'pm10', 'no2', 'so2', 'o3', 'co'].join(',')
          }
        })
      ]);

      // Extract weather data
      const weather = weatherResp.data?.current || {};
      
      // Process air quality data
      const measurements = {};
      if (aqResp.data?.results) {
        for (const result of aqResp.data.results) {
          for (const m of result.measurements || []) {
            if (!measurements[m.parameter]) {
              measurements[m.parameter] = m.value;
            }
          }
        }
      }

      // Calculate AQI based on PM2.5 (simplified calculation)
      const pm25 = measurements.pm25;
      const aqi = pm25 ? Math.round(pm25 * 4) : null;

      const response = {
        data: {
          success: true,
          data: {
            aqi,
            pm25: measurements.pm25 || null,
            pm10: measurements.pm10 || null,
            no2: measurements.no2 || null,
            so2: measurements.so2 || null,
            o3: measurements.o3 || null,
            co: measurements.co || null,
            temperature: weather.temperature_2m,
            humidity: weather.relative_humidity_2m,
            wind_speed: weather.wind_speed_10m,
            wind_direction: weather.wind_direction_10m,
            precipitation: weather.precipitation,
            last_updated: new Date().toISOString(),
            source: 'external_apis'
          }
        }
      };

      // Update cache with external data
      metricsCache.data = response;
      metricsCache.timestamp = Date.now();

      return response;
    } catch (error) {
      console.error('External APIs failed:', error);
      throw new Error('Unable to fetch environmental data from any source');
    }
  },

  // Get active alerts with caching
  getActiveAlerts: async () => {
    try {
      const response = await api.get('/metrics/alerts');
      return response;
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      return { data: { success: true, data: [] } };
    }
  },

  // Get historical metrics with error handling
  getMetricsHistory: async (type, duration) => {
    try {
      const response = await api.get(`/metrics/history?type=${type}&duration=${duration}`);
      
      if (!response?.data?.success) {
        throw new Error('Invalid history response');
      }
      
      return response;
    } catch (error) {
      console.error(`Failed to fetch ${type} history:`, error);
      return { 
        data: { 
          success: true, 
          data: [],
          message: `Unable to load ${type} history` 
        } 
      };
    }
  },

  // Force update metrics (admin only)
  forceUpdate: async () => {
    try {
      // Clear cache first
      metricsCache.data = null;
      metricsCache.timestamp = null;
      
      const response = await api.post('/metrics/update');
      
      // Update cache with new data if available
      if (response?.data?.success && response?.data?.data) {
        metricsCache.data = {
          data: {
            success: true,
            data: {
              ...response.data.data,
              last_updated: new Date().toISOString()
            }
          }
        };
        metricsCache.timestamp = Date.now();
      }
      
      return response;
    } catch (error) {
      console.error('Force update failed:', error);
      throw error;
    }
  },

  // Clear metrics cache
  clearCache: () => {
    metricsCache.data = null;
    metricsCache.timestamp = null;
  }
};