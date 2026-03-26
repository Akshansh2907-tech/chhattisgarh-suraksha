import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../AppIcon';
import Button from './Button';
import { metricsAPI, auth } from '../../utils/api';
import { toast } from 'sonner';
import { useWebSocket } from '../../hooks/useWebSocket';

const AlertNotificationBar = () => {
  const [alerts, setAlerts] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Set up WebSocket connection with authentication token
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws?token=${auth.getToken()}`;
  
  const { isConnected } = useWebSocket(wsUrl, {
    onMessage: (data) => {
      if (data.type === 'alert') {
        setAlerts(prev => {
          const newAlerts = [...prev];
          const existingIndex = newAlerts.findIndex(a => a.id === data.alert.id);
          
          if (existingIndex >= 0) {
            newAlerts[existingIndex] = data.alert;
          } else {
            newAlerts.unshift(data.alert);
            toast.message(data.alert.title, {
              description: data.alert.message
            });
          }
          
          return newAlerts;
        });
        setIsVisible(true);
      }
    }
  });

  const fetchAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await metricsAPI.getActiveAlerts();
      if (response?.data) {
        setAlerts(response.data);
        setIsVisible(response.data.length > 0);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      toast.error('Unable to load alerts. Will retry soon.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch once
    fetchAlerts();

    // Fallback polling in case WebSocket is not connected.
    // Use a conservative interval (60s) to avoid aggressive polling when disconnected.
    let pollInterval = null;
    if (!isConnected) {
      pollInterval = setInterval(() => {
        // Only poll when disconnected to avoid duplication when WS is active
        if (!isConnected) fetchAlerts();
      }, 60000); // 60s
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [fetchAlerts, isConnected]);

  useEffect(() => {
    if (alerts?.length > 1) {
      const interval = setInterval(() => {
        setCurrentAlertIndex((prev) => (prev + 1) % alerts?.length);
      }, 5000); // Rotate every 5 seconds

      return () => clearInterval(interval);
    }
  }, [alerts?.length]);

  const getAlertStyles = (type) => {
    switch (type) {
      case 'error':
        return 'bg-error text-error-foreground border-error';
      case 'warning':
        return 'bg-warning text-warning-foreground border-warning';
      case 'success':
        return 'bg-success text-success-foreground border-success';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'error':
        return 'AlertTriangle';
      case 'warning':
        return 'AlertCircle';
      case 'success':
        return 'CheckCircle';
      default:
        return 'Info';
    }
  };

  const dismissAlert = () => {
    setIsVisible(false);
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const ts = new Date(timestamp);
    const diff = now - ts;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="fixed top-16 left-0 right-0 z-[999] border-b transition-all duration-300 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-center px-4 py-2">
          <Icon name="Loader2" size={16} className="animate-spin mr-2" />
          <span className="text-sm">Loading alerts...</span>
        </div>
      </div>
    );
  }

  if (!isVisible || alerts?.length === 0) {
    return null;
  }

  const currentAlert = alerts?.[currentAlertIndex];

  return (
    <div className={`fixed top-16 left-0 right-0 z-[999] border-b transition-all duration-300 ${getAlertStyles(currentAlert?.type)}`}>
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <Icon name={getAlertIcon(currentAlert?.type)} size={20} className="flex-shrink-0" />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-medium text-sm truncate">{currentAlert?.title}</h4>
              <span className="text-xs opacity-75 flex-shrink-0">
                {formatTimeAgo(currentAlert?.timestamp)}
              </span>
            </div>
            <p className="text-sm opacity-90 line-clamp-1">{currentAlert?.message}</p>
            <div className="flex items-center space-x-2 mt-1">
              <Icon name="MapPin" size={12} className="opacity-75" />
              <span className="text-xs opacity-75">{currentAlert?.location}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {/* Alert Counter */}
          {alerts?.length > 1 && (
            <div className="hidden sm:flex items-center space-x-1 text-xs opacity-75">
              <span>{currentAlertIndex + 1}</span>
              <span>/</span>
              <span>{alerts?.length}</span>
            </div>
          )}

          {/* Navigation Dots */}
          {alerts?.length > 1 && (
            <div className="hidden sm:flex items-center space-x-1">
              {alerts?.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentAlertIndex(index)}
                  className={`w-2 h-2 rounded-full transition-opacity duration-300 ${
                    index === currentAlertIndex ? 'opacity-100' : 'opacity-50'
                  } bg-current`}
                  aria-label={`View alert ${index + 1}`}
                />
              ))}
            </div>
          )}

          {/* Dismiss Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={dismissAlert}
            className="h-6 w-6 text-current hover:bg-black/10"
            aria-label="Dismiss alert"
          >
            <Icon name="X" size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AlertNotificationBar;