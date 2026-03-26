import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import ReportMap from '../../../components/ReportMap';
import { reportService } from '../../../utils/report';
import { metricsAPI } from '../../../utils/api';
import { useNavigate } from 'react-router-dom';

const MapContainer = ({ activeLayers, selectedArea, onAreaSelect, searchLocation, onMarkerClick }) => {
  const mapRef = useRef(null);
  // Default to Raipur, Chhattisgarh
  const [mapCenter, setMapCenter] = useState({ lat: 21.2514, lng: 81.6296 });
  const [zoomLevel, setZoomLevel] = useState(13);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState(null);

  const [sensorData, setSensorData] = useState([]);
  const [citizenReports, setCitizenReports] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (searchLocation) {
      // Simulate geocoding and map centering
      setMapCenter({ lat: searchLocation?.lat, lng: searchLocation?.lng });
      setZoomLevel(15);
    }
  }, [searchLocation]);

  // Load real reports and sensor data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Limit to Raipur area by default to reduce server load
        const raipurBounds = [21.2, 81.55, 21.3, 81.7];
        const reports = await reportService.getAllReports(raipurBounds);
        // reports may come with location as "lat,lon|address" or coordinates
        const parsed = (reports || []).map(r => {
          let lat = null, lng = null;
          if (r.coordinates) {
            // coerce to numbers and validate
            const maybeLat = Number(r.coordinates.lat);
            const maybeLng = Number(r.coordinates.lon);
            if (Number.isFinite(maybeLat) && Number.isFinite(maybeLng)) {
              lat = maybeLat; lng = maybeLng;
            }
          } else if (r.location && typeof r.location === 'string') {
            const loc = r.location.split('|')[0];
            const parts = loc.split(',').map(Number);
            if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
              lat = parts[0]; lng = parts[1];
            }
          } else if (r.location && r.location.latitude) {
            const maybeLat = Number(r.location.latitude);
            const maybeLng = Number(r.location.longitude || r.location.lng);
            if (Number.isFinite(maybeLat) && Number.isFinite(maybeLng)) {
              lat = maybeLat; lng = maybeLng;
            }
          }
          return {
            id: r.id,
            lat,
            lng,
            issueType: r.issueType || r.type || r.issue_type,
            severity: r.severity,
            description: r.description,
            reporter_name: r.reporter_name || (r.additionalData && r.additionalData.reporter_name) || null,
            timestamp: r.timestamp || (r.additionalData && r.additionalData.timestamp) || r.created_at,
            raw: r
          };
        })
          // remove entries with null/undefined and also filter NaN/infinite and out-of-range coords
          .filter(x => x.lat != null && x.lng != null && Number.isFinite(x.lat) && Number.isFinite(x.lng) && x.lat >= -90 && x.lat <= 90 && x.lng >= -180 && x.lng <= 180);
        setCitizenReports(parsed);
      } catch (err) {
        console.error('Failed to load citizen reports:', err);
      }

      try {
        const m = await metricsAPI.getCurrentMetrics();
        // metricsAPI returns structure: { data: { ... } } in some cases; normalize
        const data = m?.data || m;
        // build a simple sensorData array if available
        const sensors = [];
        if (data?.sensors && Array.isArray(data.sensors)) {
          data.sensors.forEach((s, idx) => {
            sensors.push({ id: idx + 1, type: s.type || 'air_quality', lat: s.latitude, lng: s.longitude, value: s.value, status: s.status || 'normal', timestamp: s.timestamp, readings: s.readings });
          });
        }
        setSensorData(sensors);
      } catch (err) {
        console.warn('Failed to load sensor data:', err);
      }
    };
    loadData();
  }, []);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 1, 18));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 1, 8));
  };

  const handleDrawingToggle = (mode) => {
    if (drawingMode === mode) {
      setDrawingMode(null);
      setIsDrawing(false);
    } else {
      setDrawingMode(mode);
      setIsDrawing(true);
    }
  };

  const getMarkerColor = (type, status) => {
    const colors = {
      air_quality: { good: '#059669', moderate: '#F4A261', poor: '#DC2626' },
      water_quality: { good: '#4A90A4', moderate: '#D97706', poor: '#DC2626' },
      noise_levels: { low: '#059669', medium: '#F4A261', high: '#DC2626' },
      temperature: { normal: '#4A90A4', high: '#DC2626', low: '#2D5A27' }
    };
    return colors?.[type]?.[status] || '#6B7280';
  };

  const getReportColor = (severity) => {
    const colors = { low: '#059669', medium: '#F4A261', high: '#DC2626' };
    return colors?.[severity] || '#6B7280';
  };

  // We no longer manually render absolute markers here — ReportMap will render markers

  return (
    <div className="relative w-full h-full bg-muted overflow-hidden">
      {/* Map Container */}
      <div 
        ref={mapRef}
        className="w-full h-full relative"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23E5E7EB' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          cursor: isDrawing ? 'crosshair' : 'grab'
        }}
      >
        {/* Interactive Leaflet Map */}
        <div className="absolute inset-0">
          <ReportMap
            reports={citizenReports.map(r => ({
              id: r.id,
              location: { latitude: r.lat, longitude: r.lng },
              issueType: r.issueType,
              description: r.description,
              reporter_name: r.reporter_name,
              timestamp: r.timestamp
            }))}
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={zoomLevel}
            onMarkerClick={(r) => onMarkerClick && onMarkerClick(r)}
          />
        </div>
      </div>
      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2">
        {/* Zoom Controls */}
        <div className="bg-card border border-border rounded-lg shadow-lg">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="rounded-b-none border-b border-border"
          >
            <Icon name="Plus" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="rounded-t-none"
          >
            <Icon name="Minus" size={16} />
          </Button>
        </div>

        {/* Drawing Tools */}
        <div className="bg-card border border-border rounded-lg shadow-lg p-2">
          <div className="flex flex-col space-y-1">
            <Button
              variant={drawingMode === 'rectangle' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => handleDrawingToggle('rectangle')}
              title="Select rectangular area"
            >
              <Icon name="Square" size={16} />
            </Button>
            <Button
              variant={drawingMode === 'circle' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => handleDrawingToggle('circle')}
              title="Select circular area"
            >
              <Icon name="Circle" size={16} />
            </Button>
            <Button
              variant={drawingMode === 'polygon' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => handleDrawingToggle('polygon')}
              title="Select custom area"
            >
              <Icon name="Pentagon" size={16} />
            </Button>
          </div>
        </div>
      </div>
      {/* Map Info */}
      <div className="absolute bottom-4 left-4 bg-card border border-border rounded-lg shadow-lg p-3">
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <Icon name="MapPin" size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">
              {mapCenter?.lat?.toFixed(4)}, {mapCenter?.lng?.toFixed(4)}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Icon name="ZoomIn" size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">Zoom: {zoomLevel}</span>
          </div>
        </div>
      </div>
      {/* Drawing Mode Indicator */}
      {isDrawing && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <Icon name="MousePointer" size={16} />
            <span className="text-sm font-medium">
              Drawing mode: {drawingMode} - Click and drag to select area
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapContainer;