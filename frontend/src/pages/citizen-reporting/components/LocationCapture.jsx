import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const LocationCapture = ({ location, onLocationChange }) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [manualAddress, setManualAddress] = useState(location?.address || '');
  const [useManualAddress, setUseManualAddress] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const acTimeout = useRef(null);

  useEffect(() => {
    if (location?.address) {
      setManualAddress(location.address);
    }
  }, [location]);

  const handleLocationError = (error) => {
    console.error('Location error:', error);
    let errorType = 'unknown';
    let message = 'Could not detect your location. ';
    
    if (error.code === 1) { // PERMISSION_DENIED
      errorType = 'permission_denied';
      message += 'Please check browser location permissions.';
    } else if (error.code === 2) { // POSITION_UNAVAILABLE
      errorType = 'position_unavailable';
      message += 'Try disabling VPN if you\'re using one.';
    } else if (error.code === 3) { // TIMEOUT
      errorType = 'timeout';
      message += 'Detection timed out. Try again or enter manually.';
    }
    
    alert(message);
    setLocationError(errorType);
    setUseManualAddress(true);
    setIsDetecting(false);
  };

  const detectLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    // Check for internet connectivity
    if (!navigator.onLine) {
      alert('Please check your internet connection. Location detection requires internet access.');
      return;
    }

    setIsDetecting(true);
    setSuggestions([]);
    setLocationError(null);

    // Check if running on desktop/laptop
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('Device type:', isMobile ? 'mobile' : 'desktop');

    const options = {
      enableHighAccuracy: true,
      timeout: isMobile ? 20000 : 10000,
      maximumAge: 0
    };

    try {
      // Show user that we're accessing their location
      const positionPromise = new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });
      
      // Add a user-friendly timeout message
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Location detection is taking longer than usual. Please ensure your GPS is enabled.'));
        }, options.timeout);
      });
      
      const position = await Promise.race([positionPromise, timeoutPromise]);

      const { latitude, longitude, accuracy } = position.coords;
      console.log('Location detected:', { latitude, longitude, accuracy });

      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
        const response = await fetch(url, {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'ChhatisgarhSuraksha/1.0'
          }
        });

        if (!response.ok) {
          throw new Error('Geocoding request failed');
        }

        const data = await response.json();
        console.log('Geocoding response:', data);

        // Verify location is in Chhattisgarh using stricter bounds
        const lat = parseFloat(data.lat);
        const lon = parseFloat(data.lon);
        const isInRegion = data.address && 
          (data.address.state === 'Chhattisgarh' || 
           data.address.city === 'Raipur' ||
           data.display_name.includes('Chhattisgarh')) &&
          // Check if coordinates are within Chhattisgarh bounds
          lat >= 17.46 && lat <= 24.45 && 
          lon >= 80.15 && lon <= 84.39;

        if (!isInRegion) {
          console.warn('Location outside Chhattisgarh:', data.display_name);
          const tryManual = window.confirm(
            'The detected location appears to be outside Chhattisgarh.\n\n' +
            'This often happens when:\n' +
            '• Your device is using IP-based location\n' +
            '• You have VPN enabled\n' +
            '• GPS signal is weak\n\n' +
            'Would you like to manually enter your location in Raipur/Chhattisgarh?'
          );

          if (tryManual) {
            setUseManualAddress(true);
            setManualAddress('Raipur, Chhattisgarh');
            handleManualAddressChange({ target: { value: 'Raipur, Chhattisgarh' } });
          }
          setLocationError('outside_region');
          return;
        }

        const detected = {
          latitude,
          longitude,
          address: data.display_name,
          accuracy: Math.round(accuracy),
          source: 'gps'
        };

        onLocationChange(detected);
        setManualAddress(data.display_name);
        setUseManualAddress(false);
        setLocationError(null);

      } catch (geocodeError) {
        console.error('Geocoding failed:', geocodeError);
        setLocationError('geocoding_failed');
        alert('Could not determine your address. Please try entering it manually.');
        setUseManualAddress(true);
      }
    } catch (geoError) {
      handleLocationError(geoError);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleManualAddressChange = (e) => {
    const address = e?.target?.value;
    setManualAddress(address);
    setUseManualAddress(true);
    setLocationError(null);

    // Clear previous timeout
    if (acTimeout.current) {
      clearTimeout(acTimeout.current);
    }

    // Don't search if input is too short
    if (!address || address.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    // Debounced search
    acTimeout.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        // Focus search on Chhattisgarh region with more precise bounding box
        const q = encodeURIComponent(address.trim());
        // Chhattisgarh bounding box coordinates
        const bbox = '80.15,17.46,84.39,24.45'; // [min_lon,min_lat,max_lon,max_lat]
        const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&addressdetails=1&limit=5&countrycodes=in&bounded=1&viewbox=${bbox}&bounded=1`;
        
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'ChhatisgarhSuraksha/1.0'
          }
        });

        if (!res.ok) {
          throw new Error('Search request failed');
        }

        const data = await res.json();
        
        // Filter to only show Chhattisgarh results
        const inState = (data || []).filter(item => 
          item.address?.state === 'Chhattisgarh' ||
          item.display_name.includes('Chhattisgarh')
        );

        const suggestions = inState.map(item => ({
          display_name: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          type: item.type
        }));

        setSuggestions(suggestions);
      } catch (err) {
        console.error('Address search failed:', err);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 400);
  };

  const handleSelectSuggestion = (suggestion) => {
    setManualAddress(suggestion.display_name);
    setSuggestions([]);
    setUseManualAddress(true);
    setLocationError(null);

    const location = {
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      address: suggestion.display_name,
      accuracy: null,
      source: 'manual'
    };
    
    onLocationChange(location);
  };

  const getLocationErrorMessage = () => {
    switch (locationError) {
      case 'permission_denied':
        return 'Location access denied. Check browser settings.';
      case 'position_unavailable':
        return 'Could not get location. Try disabling VPN if using one.';
      case 'timeout':
        return 'Location detection timed out. Try again or enter manually.';
      case 'outside_region':
        return 'Location appears to be outside Chhattisgarh. Please verify your location settings.';
      case 'geocoding_failed':
        return 'Could not determine the address. Please enter it manually.';
      default:
        return locationError ? 'Location detection failed. Please try again.' : '';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Location</h3>
        <p className="text-sm text-muted-foreground">Specify where the environmental issue is located</p>
      </div>

      {/* GPS Detection */}
      <div className="bg-muted/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Icon name="Navigation" size={18} className="text-primary" />
            <span className="font-medium text-sm">GPS Location</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={detectLocation}
            disabled={isDetecting}
            loading={isDetecting}
            iconName={isDetecting ? "Loader2" : "MapPin"}
            iconPosition="left"
          >
            {isDetecting ? 'Detecting...' : 'Use Current Location'}
          </Button>
        </div>

        {location && !useManualAddress && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              <Icon 
                name="MapPin" 
                size={14}
                className={locationError ? "text-warning" : "text-success"}
              />
              <span className="text-foreground">
                Location {locationError ? "warning" : "detected"}
              </span>
              {location?.accuracy && (
                <span className={locationError ? "text-warning" : "text-muted-foreground"}>
                  (±{location.accuracy}m accuracy)
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              {location.address}
            </p>
            <div className="text-xs text-muted-foreground pl-6">
              Coordinates: {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
            </div>
            {locationError && (
              <div className="mt-2 text-xs text-warning bg-warning/10 p-2 rounded-md">
                ⚠️ {getLocationErrorMessage()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Address Input */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Manual Address Entry
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUseManualAddress(!useManualAddress);
              setLocationError(null);
            }}
            iconName={useManualAddress ? "Navigation" : "Edit3"}
            iconPosition="left"
          >
            {useManualAddress ? 'Use GPS' : 'Edit Address'}
          </Button>
        </div>

        <Input
          type="text"
          placeholder="Enter street address, landmark, or description in Chhattisgarh"
          value={manualAddress}
          onChange={handleManualAddressChange}
          disabled={!useManualAddress && location?.address}
          description={
            useManualAddress 
              ? "Type a location in Chhattisgarh to see suggestions"
              : "GPS location will be used unless manually overridden"
          }
        />

        {/* Suggestions list */}
        {useManualAddress && (loadingSuggestions || suggestions.length > 0) && (
          <div className="mt-2 space-y-1">
            {loadingSuggestions && (
              <div className="text-sm text-muted-foreground">
                Searching locations in Chhattisgarh...
              </div>
            )}
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full text-left px-3 py-2 hover:bg-muted rounded-md text-sm flex items-start space-x-2"
              >
                <div className="flex-shrink-0 mt-1">
                  <Icon name="MapPin" size={14} className="text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground line-clamp-2">
                    {suggestion.display_name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center space-x-1">
                    <span className="capitalize">{suggestion.type}</span>
                    <span>•</span>
                    <span>{suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}</span>
                  </div>
                </div>
              </button>
            ))}
            {!loadingSuggestions && suggestions.length === 0 && manualAddress.length >= 3 && (
              <div className="text-sm text-warning">
                No locations found in Chhattisgarh. Try adding more details or a nearby landmark.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map Preview */}
      {location && (
        <div className="bg-muted rounded-lg overflow-hidden">
          <div className="h-48 relative">
            <iframe
              width="100%"
              height="100%"
              loading="lazy"
              title="Report Location"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${location.latitude},${location.longitude}&z=16&output=embed`}
              className="border-0"
            />
            <div className="absolute top-2 left-2 bg-card/90 backdrop-blur-sm rounded-md px-2 py-1">
              <div className="flex items-center space-x-1 text-xs">
                <Icon name="MapPin" size={12} className="text-primary" />
                <span className="font-medium">Report Location</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationCapture;