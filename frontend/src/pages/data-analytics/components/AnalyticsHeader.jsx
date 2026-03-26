import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import api from '../../../utils/api';

const AnalyticsHeader = ({ onTimeRangeChange, onDataTypeChange, onExportData }) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [selectedDataType, setSelectedDataType] = useState('all');
  const [communityStats, setCommunityStats] = useState({
    impactPoints: 0,
    reportsCount: 0,
    location: 'Raipur, Chhattisgarh'
  });

  useEffect(() => {
    const fetchCommunityStats = async () => {
      try {
        const response = await api.get('/community/stats');
        if (response?.data?.success) {
          setCommunityStats({
            impactPoints: response.data.data.impactPoints || 0,
            reportsCount: response.data.data.reportsCount || 0,
            location: response.data.data.location || 'Raipur, Chhattisgarh'
          });
        }
      } catch (error) {
        console.error('Failed to fetch community stats:', error);
      }
    };

    fetchCommunityStats();
  }, []);

  const timeRangeOptions = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const dataTypeOptions = [
    { value: 'all', label: 'All Environmental Data' },
    { value: 'air_quality', label: 'Air Quality' },
    { value: 'water_quality', label: 'Water Quality' },
    { value: 'noise_levels', label: 'Noise Levels' },
    { value: 'temperature', label: 'Temperature' },
    { value: 'emissions', label: 'Emissions' },
    { value: 'vegetation', label: 'Vegetation Index' }
  ];

  const handleTimeRangeChange = (value) => {
    setSelectedTimeRange(value);
    onTimeRangeChange(value);
  };

  const handleDataTypeChange = (value) => {
    setSelectedDataType(value);
    onDataTypeChange(value);
  };

  return (
    <div className="bg-card border-b border-border p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Environmental Data Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive analysis tools for environmental monitoring and research
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            options={timeRangeOptions}
            value={selectedTimeRange}
            onChange={handleTimeRangeChange}
            placeholder="Select time range"
            className="min-w-40"
          />

          <Select
            options={dataTypeOptions}
            value={selectedDataType}
            onChange={handleDataTypeChange}
            placeholder="Select data type"
            className="min-w-48"
          />

          <Button
            variant="outline"
            iconName="Download"
            iconPosition="left"
            onClick={onExportData}
          >
            Export Data
          </Button>

          <Button
            variant="default"
            iconName="RefreshCw"
            iconPosition="left"
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Icon name="Clock" size={16} />
          <span>Last updated: 2 minutes ago</span>
        </div>
        <div className="flex items-center gap-1">
          <Icon name="Database" size={16} />
          <span>{communityStats.impactPoints.toLocaleString()} impact points</span>
        </div>
        <div className="flex items-center gap-1">
          <Icon name="MapPin" size={16} />
          <span>{communityStats.location}</span>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsHeader;