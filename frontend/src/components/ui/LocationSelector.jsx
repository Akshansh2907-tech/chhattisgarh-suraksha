import React, { useState, useEffect, useRef } from 'react';
import Icon from '../AppIcon';
import Button from './Button';

import { useLocation } from '../../contexts/LocationContext';

const LocationSelector = () => {
  const { currentLocation, setCurrentLocation } = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const dropdownRef = useRef(null);

  // Districts / areas focused on Raipur (Chhattisgarh) - prototyping list
  const savedLocations = [
    { id: 1, name: 'Raipur - Civil Lines', type: 'district', coordinates: [21.2379, 81.6330] },
    { id: 2, name: 'Raipur - Pandri', type: 'district', coordinates: [21.2333, 81.6336] },
    { id: 3, name: 'Raipur - Gevra Road / G.E. Road', type: 'district', coordinates: [21.2450, 81.6290] },
    { id: 4, name: 'Raipur - Telibandha', type: 'district', coordinates: [21.2590, 81.6230] },
    { id: 5, name: 'Raipur - Sunder Nagar', type: 'residential', coordinates: [21.2310, 81.6380] },
    { id: 6, name: 'Raipur - Bhatagaon', type: 'residential', coordinates: [21.2660, 81.6110] },
    { id: 7, name: 'Raipur - City Center', type: 'district', coordinates: [21.2514, 81.6296] },
    { id: 8, name: 'Raipur - Dudhadhari', type: 'district', coordinates: [21.2435, 81.6315] }
  ];

  const filteredLocations = savedLocations?.filter(location =>
    location?.name?.toLowerCase()?.includes(searchQuery?.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef?.current && !dropdownRef?.current?.contains(event?.target)) {
        setIsDropdownOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocationSelect = (location) => {
    // store the full location object in context
    setCurrentLocation(location);
    setIsDropdownOpen(false);
    setSearchQuery('');
    window.dispatchEvent(new CustomEvent('cs:location-changed', { detail: location }));
  };

  const detectCurrentLocation = async () => {
    setIsDetectingLocation(true);
    
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      
      // Find closest saved location or use exact coordinates
      const closestLocation = savedLocations.reduce((closest, location) => {
        const distance = Math.sqrt(
          Math.pow(location.coordinates[0] - latitude, 2) + 
          Math.pow(location.coordinates[1] - longitude, 2)
        );
        
        if (!closest || distance < closest.distance) {
          return { ...location, distance };
        }
        return closest;
      }, null);

      const detectedLocation = closestLocation ? {
        ...closestLocation,
        type: 'gps',
        originalCoords: [latitude, longitude]
      } : {
        id: 'current',
        name: `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
        type: 'gps',
        coordinates: [latitude, longitude]
      };
      
      // store full object
      setCurrentLocation(detectedLocation);
      setIsDropdownOpen(false);
      window.dispatchEvent(new CustomEvent('cs:location-changed', { detail: detectedLocation }));
    } catch (error) {
      console.error('Failed to detect location:', error);
      alert('Could not access your location. Please check your browser permissions and try again.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const getLocationIcon = (type) => {
    switch (type) {
      case 'park':
        return 'Trees';
      case 'industrial':
        return 'Factory';
      case 'residential':
        return 'Home';
      case 'waterfront':
        return 'Waves';
      case 'educational':
        return 'GraduationCap';
      case 'gps':
        return 'Navigation';
      default:
        return 'MapPin';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 min-w-0 max-w-48"
      >
        <Icon name="MapPin" size={16} className="text-primary flex-shrink-0" />
        <span className="truncate text-sm font-medium">{currentLocation?.name || 'Select location'}</span>
        <Icon 
          name="ChevronDown" 
          size={16} 
          className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
        />
      </Button>
      {isDropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-elevated z-50 min-w-80">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Icon name="Search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e?.target?.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="p-2">
            {/* GPS Detection */}
            <button
              onClick={detectCurrentLocation}
              disabled={isDetectingLocation}
              className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-left hover:bg-muted rounded-md transition-colors duration-200 disabled:opacity-50"
            >
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                <Icon 
                  name={isDetectingLocation ? "Loader2" : "Navigation"} 
                  size={16} 
                  className={`text-primary ${isDetectingLocation ? 'animate-spin' : ''}`} 
                />
              </div>
              <div className="flex-1">
                <div className="font-medium">
                  {isDetectingLocation ? 'Detecting location...' : 'Use current location'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isDetectingLocation ? 'Please wait' : 'Detect via GPS'}
                </div>
              </div>
            </button>

            {/* Saved Locations */}
            <div className="mt-2">
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Saved Locations
              </div>
              {filteredLocations?.length > 0 ? (
                filteredLocations?.map((location) => (
                  <button
                    key={location?.id}
                    onClick={() => handleLocationSelect(location)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 text-sm text-left hover:bg-muted rounded-md transition-colors duration-200 ${
                      currentLocation?.id === location?.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                      <Icon name={getLocationIcon(location?.type)} size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{location?.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {location?.type} • {location?.coordinates?.[0]?.toFixed(4)}, {location?.coordinates?.[1]?.toFixed(4)}
                      </div>
                    </div>
                    {currentLocation?.id === location?.id && (
                      <Icon name="Check" size={16} className="text-primary" />
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  No locations found matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;