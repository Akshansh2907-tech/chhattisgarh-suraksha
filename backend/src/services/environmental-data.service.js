import axios from 'axios';
import EnvironmentalMetrics from '../models/environmental-metrics.js';
import { broadcast } from './ws-broadcaster.js';

const WAQI_API_KEY = process.env.WAQI_API_KEY;

// Raipur coordinates
const RAIPUR_LAT = 21.2514;
const RAIPUR_LNG = 81.6296;

// API endpoints
const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_AIR_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

class EnvironmentalDataService {
  // Fetch air quality data from WAQI API
  static async fetchAirQualityData() {
    try {
      if (!WAQI_API_KEY || WAQI_API_KEY === '4d088aed7349967ad5cf5a2d8f54662a48957105') {
        console.warn('⚠️ No valid WAQI API key found. Using Open-Meteo air quality data instead.');
        
        // Try to get air quality data from Open-Meteo
        try {
          const openMeteoData = await this.fetchAdditionalAirQualityData();
          if (openMeteoData) {
            // Calculate AQI using PM2.5 as primary indicator (simplified calculation)
            const pm25 = openMeteoData.pm2_5;
            const aqi = Math.min(Math.round((pm25 * 4.5) + 15), 500); // Simplified AQI calculation
            
            const airQualityData = await EnvironmentalMetrics.createAirQualityMetric({
              aqi: aqi,
              pm25: openMeteoData.pm2_5,
              pm10: openMeteoData.pm10,
              no2: openMeteoData.nitrogen_dioxide,
              so2: openMeteoData.sulphur_dioxide,
              o3: openMeteoData.ozone,
              co: openMeteoData.carbon_monoxide,
              location_id: 1,
              is_default_data: false
            });
            return airQualityData;
          }
        } catch (openMeteoError) {
          console.error('Failed to fetch Open-Meteo air quality data:', openMeteoError);
        }
        
        // If Open-Meteo fails, return simulated data
        const simulatedAqi = Math.floor(Math.random() * (180 - 50 + 1)) + 50; // Random AQI between 50-180
        const simulatedPm25 = simulatedAqi / 4.5;
        
        const airQualityData = await EnvironmentalMetrics.createAirQualityMetric({
          aqi: simulatedAqi,
          pm25: simulatedPm25,
          pm10: simulatedPm25 * 1.5,
          no2: Math.random() * 50,
          so2: Math.random() * 40,
          o3: Math.random() * 60,
          co: Math.random() * 9,
          location_id: 1,
          is_default_data: true
        });
        return airQualityData;
      }

      const response = await axios.get(
        `https://api.waqi.info/feed/geo:${RAIPUR_LAT};${RAIPUR_LNG}/?token=${WAQI_API_KEY}`
      );

      if (response.data.status === 'ok') {
        const data = response.data.data;
        
        const airQualityData = await EnvironmentalMetrics.createAirQualityMetric({
          aqi: data.aqi,
          pm25: data.iaqi.pm25?.v,
          pm10: data.iaqi.pm10?.v,
          no2: data.iaqi.no2?.v,
          so2: data.iaqi.so2?.v,
          o3: data.iaqi.o3?.v,
          co: data.iaqi.co?.v,
          location_id: 1,
          is_default_data: false
        });
        return airQualityData;
      }
    } catch (error) {
      console.error('Error fetching air quality data:', error);
      console.error('API Response:', error.response?.data);
      throw error;
    }
  }

  // Fetch weather data from Open-Meteo API
  static async fetchWeatherData() {
    try {
      console.log(`🌍 Fetching weather data for Raipur (${RAIPUR_LAT}, ${RAIPUR_LNG})`);
      
      const response = await axios.get(OPEN_METEO_API, {
        params: {
          latitude: RAIPUR_LAT,
          longitude: RAIPUR_LNG,
          current: 'temperature_2m,relative_humidity_2m,precipitation,pressure_msl,wind_speed_10m,wind_direction_10m,uv_index',
          wind_speed_unit: 'ms',
          timezone: 'Asia/Kolkata'
        },
        timeout: 5000 // 5 second timeout
      }).catch(error => {
        console.error('Open-Meteo API error:', error.message);
        throw error;
      });

      const data = response.data;
      console.log('📊 Received weather data:', data.current);
      
      const weatherData = await EnvironmentalMetrics.createWeatherMetric({
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        wind_speed: data.current.wind_speed_10m,
        wind_direction: this.getWindDirection(data.current.wind_direction_10m),
        precipitation: data.current.precipitation,
        pressure: data.current.pressure_msl,
        uv_index: data.current.uv_index,
        location_id: 1, // Default Raipur location
        is_default_data: false
      });


      return weatherData;
    } catch (error) {
      console.error('Error fetching weather data:', error);
      throw error;
    }
  }

  // Fetch additional air quality data from Open-Meteo
  static async fetchAdditionalAirQualityData() {
    try {
      const response = await axios.get(OPEN_METEO_AIR_API, {
        params: {
          latitude: RAIPUR_LAT,
          longitude: RAIPUR_LNG,
          current: 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
          timezone: 'Asia/Kolkata'
        }
      });
      return response.data.current;
    } catch (error) {
      console.error('Error fetching additional air quality data:', error);
      return null;
    }
  }

  // Generate environmental alerts based on metrics
  static async generateAlerts(airQuality, weather) {
    const alerts = [];

    const alertData = [];
    
    // Check AQI levels
    if (airQuality.aqi > 150) {
      alertData.push({
        type: 'air_quality',
        severity: airQuality.aqi > 200 ? 'critical' : 'high',
        message: `Air quality is ${airQuality.aqi > 200 ? 'very poor' : 'poor'} in your area`,
        details: JSON.stringify({
          aqi: airQuality.aqi,
          recommendation: 'Consider wearing masks when outdoors'
        }),
        location_id: 1
      });
    }

    // Check temperature
    if (weather.temperature > 40) {
      alertData.push({
        type: 'weather',
        severity: 'high',
        message: 'Extreme heat alert',
        details: JSON.stringify({
          temperature: weather.temperature,
          recommendation: 'Stay hydrated and avoid outdoor activities'
        }),
        location_id: 1
      });
    }

    // Save alerts and broadcast to connected clients
    let created = [];
    if (alertData.length > 0) {
      created = await EnvironmentalMetrics.createAlerts(alertData);

      // Normalize and broadcast each created alert
      try {
        for (const a of created) {
          const payload = {
            type: 'alert',
            alert: {
              id: a.id || `alert-${Date.now()}`,
              type: a.type,
              severity: a.severity,
              title: `${a.type?.replace('_', ' ').toUpperCase()} - ${a.severity?.toUpperCase()}`,
              message: a.message,
              details: a.details,
              timestamp: a.timestamp || new Date().toISOString(),
              location_id: a.location_id || 1
            }
          };
          // Broadcast to all connected clients
          broadcast(payload);
        }
      } catch (bErr) {
        console.warn('Failed to broadcast alerts via WebSocket:', bErr?.message || bErr);
      }
    }

    return created;
  }

  // Update real-time metrics
  static async updateRealTimeMetrics() {
    try {
      console.log('🔄 Starting real-time metrics update...');
      
      // Fetch data in parallel
      const [airQuality, weather] = await Promise.all([
        this.fetchAirQualityData().catch(error => {
          console.error('Failed to fetch air quality data:', error);
          return null;
        }),
        this.fetchWeatherData().catch(error => {
          console.error('Failed to fetch weather data:', error);
          return null;
        })
      ]);

      if (!airQuality || !weather) {
        throw new Error('Failed to fetch required metrics data');
      }

      console.log('📊 Metrics fetched successfully:', {
        aqi: airQuality.aqi,
        temperature: weather.temperature
      });

      const alerts = await this.generateAlerts(airQuality, weather);

      // Update real-time metrics pointer and then return the joined latest metrics
      await EnvironmentalMetrics.updateRealTimeMetrics(
        1, // Default Raipur location
        airQuality.id,
        weather.id
      );

      // Return the joined/latest metrics for the location so callers get full payload
      const latest = await EnvironmentalMetrics.getLatestMetrics(1);
      return latest;
    } catch (error) {
      console.error('Error updating real-time metrics:', error);
      throw error;
    }
  }

  // Helper function to convert wind degrees to direction
  static getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }
}

export default EnvironmentalDataService;