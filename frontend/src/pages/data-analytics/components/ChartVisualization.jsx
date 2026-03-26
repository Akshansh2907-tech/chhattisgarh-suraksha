import React, { useState, useEffect } from 'react';
import { metricsAPI } from '../../../utils/api';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const ChartVisualization = ({ data, title, onChartTypeChange }) => {
  const [chartType, setChartType] = useState('line');
  const [selectedMetrics, setSelectedMetrics] = useState(['aqi', 'temperature', 'humidity']);

  const [metricsData, setMetricsData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Map timeRange string (e.g., '7d', '24h') to duration hours
  const timeRangeToHours = (tr) => {
    if (!tr) return 24;
    if (tr.endsWith('d')) {
      const days = parseInt(tr.replace('d','')) || 7;
      return days * 24;
    }
    if (tr.endsWith('h')) {
      return parseInt(tr.replace('h','')) || 24;
    }
    // default to 24 hours
    return 24;
  };

  useEffect(() => {
    let mounted = true;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const duration = timeRangeToHours(data?.timeRange || '24h');

        // Fetch air_quality history and weather history, then merge by timestamp
        const [airResp, weatherResp] = await Promise.all([
          metricsAPI.getMetricsHistory('air_quality', duration),
          metricsAPI.getMetricsHistory('weather', duration)
        ]);

        const airHistory = airResp?.data?.data ?? airResp?.data ?? [];
        const weatherHistory = weatherResp?.data?.data ?? weatherResp?.data ?? [];

        // Map weather by timestamp for easy joining
        const weatherByTs = new Map();
        weatherHistory.forEach(w => {
          const ts = w.timestamp ? new Date(w.timestamp).toISOString() : null;
          if (ts) weatherByTs.set(ts, w);
        });

        // Create a map of all measurements by hour to handle different timestamps
        const hourlyData = new Map();
        
        // Process air quality data
        airHistory.forEach(a => {
          const date = new Date(a.timestamp || a.last_updated || Date.now());
          const hour = date.toISOString().slice(0, 13); // Group by hour
          const existing = hourlyData.get(hour) || {};
          hourlyData.set(hour, {
            ...existing,
            time: date.toISOString(),
            aqi: a.aqi ?? a.air_quality ?? existing.aqi ?? null,
            pm25: a.pm25 ?? existing.pm25 ?? null,
            pm10: a.pm10 ?? existing.pm10 ?? null,
            // Keep any existing temperature/humidity
            temperature: existing.temperature ?? a.temperature ?? null,
            humidity: existing.humidity ?? a.humidity ?? null
          });
        });

        // Process weather data
        weatherHistory.forEach(w => {
          const date = new Date(w.timestamp || w.last_updated || Date.now());
          const hour = date.toISOString().slice(0, 13);
          const existing = hourlyData.get(hour) || {};
          hourlyData.set(hour, {
            ...existing,
            time: existing.time || date.toISOString(),
            // Keep existing air quality metrics
            aqi: existing.aqi ?? null,
            pm25: existing.pm25 ?? null,
            pm10: existing.pm10 ?? null,
            // Update or set temperature/humidity
            temperature: w.temperature ?? existing.temperature ?? null,
            humidity: w.humidity ?? existing.humidity ?? null
          });
        });

        // Convert map to array and sort by time
        const merged = Array.from(hourlyData.values())
          .sort((a, b) => new Date(a.time) - new Date(b.time));

        if (mounted) setMetricsData(merged);
      } catch (err) {
        console.error('Failed to fetch metrics history for chart:', err);
        // fallback: if a current point is provided, use it
        if (data) {
          setMetricsData([{
            time: data.last_updated || new Date().toISOString(),
            pm25: data.pm25,
            pm10: data.pm10,
            aqi: data.aqi,
            temperature: data.temperature,
            humidity: data.humidity
          }]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchHistory();

    return () => { mounted = false; };
  }, [data?.timeRange, data?.dataType, data?.filters]);

  const chartTypeOptions = [
    { value: 'line', label: 'Line Chart' },
    { value: 'area', label: 'Area Chart' },
    { value: 'bar', label: 'Bar Chart' },
    { value: 'scatter', label: 'Scatter Plot' }
  ];

  const metricOptions = [
    { value: 'aqi', label: 'Air Quality', color: '#059669' },
    { value: 'pm25', label: 'PM2.5', color: '#DC2626' },
    { value: 'pm10', label: 'PM10', color: '#D97706' },
    { value: 'temperature', label: 'Temperature', color: '#F4A261' },
    { value: 'humidity', label: 'Humidity', color: '#3B82F6' }
  ];

  const handleChartTypeChange = (type) => {
    setChartType(type);
    onChartTypeChange(type);
  };

  const handleMetricToggle = (metric) => {
    setSelectedMetrics(prev => 
      prev?.includes(metric)
        ? prev?.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  const getMetricColor = (metric) => {
    const metricConfig = metricOptions?.find(m => m?.value === metric);
    return metricConfig ? metricConfig?.color : '#6B7280';
  };

  const renderChart = () => {
    const commonProps = {
      data: metricsData,
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="time" stroke="#6B7280" />
            <YAxis stroke="#6B7280" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#FFFFFF', 
                border: '1px solid #E5E7EB',
                borderRadius: '8px'
              }} 
            />
            <Legend />
            {selectedMetrics?.map((metric) => (
              <Area
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={getMetricColor(metric)}
                fill={getMetricColor(metric)}
                fillOpacity={0.3}
                name={metricOptions?.find(m => m?.value === metric)?.label}
              />
            ))}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="time" stroke="#6B7280" />
            <YAxis stroke="#6B7280" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#FFFFFF', 
                border: '1px solid #E5E7EB',
                borderRadius: '8px'
              }} 
            />
            <Legend />
            {selectedMetrics?.map((metric) => (
              <Bar
                key={metric}
                dataKey={metric}
                fill={getMetricColor(metric)}
                name={metricOptions?.find(m => m?.value === metric)?.label}
              />
            ))}
          </BarChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="pm25" stroke="#6B7280" name="PM2.5" />
            <YAxis dataKey="temperature" stroke="#6B7280" name="Temperature" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#FFFFFF', 
                border: '1px solid #E5E7EB',
                borderRadius: '8px'
              }} 
            />
            <Scatter name="PM2.5 vs Temperature" data={metricsData} fill="#059669" />
          </ScatterChart>
        );

      default: // line
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="time" stroke="#6B7280" />
            <YAxis stroke="#6B7280" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#FFFFFF', 
                border: '1px solid #E5E7EB',
                borderRadius: '8px'
              }} 
            />
            <Legend />
            {selectedMetrics?.map((metric) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={getMetricColor(metric)}
                strokeWidth={2}
                dot={{ fill: getMetricColor(metric), strokeWidth: 2, r: 4 }}
                name={metricOptions?.find(m => m?.value === metric)?.label}
              />
            ))}
          </LineChart>
        );
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">Interactive environmental data visualization</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select
            options={chartTypeOptions}
            value={chartType}
            onChange={handleChartTypeChange}
            className="min-w-32"
          />
          
          <Button
            variant="outline"
            iconName="Download"
            iconPosition="left"
            size="sm"
          >
            Export
          </Button>

          <Button
            variant="outline"
            iconName="Maximize2"
            iconPosition="left"
            size="sm"
          >
            Fullscreen
          </Button>
        </div>
      </div>
      {/* Metric Selection */}
      <div className="mb-4">
        <div className="text-sm font-medium text-foreground mb-2">Select Metrics:</div>
        <div className="flex flex-wrap gap-2">
          {metricOptions?.map((metric) => (
            <button
              key={metric?.value}
              onClick={() => handleMetricToggle(metric?.value)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                selectedMetrics?.includes(metric?.value)
                  ? 'border-transparent text-white' :'border-border text-muted-foreground hover:text-foreground'
              }`}
              style={{
                backgroundColor: selectedMetrics?.includes(metric?.value) ? metric?.color : 'transparent'
              }}
            >
              {metric?.label}
            </button>
          ))}
        </div>
      </div>
      {/* Chart Container */}
      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
      {/* Chart Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-4 border-t border-border">
        {(() => {
          const last = metricsData && metricsData.length > 0 ? metricsData[metricsData.length - 1] : data;
          return (
            <>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {last?.aqi ?? '—'}
                </div>
                <div className="text-xs text-muted-foreground">Current AQI</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {last?.temperature ? `${last.temperature}°C` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Temperature</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {last?.humidity ? `${last.humidity}%` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Humidity</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {last?.time ? new Date(last.time).toLocaleTimeString() : (data?.last_updated ? new Date(data.last_updated).toLocaleTimeString() : '—')}
                </div>
                <div className="text-xs text-muted-foreground">Last Updated</div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default ChartVisualization;