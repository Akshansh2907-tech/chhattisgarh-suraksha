import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import Header from '../../components/ui/Header';
import AlertNotificationBar from '../../components/ui/AlertNotificationBar';
import LocationSelector from '../../components/ui/LocationSelector';
import UserStatusIndicator from '../../components/ui/UserStatusIndicator';
import DataLayerToggle from '../../components/ui/DataLayerToggle';
import ErrorBoundary from '../../components/ErrorBoundary';
import MetricsCardLive, { MetricsCard } from './components/MetricsCardLive.jsx';
import MapWidget from './components/MapWidget';
import AlertsWidget from './components/AlertsPanel';
import RecommendationsSection from './components/RecommendationsSection';
import QuickActions from './components/QuickActions';
import CommunityStats from './components/CommunityStats';
import ChartWidget from './components/ChartWidget';
import AchievementsPanel from './components/AchievementsPanel';
import useEnvironmentalData from '../../hooks/useEnvironmentalData';
import { formatDistanceToNow } from 'date-fns';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';

// Helper functions for safe metric processing
const getSeverity = (aqi) => {
  if (aqi == null) return 'neutral';
  if (aqi >= 0 && aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 200) return 'unhealthy';
  return 'hazardous';
};

const getAQDescription = (metrics) => {
  const pm25 = metrics?.pm25 != null ? Number(metrics.pm25 || 0).toFixed(2) : '—';
  const pm10 = metrics?.pm10 != null ? Number(metrics.pm10 || 0).toFixed(2) : '—';
  return `PM2.5 ${pm25} µg/m³ • PM10 ${pm10} µg/m³`;
};

const safeNumber = (value, defaultValue = '—') => {
  return value != null ? Number(value || 0).toFixed(1) : defaultValue;
};

const EnvironmentalDashboard = () => {
  const { metrics, alerts, trends, loading, error, refetch } = useEnvironmentalData();
  
  // Debug logging
  console.log('[Dashboard] State:', {
    metrics: metrics || 'no metrics',
    loading,
    error: error || 'no error',
    alerts: alerts?.length || 0
  });
  const [dataError, setDataError] = useState(null);

  // Effect to handle errors
  useEffect(() => {
    if (error && !loading) {
      // Only set error if it's a critical error
      if (typeof error === 'object' && error.critical) {
        setDataError(error.message);
      } else if (typeof error === 'string' && error.includes('Unable to load')) {
        setDataError(error);
      } else {
        // For non-critical errors, just show a toast
        toast.error(error);
      }
    } else {
      setDataError(null);
    }
  }, [error, loading]);

  // Loading state with skeleton UI that maintains layout
  const loadingMetrics = [{
    title: 'Air Quality Index',
    value: '—',
    unit: 'AQI',
    icon: 'Wind',
    trend: 0,
    severity: 'neutral',
    description: 'Loading data...',
    lastUpdated: 'updating...',
    loading: true
  }, {
    title: 'Temperature',
    value: '—',
    unit: '°C',
    icon: 'Thermometer',
    trend: 0,
    severity: 'neutral',
    description: 'Loading data...',
    lastUpdated: 'updating...',
    loading: true
  }, {
    title: 'Humidity',
    value: '—',
    unit: '%',
    icon: 'Droplets',
    trend: 0,
    severity: 'neutral',
    description: 'Loading data...',
    lastUpdated: 'updating...',
    loading: true
  }, {
    title: 'PM2.5',
    value: '—',
    unit: 'µg/m³',
    icon: 'Activity',
    trend: 0,
    severity: 'neutral',
    description: 'Loading data...',
    lastUpdated: 'updating...',
    loading: true
  }];

  // Handle error state
  if (dataError) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Header />
        <AlertNotificationBar />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-error/5 border border-error/20 rounded-lg p-6 text-center">
            <Icon name="AlertTriangle" size={48} className="text-error mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-error mb-2">Unable to Load Dashboard</h2>
            <p className="text-muted-foreground mb-4">{dataError}</p>
            <Button
              variant="outline"
              onClick={() => {
                setDataError(null);
                refetch();
              }}
              className="border-error text-error hover:bg-error hover:text-error-foreground"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // For initial loading, we'll use the layout with loading metrics
  const isInitialLoading = loading && !metrics;

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success('Data refreshed successfully');
      // notify other parts of the app (if needed)
      window.dispatchEvent(new CustomEvent('cs:data-refreshed'));
    } catch (error) {
      console.error('Refresh failed', error);
      toast.error(error?.message || 'Failed to refresh data');
    }
  };

  const formatLastUpdated = (iso) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch (e) {
      return 'just now';
    }
  };

  // Map backend metrics to card-friendly format with fallback values
  const environmentalMetrics = React.useMemo(() => {
    // If loading or no metrics, return loading state
    if (loading || !metrics) {
      return loadingMetrics;
    }

    // Process metrics if available
    try {
      const lastUpdatedStr = metrics.last_updated ? formatLastUpdated(metrics.last_updated) : 'just now';
      
      return [{
        title: 'Air Quality Index',
        value: typeof metrics.aqi === 'number' ? metrics.aqi.toFixed(0) : '—',
        unit: 'AQI',
        icon: 'Wind',
        trend: 0,
        severity: getSeverity(metrics.aqi),
        description: `NO₂: ${metrics.no2 || 0} • SO₂: ${metrics.so2 || 0} • O₃: ${metrics.o3 || 0}`,
        lastUpdated: lastUpdatedStr
      }, {
        title: 'Temperature',
        value: typeof metrics.temperature === 'number' ? metrics.temperature.toFixed(1) : '—',
        unit: '°C',
        icon: 'Thermometer',
        trend: 0,
        severity: metrics.temperature > 40 ? 'unhealthy' : 'good',
        description: `Pressure: ${metrics.pressure || 0} hPa`,
        lastUpdated: lastUpdatedStr
      }, {
        title: 'Humidity',
        value: typeof metrics.humidity === 'number' ? metrics.humidity.toFixed(0) : '—',
        unit: '%',
        icon: 'Droplets',
        trend: 0,
        severity: 'good',
        description: `Wind: ${metrics.wind_speed || 0} m/s ${metrics.wind_direction || 'N/A'}`,
        lastUpdated: lastUpdatedStr
      }, {
        title: 'PM2.5',
        value: typeof metrics.pm25 === 'number' ? metrics.pm25.toFixed(2) : '—',
        unit: 'µg/m³',
        icon: 'Activity',
        trend: 0,
        severity: (typeof metrics.pm25 === 'number' && metrics.pm25 > 60) ? 'unhealthy' : 'moderate',
        description: `PM10: ${metrics.pm10 || 0} µg/m³`,
        lastUpdated: lastUpdatedStr
      }];
    } catch (error) {
      console.error('Error processing metrics:', error);
      return baseMetrics;
    }
  }, [metrics, loading]);

  return (
    <>
      <Helmet>
        <title>Environmental Dashboard - EcoWatch Urban</title>
        <meta name="description" content="Real-time environmental monitoring dashboard with air quality, noise levels, temperature data, and personalized sustainability recommendations." />
      </Helmet>
  <div className="min-h-screen bg-background pt-16">
        <Header />
        <AlertNotificationBar />
        
        {/* Location and User Status Bar */}
        <div className="bg-card border-b border-border">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <LocationSelector />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={loading}
              >
                <Icon name="RefreshCcw" size={16} className={loading ? 'animate-spin' : ''} />
                <span className="ml-2">{loading ? 'Refreshing...' : 'Refresh Data'}</span>
              </Button>
            </div>
            <UserStatusIndicator />
          </div>
        </div>

          {/* Dashboard Content */}
          <div className="p-4 lg:p-6 space-y-6">
              {/* Environmental Metrics Grid */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4">Real-time Environmental Data</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {environmentalMetrics.map((metric, index) => (
                  <MetricsCard
                    key={`metric-${index}`}
                    {...metric}
                    loading={loading}
                  />
                ))}
              </div>
            </section>            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left Column - Map and Charts */}
              <div className="xl:col-span-2 space-y-6">
                <React.Suspense fallback={
                  <div className="h-64 bg-card border border-border rounded-lg animate-pulse" />
                }>
                  <MapWidget metrics={metrics} loading={loading} alerts={alerts} />
                </React.Suspense>
                <React.Suspense fallback={
                  <div className="h-64 bg-card border border-border rounded-lg animate-pulse" />
                }>
                  <ChartWidget metrics={metrics} trends={trends} loading={loading} />
                </React.Suspense>
              </div>

              {/* Right Column - Alerts and Additional Info */}
              <div className="space-y-6">
                <React.Suspense fallback={
                  <div className="h-64 bg-card border border-border rounded-lg animate-pulse" />
                }>
                  <AlertsWidget alerts={alerts} loading={loading} />
                </React.Suspense>
              </div>
            </div>

            {/* Quick Actions */}
            <section>
              <QuickActions />
            </section>

            {/* Community Statistics */}
            <section>
              <CommunityStats />
            </section>
          </div>

        {/* Data Layer Toggle (Fixed Position) */}
        <DataLayerToggle />
      </div>
    </>
  );
};

// Error boundary HOC
const withErrorBoundary = (WrappedComponent) => {
  return class extends React.Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    componentDidCatch(error, info) {
      console.error('Dashboard Error:', error, info);
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="min-h-screen bg-background pt-16">
            <Header />
            <div className="container mx-auto px-4 py-8">
              <div className="bg-error/5 border border-error/20 rounded-lg p-6 text-center">
                <Icon name="AlertTriangle" size={48} className="text-error mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-error mb-2">Dashboard Error</h2>
                <p className="text-muted-foreground mb-4">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="border-error text-error hover:bg-error hover:text-error-foreground"
                >
                  Reload Page
                </Button>
              </div>
            </div>
          </div>
        );
      }

      return <WrappedComponent {...this.props} />;
    }
  };
};

export default withErrorBoundary(EnvironmentalDashboard);