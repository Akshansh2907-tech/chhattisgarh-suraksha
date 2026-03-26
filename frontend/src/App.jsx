import React, { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import Routes from "./Routes";
import { registerServiceWorker, setupNetworkListeners, cacheApiData } from './utils/pwa';

function App() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Register service worker
    registerServiceWorker();

    // Setup network status listeners
    setupNetworkListeners((online) => {
      setIsOnline(online);
      if (online) {
        // Refresh cached data when coming back online
        cacheApiData();
      }
    });

    // Initial cache of API data
    cacheApiData();
  }, []);

  return (
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <LocationProvider>
            <div className="min-h-screen bg-background">
              {!isOnline && (
                <div className="bg-warning text-warning-foreground px-4 py-2 text-sm text-center">
                  You are currently offline. Some features may be limited.
                </div>
              )}
              <Routes />
              <Toaster
                position="top-right"
                toastOptions={{
                  style: {
                    background: 'hsl(var(--popover))',
                    color: 'hsl(var(--popover-foreground))',
                    border: '1px solid hsl(var(--border))',
                  },
                }}
              />
            </div>
          </LocationProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

export default App;
