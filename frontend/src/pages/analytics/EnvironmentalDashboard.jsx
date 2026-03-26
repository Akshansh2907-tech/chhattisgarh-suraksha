import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import { format, subDays } from 'date-fns';
import { metricsAPI } from '../../utils/api';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { toast } from 'sonner';

// AI-powered insights component
const AIInsights = ({ data }) => {
  const [insights, setInsights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const analyzeData = async () => {
      try {
        const response = await fetch('/api/ml/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        });
        const result = await response.json();
        setInsights(result.insights);
      } catch (error) {
        console.error('Failed to get AI insights:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (data?.length > 0) {
      analyzeData();
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-4 bg-card rounded-lg">
        <h3 className="text-lg font-semibold mb-3">AI Insights</h3>
        <div className="flex items-center space-x-2">
          <Icon name="Loader2" className="animate-spin" />
          <span>Analyzing data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card rounded-lg">
      <h3 className="text-lg font-semibold mb-3">AI Insights</h3>
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div key={index} className="flex items-start space-x-2">
            <Icon name={insight.type === 'warning' ? 'AlertTriangle' : 'LineChart'} 
                  className={insight.type === 'warning' ? 'text-warning' : 'text-primary'} />
            <p>{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const EnvironmentalDashboard = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [metrics, setMetrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const days = timeRange === '24h' ? 1 : 
                    timeRange === '7d' ? 7 : 
                    timeRange === '30d' ? 30 : 7;

        const response = await metricsAPI.getMetricsHistory('all', days);
        
        // Process and format data for charts
        const formattedData = response.data.map(item => ({
          timestamp: format(new Date(item.timestamp), 'MMM dd HH:mm'),
          aqi: item.aqi,
          pm25: item.pm25,
          temperature: item.temperature,
          humidity: item.humidity,
          waterQuality: item.waterQuality,
          noiseLevel: item.noiseLevel
        }));

        setMetrics(formattedData);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
        toast.error('Failed to load environmental data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange, selectedLocation]);

  const timeRangeButtons = [
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Icon name="Loader2" size={32} className="animate-spin" />
          <p>Loading environmental data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div>
            <h1 className="text-2xl font-bold">Environmental Analytics</h1>
            <p className="text-muted-foreground">
              Track and analyze environmental metrics across Chhattisgarh
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {timeRangeButtons.map(({ label, value }) => (
              <Button
                key={value}
                variant={timeRange === value ? 'default' : 'outline'}
                onClick={() => setTimeRange(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { 
              title: 'Air Quality Index',
              value: metrics[metrics.length - 1]?.aqi || 'N/A',
              change: '+2.5%',
              icon: 'Wind'
            },
            {
              title: 'Temperature',
              value: `${metrics[metrics.length - 1]?.temperature || 'N/A'}°C`,
              change: '-0.8°C',
              icon: 'Thermometer'
            },
            {
              title: 'Water Quality',
              value: metrics[metrics.length - 1]?.waterQuality || 'N/A',
              change: '+1.2%',
              icon: 'Droplet'
            },
            {
              title: 'Noise Level',
              value: `${metrics[metrics.length - 1]?.noiseLevel || 'N/A'} dB`,
              change: '-3.1 dB',
              icon: 'Volume2'
            }
          ].map((stat, index) => (
            <div key={index} className="bg-card p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                  <p className={`text-sm ${
                    stat.change.startsWith('+') ? 'text-success' : 'text-error'
                  }`}>
                    {stat.change} from last period
                  </p>
                </div>
                <Icon name={stat.icon} size={24} className="text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AQI Trend */}
          <div className="bg-card p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Air Quality Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="aqi" stroke="#8884d8" />
                <Line type="monotone" dataKey="pm25" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Temperature & Humidity */}
          <div className="bg-card p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Temperature & Humidity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis yAxisId="temp" />
                <YAxis yAxisId="humidity" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="#ff7300" />
                <Line yAxisId="humidity" type="monotone" dataKey="humidity" stroke="#387908" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Water Quality Metrics */}
          <div className="bg-card p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Water Quality Index</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="waterQuality" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Noise Levels */}
          <div className="bg-card p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Noise Levels</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="noiseLevel" stroke="#ff4444" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insights Section */}
        <AIInsights data={metrics} />

      </div>
    </div>
  );
};

export default EnvironmentalDashboard;