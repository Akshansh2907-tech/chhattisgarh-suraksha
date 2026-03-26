import React, { createContext, useState, useContext, useEffect } from 'react';

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(() => {
    const saved = localStorage.getItem('cs_location');
    return saved ? JSON.parse(saved) : {
      id: 7,
      name: 'Raipur - City Center',
      type: 'district',
      coordinates: [21.2514, 81.6296]
    };
  });

  useEffect(() => {
    localStorage.setItem('cs_location', JSON.stringify(currentLocation));
    // Dispatch event for components that might need to react to location changes
    window.dispatchEvent(new CustomEvent('cs:location-changed', { detail: currentLocation }));
  }, [currentLocation]);

  return (
    <LocationContext.Provider value={{ currentLocation, setCurrentLocation }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
