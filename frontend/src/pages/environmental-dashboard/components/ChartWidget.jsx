import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ChartWidget = ({ metrics, trends = [], loading }) => {
  const [activeChart, setActiveChart] = useState('trends');
  const [timeRange, setTimeRange] = useState('7d');

  // Transform trends prop for visualization (8AM -> now). Falls back to current metrics.
  const trendsData = (trends && trends.length > 0)
    ? trends.map((d) => ({
        time: d.timestamp ? new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        airQuality: d.aqi,
        pm25: d.pm25,
        pm10: d.pm10,
        temperature: d.temperature,
        humidity: d.humidity
      }))
    : (metrics ? [
        {
          time: metrics.last_updated ? new Date(metrics.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          airQuality: metrics.aqi,
          pm25: metrics.pm25,
          pm10: metrics.pm10,
          temperature: metrics.temperature,
          humidity: metrics.humidity
        }
      ] : []);

  // If metrics contains source breakdown, use it; otherwise use prototype values
  const rawPollution = metrics?.pollution_sources ?? null;
  const defaultPollution = [
    { source: 'Vehicles', value: 45, color: '#DC2626' },
    { source: 'Industry', value: 30, color: '#D97706' },
    { source: 'Residential', value: 15, color: '#059669' },
    { source: 'Other', value: 10, color: '#6B7280' }
  ];
  // We'll attempt to fetch pollution and weekly reports from the backend. If unavailable,
  // fall back to metrics.pollution_sources or default values.
  const [pollutionData, setPollutionData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [pollutionLoading, setPollutionLoading] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  const pollutionColors = ['#DC2626', '#D97706', '#059669', '#6B7280', '#3B82F6', '#7C3AED'];

  // derive a duration string from the timeRange for the backend (e.g. '7d', '24h')
  const durationForBackend = (range) => {
    if (!range) return '7d';
    if (range === '24h') return '24h';
    if (range === '7d') return '7d';
    if (range === '30d') return '30d';
    if (range === '90d') return '90d';
    return '7d';
  };

  useEffect(() => {
    // Fetch pollution sources (uses duration)
    let cancelled = false;
    const fetchPollution = async () => {
      setPollutionLoading(true);
      try {
        const dur = durationForBackend(timeRange);
        const resp = await fetch(`/api/reports/summary/pollution-sources?duration=${encodeURIComponent(dur)}`);
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const body = await resp.json();
        if (cancelled) return;
        const rows = (body && body.data) ? body.data : null;
        const raw = rows && Array.isArray(rows) && rows.length > 0
          ? rows.map((r, i) => ({ source: r.source || r.issue_type || 'Other', value: Number(r.value || 0), color: pollutionColors[i % pollutionColors.length] }))
          : (rawPollution && Array.isArray(rawPollution) && rawPollution.length > 0 ? rawPollution : defaultPollution);
        const total = raw.reduce((s, p) => s + (Number(p?.value) || 0), 0) || 1;
        const mapped = raw.map((p) => ({ ...p, value: Number(p?.value) || 0, percent: Math.round(((Number(p?.value) || 0) / total) * 100) }));
        setPollutionData(mapped);
      } catch (err) {
        // fallback to inline metrics or defaults
        const raw = (rawPollution && Array.isArray(rawPollution) && rawPollution.length > 0) ? rawPollution : defaultPollution;
        const total = raw.reduce((s, p) => s + (Number(p?.value) || 0), 0) || 1;
        const mapped = raw.map((p) => ({ ...p, value: Number(p?.value) || 0, percent: Math.round(((Number(p?.value) || 0) / total) * 100) }));
        setPollutionData(mapped);
        console.warn('Could not load pollution sources:', err);
      } finally {
        setPollutionLoading(false);
      }
    };

    fetchPollution();
    return () => { cancelled = true; };
  }, [timeRange, rawPollution]);

  useEffect(() => {
    // Fetch weekly reports once on mount (not dependent on timeRange)
    let cancelled = false;
    const fetchWeekly = async () => {
      setWeeklyLoading(true);
      try {
        const resp = await fetch('/api/reports/summary/weekly-reports');
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const body = await resp.json();
        if (cancelled) return;
        const rows = (body && body.data) ? body.data : null;
        const mapped = (rows && Array.isArray(rows) && rows.length > 0)
          ? rows.map((r) => ({ day: r.day || r.label || '', reports: Number(r.reports || 0), resolved: Number(r.resolved || 0) }))
          : [
              { day: 'Mon', reports: 12, resolved: 8 },
              { day: 'Tue', reports: 19, resolved: 15 },
              { day: 'Wed', reports: 8, resolved: 6 },
              { day: 'Thu', reports: 15, resolved: 12 },
              { day: 'Fri', reports: 22, resolved: 18 },
              { day: 'Sat', reports: 6, resolved: 5 },
              { day: 'Sun', reports: 4, resolved: 4 }
            ];
        setWeeklyData(mapped);
      } catch (err) {
        console.warn('Could not load weekly reports:', err);
        setWeeklyData([
          { day: 'Mon', reports: 12, resolved: 8 },
          { day: 'Tue', reports: 19, resolved: 15 },
          { day: 'Wed', reports: 8, resolved: 6 },
          { day: 'Thu', reports: 15, resolved: 12 },
          { day: 'Fri', reports: 22, resolved: 18 },
          { day: 'Sat', reports: 6, resolved: 5 },
          { day: 'Sun', reports: 4, resolved: 4 }
        ]);
      } finally {
        setWeeklyLoading(false);
      }
    };

    fetchWeekly();
    return () => { cancelled = true; };
  }, []);

  

  const chartTypes = [
    { id: 'trends', name: 'Environmental Trends', icon: 'TrendingUp' },
    { id: 'pollution', name: 'Pollution Sources', icon: 'PieChart' },
    { id: 'reports', name: 'Weekly Reports', icon: 'BarChart3' }
  ];

  const timeRanges = [
    { id: '24h', name: '24H' },
    { id: '7d', name: '7D' },
    { id: '30d', name: '30D' },
    { id: '90d', name: '90D' }
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload?.map((entry, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry?.color }}
              />
              <span className="text-muted-foreground">{entry?.dataKey}:</span>
              <span className="font-medium text-foreground">{entry?.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (activeChart) {
      case 'trends':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis 
                dataKey="time" 
                stroke="var(--color-muted-foreground)"
                fontSize={12}
              />
              <YAxis 
                stroke="var(--color-muted-foreground)"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="airQuality" 
                stroke="#059669" 
                strokeWidth={2}
                dot={{ fill: '#059669', strokeWidth: 2, r: 4 }}
                name="Air Quality (AQI)"
              />
              <Line 
                type="monotone" 
                dataKey="pm25" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                name="PM2.5"
              />
              <Line 
                type="monotone" 
                dataKey="temperature" 
                stroke="#F4A261" 
                strokeWidth={2}
                dot={{ fill: '#F4A261', strokeWidth: 2, r: 4 }}
                name="Temperature"
              />
              <Line 
                type="monotone" 
                dataKey="humidity" 
                stroke="#7C3AED" 
                strokeWidth={2}
                dot={{ fill: '#7C3AED', strokeWidth: 2, r: 4 }}
                name="Humidity"
              />
            </LineChart>
          </ResponsiveContainer>
        );

        case 'pollution':
            return (
              <div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pollutionData || defaultPollution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100)?.toFixed(0)}%`}
                    >
                      {(pollutionData || defaultPollution)?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry?.color || pollutionColors[index % pollutionColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(pollutionData || defaultPollution).map((p) => (
                    <div key={p.source} className="flex items-center space-x-2">
                      <div style={{ backgroundColor: p.color }} className="w-3 h-3 rounded-full" />
                      <div className="text-sm text-muted-foreground">{p.source}</div>
                      <div className="ml-auto font-medium text-foreground">{p.percent}%</div>
                    </div>
                  ))}
                </div>
              </div>
            );

    case 'reports':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis 
                dataKey="day" 
                stroke="var(--color-muted-foreground)"
                fontSize={12}
              />
              <YAxis 
                stroke="var(--color-muted-foreground)"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="reports" 
                fill="var(--color-primary)" 
                name="Total Reports"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="resolved" 
                fill="var(--color-success)" 
                name="Resolved"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Data Visualization</h3>
          <div className="flex items-center space-x-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {timeRanges?.map((range) => (
                <button
                  key={range?.id}
                  onClick={() => setTimeRange(range?.id)}
                  className={`px-3 py-1 text-sm font-medium transition-colors duration-200 ${
                    timeRange === range?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {range?.name}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon">
              <Icon name="Download" size={16} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {chartTypes?.map((chart) => (
            <button
              key={chart?.id}
              onClick={() => setActiveChart(chart?.id)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                activeChart === chart?.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Icon name={chart?.icon} size={14} />
              <span>{chart?.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {renderChart()}
      </div>
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {metrics?.last_updated ? `Last update: ${new Date(metrics.last_updated).toLocaleTimeString()}` : 'No data available'}
          </span>
          {loading ? (
            <div className="animate-spin">
              <Icon name="Loader2" size={14} />
            </div>
          ) : (
            <span className="text-muted-foreground">
              {trendsData.length} data points
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartWidget;