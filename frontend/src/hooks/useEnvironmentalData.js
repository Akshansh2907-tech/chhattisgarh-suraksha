import { useState, useEffect, useCallback } from 'react';
import { environmentalAPI } from '../utils/environmental';
import { auth } from '../utils/api';

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

export const useEnvironmentalData = () => {
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [trends, setTrends] = useState([]);

  // Fetch current metrics with retries
  const fetchMetrics = async (retryCount = 0) => {
    try {
      const response = await environmentalAPI.getCurrentMetrics();
      
      // Check if response exists and has data
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }

      // Handle error in response
      if (response.data.error) {
        throw new Error(response.data.message || 'Failed to fetch metrics');
      }

      // Validate data exists and is not null/undefined
      if (!response.data.data) {
        throw new Error('No metrics data available');
      }

      setMetrics(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);

      // Handle authentication errors - clear token but don't force navigation here.
      if (err.response?.status === 401 || err.response?.status === 403) {
        auth.clearToken();
        setError('Authentication required. Please log in.');
        return;
      }

      // Retry logic for network errors
      if (retryCount < 2 && (!err.response || err.response.status >= 500)) {
        console.log(`Retrying metrics fetch... Attempt ${retryCount + 1}`);
        setTimeout(() => fetchMetrics(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }

      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch environmental data';
      setError(errorMessage);
      setMetrics(null); // Reset metrics on error
    }
  };

  // Fetch active alerts with retries
  const fetchAlerts = async (retryCount = 0) => {
    try {
      const response = await environmentalAPI.getActiveAlerts();
      
      // Check if response exists and has data
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }

      // Handle error in response
      if (response.data.error) {
        throw new Error(response.data.message || 'Failed to fetch alerts');
      }

      // Validate data exists
      const alertsData = response.data.data ?? [];
      setAlerts(alertsData);
      
    } catch (err) {
      console.error('Failed to fetch alerts:', err);

      // Handle authentication errors - clear token but don't redirect from a hook
      if (err.response?.status === 401 || err.response?.status === 403) {
        auth.clearToken();
        setError('Authentication required. Please log in.');
        return;
      }

      // Retry logic for network errors
      if (retryCount < 2 && (!err.response || err.response.status >= 500)) {
        console.log(`Retrying alerts fetch... Attempt ${retryCount + 1}`);
        setTimeout(() => fetchAlerts(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }

      // Set empty alerts on error but don't show error message
      setAlerts([]);
    }
  };

  // Fetch data with exponential backoff
  const fetchDataWithRetry = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[useEnvironmentalData] Starting data fetch...');
      
      // Do not read localStorage here; rely on API responses for auth validation.

      // Fetch metrics and alerts separately to handle individual failures
      let metricsResponse, alertsResponse;
      
      try {
        metricsResponse = await environmentalAPI.getCurrentMetrics();
        // Validate the response
        if (!metricsResponse?.data?.success) {
          throw new Error('Invalid metrics response format');
        }
      } catch (metricsError) {
        console.error('Failed to fetch metrics:', metricsError);
        
        // Handle specific error cases
        if (metricsError.response?.status === 401 || metricsError.response?.status === 403) {
          auth.clearToken();
          setError('Authentication required. Please log in.');
          return;
        }
        
        // Provide fallback metrics data
        metricsResponse = {
          data: {
            success: true,
            data: {
              aqi: null,
              pm25: null,
              pm10: null,
              temperature: null,
              humidity: null,
              last_updated: new Date().toISOString()
            }
          }
        };
      }

      try {
        alertsResponse = await environmentalAPI.getActiveAlerts();
      } catch (alertsError) {
        console.error('Failed to fetch alerts:', alertsError);
        // Provide empty alerts array as fallback
        alertsResponse = { data: { success: true, data: [] } };
      }

          // Process and validate metrics response
      const rawData = metricsResponse?.data?.data || {};
      // Preserve nulls when backend doesn't have a value (avoid coercing null -> 0)
      const toNumberOrNull = (v) => (v === null || v === undefined ? null : Number(v));

      const processedMetrics = {
        aqi: toNumberOrNull(rawData.aqi),
        pm25: toNumberOrNull(rawData.pm25),
        pm10: toNumberOrNull(rawData.pm10),
        temperature: toNumberOrNull(rawData.temperature),
        humidity: toNumberOrNull(rawData.humidity),
        wind_speed: toNumberOrNull(rawData.wind_speed),
        wind_direction: rawData.wind_direction || null,
        precipitation: toNumberOrNull(rawData.precipitation),
        last_updated: rawData.last_updated || new Date().toISOString(),
        // Additional metrics
        no2: toNumberOrNull(rawData.no2),
        so2: toNumberOrNull(rawData.so2),
        o3: toNumberOrNull(rawData.o3),
        co: toNumberOrNull(rawData.co),
        pressure: toNumberOrNull(rawData.pressure)
      };
      
      // Only update metrics if we have at least some valid data
      if (Object.values(processedMetrics).some(val => val !== null && val !== undefined)) {
        setMetrics(processedMetrics);
      } else {
        console.warn('No valid metrics data available');
        setMetrics({
          aqi: null,
          pm25: null,
          pm10: null,
          temperature: null,
          humidity: null,
          wind_speed: null,
          wind_direction: null,
          precipitation: null,
          last_updated: new Date().toISOString()
        });
      }

      // Process and validate alerts response
      const processedAlerts = Array.isArray(alertsResponse?.data?.data) 
        ? alertsResponse.data.data 
        : [];
      setAlerts(processedAlerts);

      // Reset retry count on success
      setRetryCount(0);
      setError(null);

      // Fetch trends/history from 8AM -> now (best-effort)
      try {
        const now = new Date();
        let start = new Date();
        start.setHours(8, 0, 0, 0);
        // if current time is before 8AM, show previous day's 8AM -> now
        if (now < start) {
          start = new Date(start.getTime() - 24 * 60 * 60 * 1000);
        }
        const durationHours = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60)) || 1;

        const [airHistResp, weatherHistResp] = await Promise.all([
          environmentalAPI.getMetricsHistory('air_quality', durationHours),
          environmentalAPI.getMetricsHistory('weather', durationHours)
        ]);

        const airHistory = airHistResp?.data?.data ?? airHistResp?.data ?? [];
        const weatherHistory = weatherHistResp?.data?.data ?? weatherHistResp?.data ?? [];

        // Merge histories by timestamp where possible. Best-effort joining on exact timestamp.
        const weatherByTs = new Map();
        weatherHistory.forEach((w) => {
          if (w.timestamp) weatherByTs.set(new Date(w.timestamp).toISOString(), w);
        });

        const merged = (airHistory || []).map((a) => {
          const ts = a.timestamp ? new Date(a.timestamp).toISOString() : null;
          const w = ts ? weatherByTs.get(ts) : undefined;
          return {
            timestamp: a.timestamp || (w && w.timestamp) || null,
            aqi: a.aqi ?? a.air_quality ?? null,
            pm25: a.pm25 ?? null,
            pm10: a.pm10 ?? null,
            temperature: w?.temperature ?? null,
            humidity: w?.humidity ?? null
          };
        });

        // If no merged data but we have current metrics, create a fallback single-point series
        if (merged.length === 0 && metricsResponse?.data?.data) {
          const m = metricsResponse.data.data;
          merged.push({
            timestamp: m.last_updated || new Date().toISOString(),
            aqi: m.aqi ?? m.air_quality ?? null,
            pm25: m.pm25 ?? null,
            pm10: m.pm10 ?? null,
            temperature: m.temperature ?? null,
            humidity: m.humidity ?? null
          });
        }

        setTrends(merged);
      } catch (histErr) {
        console.warn('Failed to fetch trends/history:', histErr);
        // keep trends as-is (do not fail entire fetch)
      }
    } catch (err) {
      console.error('Error fetching environmental data:', err);

      // Handle auth errors - clear token and set an error, leave navigation to components
      if (err.response?.status === 401 || err.response?.status === 403) {
        auth.clearToken();
        setError('Authentication required. Please log in.');
        return;
      }

      // For network or server errors, retry
      if (retryCount < MAX_RETRIES && (err.code === 'ECONNABORTED' || err.response?.status >= 500)) {
        const nextRetryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`Retrying in ${nextRetryDelay}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchDataWithRetry(), nextRetryDelay);
      } else {
        // For critical errors, mark them as such
        setError({
          message: 'Unable to load environmental data. Please try again later.',
          critical: true,
          originalError: err
        });
        // Provide fallback data
        setMetrics({
          aqi: null,
          pm25: null,
          pm10: null,
          temperature: null,
          humidity: null,
          last_updated: new Date().toISOString()
        });
      }
    } finally {
      setLoading(false);
    }
  }, [retryCount]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    console.log('[useEnvironmentalData] Starting initial fetch...');
    
    const fetchInitialData = async () => {
      try {
        await fetchDataWithRetry();
        console.log('[useEnvironmentalData] Initial fetch successful');
      } catch (error) {
        console.error('[useEnvironmentalData] Initial fetch failed:', error);
      }
    };

    fetchInitialData();

    const interval = setInterval(() => {
      console.log('[useEnvironmentalData] Running periodic refresh...');
      fetchDataWithRetry();
    }, REFRESH_INTERVAL);

    return () => {
      console.log('[useEnvironmentalData] Cleaning up...');
      clearInterval(interval);
    };
  }, [fetchDataWithRetry]);

  return {
    metrics,
    alerts,
    trends,
    loading,
    error,
    refetch: fetchDataWithRetry
  };
};

export default useEnvironmentalData;