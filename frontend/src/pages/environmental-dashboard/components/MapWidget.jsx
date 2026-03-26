import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import ReportMap from '../../../components/ReportMap';
import { useNavigate } from 'react-router-dom';
import { environmentalAPI } from '../../../utils/environmental';
import { reportService } from '../../../utils/report';

const MapWidget = ({ metrics, loading, alerts = [] }) => {
  const [selectedLayer, setSelectedLayer] = useState('air_quality');
  const [center, setCenter] = useState({ lat: 21.2514, lon: 81.6296 });
  const [zoom, setZoom] = useState(13);
  const [rotation, setRotation] = useState(0);
  const [localMetrics, setLocalMetrics] = useState(metrics);
  const [reports, setReports] = useState([]);
  const iframeRef = useRef(null);
  const navigate = useNavigate();

  const dataLayers = [
    { id: 'air_quality', name: 'Air Quality', icon: 'Wind', color: '#059669', value: metrics?.aqi, unit: 'AQI' },
    { id: 'temperature', name: 'Temperature', icon: 'Thermometer', color: '#F4A261', value: metrics?.temperature, unit: '°C' },
    { id: 'humidity', name: 'Humidity', icon: 'Droplets', color: '#3B82F6', value: metrics?.humidity, unit: '%' }
  ];

  const getSeverity = (metricId, m = localMetrics) => {
    switch (metricId) {
      case 'air_quality':
        if (m?.aqi <= 50) return 'low';
        if (m?.aqi <= 100) return 'moderate';
        return 'high';
      case 'temperature':
        if (m?.temperature <= 25) return 'low';
        if (m?.temperature <= 35) return 'moderate';
        return 'high';
      case 'humidity':
        if (m?.humidity <= 40) return 'low';
        if (m?.humidity <= 70) return 'moderate';
        return 'high';
      default:
        return 'moderate';
    }
  };

  // Helper to rebuild iframe src based on center/zoom
  const buildMapSrc = (lat, lon, z) => `https://www.google.com/maps?q=${lat},${lon}&z=${z}&output=embed`;

  // Listen for location changes from LocationSelector
  useEffect(() => {
    const onLocationChanged = async (e) => {
      const loc = e?.detail;
      if (!loc) return;
      const [lat, lon] = loc?.coordinates || loc?.coords || [21.2514, 81.6296];
      setCenter({ lat, lon });
      // fetch local metrics for this location
      try {
        const res = await environmentalAPI.getCurrentMetrics(Number(lat), Number(lon));
        if (res?.data?.success) setLocalMetrics(res.data.data);
      } catch (err) {
        console.warn('Failed to fetch local metrics for map center:', err);
      }
    };

    window.addEventListener('cs:location-changed', onLocationChanged);
    return () => window.removeEventListener('cs:location-changed', onLocationChanged);
  }, []);

  // Update iframe src when center or zoom changes
  useEffect(() => {
    if (iframeRef?.current) {
      iframeRef.current.src = buildMapSrc(center.lat, center.lon, zoom);
    }
  }, [center, zoom]);

  // Initialize local metrics when props.metrics changes (fallback)
  useEffect(() => {
    setLocalMetrics(metrics);
  }, [metrics]);

  // Fetch reports from blockchain
  useEffect(() => {
    const fetchReports = async () => {
      try {
        // Limit to Raipur area to reduce server load
        const raipurBounds = [21.2, 81.55, 21.3, 81.7];
        const reports = await reportService.getAllReports(raipurBounds);
        setReports(reports.map(report => {
          // report.location may be a string "lat,lon|address" or "lat,lon"
          let lat = null, lon = null;
          try {
            if (typeof report.location === 'string') {
              const locPart = report.location.split('|')[0];
              const parts = locPart.split(',').map(Number);
              lat = parts[0];
              lon = parts[1];
            } else if (report.location && report.location.latitude) {
              lat = Number(report.location.latitude);
              lon = Number(report.location.longitude || report.location.lng);
            }
          } catch (e) {
            console.warn('Failed to parse report location', e);
          }

          return {
            ...report,
            coordinates: { lat, lon }
          };
        }));
      } catch (err) {
        console.error('Failed to fetch reports:', err);
      }
    };
    fetchReports();
  }, []);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Environmental Map</h3>
          <Button variant="outline" size="sm">
            <Icon name="Maximize2" size={16} />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {dataLayers?.map((layer) => (
            <button
              key={layer?.id}
              onClick={() => setSelectedLayer(layer?.id)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                selectedLayer === layer?.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Icon name={layer?.icon} size={14} />
              <span>{layer?.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-80 bg-muted">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin text-primary">
              <Icon name="Loader2" size={24} />
            </div>
          </div>
            ) : (
              <div className="h-full">
                <ReportMap reports={reports} center={[center.lat, center.lon]} zoom={zoom} />
              </div>
            )}
        
        {/* Overlay Controls */}
        <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-2 space-y-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(20, z + 1))} aria-label="Zoom in">
            <Icon name="Plus" size={16} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(1, z - 1))} aria-label="Zoom out">
            <Icon name="Minus" size={16} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRotation(r => (r + 90) % 360)} aria-label="Rotate map">
            <Icon name="RotateCcw" size={16} />
          </Button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 max-w-sm">
          <h4 className="text-sm font-medium text-foreground mb-2">Hotspots</h4>
          <div className="space-y-1">
            {/* Risks/Alerts */}
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-error"></div>
              <span className="text-xs text-muted-foreground">High Risk ({reports.filter(r => r.severity === 'critical' || r.severity === 'high').length})</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-warning"></div>
              <span className="text-xs text-muted-foreground">Moderate ({reports.filter(r => r.severity === 'moderate').length})</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-success"></div>
              <span className="text-xs text-muted-foreground">Low Risk ({reports.filter(r => r.severity === 'low').length})</span>
            </div>
            {/* Issue Types */}
            <div className="mt-3 pt-2 border-t border-border">
              <div className="text-xs font-medium text-foreground mb-1">Report Types:</div>
              {Object.entries(reports.reduce((acc, r) => {
                acc[r.issueType] = (acc[r.issueType] || 0) + 1;
                return acc;
              }, {})).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{type}</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-6">
            <div>
              <div className="text-muted-foreground">Showing</div>
              <div className="font-medium">{alerts?.length ?? 0} alerts, {reports.length} reports</div>
            </div>
            <div>
              <div className="text-muted-foreground">Center</div>
              <div className="font-medium">{center.lat.toFixed(4)}, {center.lon.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Zoom</div>
              <div className="font-medium">{zoom}</div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button className="text-primary hover:text-primary/80 font-medium" onClick={() => navigate('/environmental-dashboard/map')}>
              View Full Map →
            </button>
            <Button variant="ghost" size="sm" onClick={async () => {
              // center map and refresh local metrics
              try {
                const res = await environmentalAPI.getCurrentMetrics(center.lat, center.lon);
                if (res?.data?.success) setLocalMetrics(res.data.data);
              } catch (e) { console.warn(e); }
            }}>
              Refresh Map Data
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapWidget;