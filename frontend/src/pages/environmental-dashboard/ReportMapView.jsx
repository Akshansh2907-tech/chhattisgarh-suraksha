import React, { useState, useEffect } from 'react';
import { reportService } from '../../utils/report';
import ReportMap from '../../components/ReportMap';
import Icon from '../../components/AppIcon';
import Header from '../../components/ui/Header';
import AlertNotificationBar from '../../components/ui/AlertNotificationBar';

const ReportMapView = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      // Limit markers to Raipur region by default to reduce server load
      const raipurBounds = [21.2, 81.55, 21.3, 81.7]; // [swLat, swLng, neLat, neLng]
      const data = await reportService.getAllReports(raipurBounds);
      setReports(data);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => {
    if (filter !== 'all' && report.issueType !== filter) return false;
    
    if (timeRange === 'today') {
      return new Date(report.timestamp).toDateString() === new Date().toDateString();
    }
    if (timeRange === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(report.timestamp) >= weekAgo;
    }
    if (timeRange === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return new Date(report.timestamp) >= monthAgo;
    }
    
    return true;
  });

  const issueTypes = [
    { id: 'air_pollution', name: 'Air Pollution', icon: 'Wind', color: '#DC2626' },
    { id: 'water_pollution', name: 'Water Pollution', icon: 'Droplets', color: '#4A90A4' },
    { id: 'noise_pollution', name: 'Noise Pollution', icon: 'Volume2', color: '#D97706' },
    { id: 'litter_waste', name: 'Litter & Waste', icon: 'Trash2', color: '#6B7280' },
    { id: 'green_space_damage', name: 'Green Space Damage', icon: 'Trees', color: '#2D5A27' },
    { id: 'wildlife_concern', name: 'Wildlife Concern', icon: 'Bird', color: '#059669' },
    { id: 'infrastructure', name: 'Infrastructure Issues', icon: 'Construction', color: '#7C3AED' },
    { id: 'other', name: 'Other Issues', icon: 'AlertTriangle', color: '#F4A261' }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AlertNotificationBar />
      <div className="pt-16">
        <div className="h-[calc(100vh-4rem)]">
          <div className="h-full flex flex-col">
            {/* Filters Bar */}
            <div className="bg-card border-b border-border p-4">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="bg-background border border-input px-3 py-1 rounded-md text-sm"
                  >
                    <option value="all">All Issues</option>
                    {issueTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                  
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="bg-background border border-input px-3 py-1 rounded-md text-sm"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">Past Week</option>
                    <option value="month">Past Month</option>
                  </select>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {filteredReports.length} reports shown
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="flex-1 relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Icon name="Loader2" className="animate-spin" />
                    <span>Loading reports...</span>
                  </div>
                </div>
              ) : (
                <ReportMap reports={filteredReports} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportMapView;