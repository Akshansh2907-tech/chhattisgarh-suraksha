// Check if service worker is supported
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('ServiceWorker registration successful');
          
          // Request notification permission
          if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                console.log('Notification permission granted');
              }
            });
          }
        })
        .catch(err => {
          console.error('ServiceWorker registration failed:', err);
        });
    });
  }
}

// Subscribe to push notifications
export async function subscribeToPushNotifications() {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Get push subscription
    let subscription = await registration.pushManager.getSubscription();
    
    // Create new subscription if one doesn't exist
    if (!subscription) {
      const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });
      
      // Send subscription to backend
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscription)
      });
    }
    
    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    throw error;
  }
}

// Check if app can be installed
export function checkInstallability() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    window.deferredPrompt = e;
    
    // Show install button or prompt
    const installButton = document.getElementById('install-button');
    if (installButton) {
      installButton.style.display = 'block';
      
      installButton.addEventListener('click', async () => {
        if (window.deferredPrompt) {
          // Show the prompt
          window.deferredPrompt.prompt();
          
          // Wait for the user to respond to the prompt
          const { outcome } = await window.deferredPrompt.userChoice;
          console.log(`User response to install prompt: ${outcome}`);
          
          // Clear the saved prompt
          window.deferredPrompt = null;
          
          // Hide install button
          installButton.style.display = 'none';
        }
      });
    }
  });
}

// Check if online/offline
export function setupNetworkListeners(callback) {
  window.addEventListener('online', () => {
    callback(true);
  });
  
  window.addEventListener('offline', () => {
    callback(false);
  });
  
  // Initial check
  callback(navigator.onLine);
}

// Cache API data for offline use
export async function cacheApiData() {
  try {
    const cache = await caches.open('api-cache');
    
    // Cache essential API endpoints
    const endpoints = [
      '/api/metrics/current',
      '/api/reports/recent',
      '/api/forum/popular'
    ];
    
    await Promise.all(
      endpoints.map(endpoint => 
        fetch(endpoint)
          .then(response => cache.put(endpoint, response))
          .catch(err => console.error(`Failed to cache ${endpoint}:`, err))
      )
    );
  } catch (error) {
    console.error('Failed to cache API data:', error);
  }
}