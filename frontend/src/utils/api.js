import axios from 'axios';
import { normalizePhone } from './phone';

// Create axios instance with base URL
const api = axios.create({
  baseURL: '/api',  // Always use relative path, nginx will handle routing
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
  withCredentials: true // Important for CORS with credentials
});

// Constants for auth-related functionality
const AUTH_TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'user_id';

// List of endpoints that should not trigger auth handling logic
const AUTH_ENDPOINTS = [
  '/auth/send-otp',
  '/auth/verify-otp',
  '/auth/register'
];

// Simple token management functions
const tokenManager = {
  setToken: (token) => {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  },

  getToken: () => {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  clearToken: () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    delete api.defaults.headers.common['Authorization'];
  },

  isAuthenticated: () => {
    return !!localStorage.getItem(AUTH_TOKEN_KEY);
  }
};

// Initialize auth token from localStorage
const storedToken = localStorage.getItem('auth_token');
if (storedToken) {
  tokenManager.setToken(storedToken);
}

// Add request interceptor to add auth token to requests
api.interceptors.request.use(
  (config) => {
    // Add auth token to requests if available
    const token = tokenManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: central logging, network handling and auth handling
api.interceptors.response.use(
  (response) => {
    console.log('[API Response]:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  async (error) => {
    // Log detailed error information
    console.error('[API Error]:', {
      url: error.config?.url,
      status: error.response?.status,
      error: error.response?.data,
      code: error.code,
      message: error.message
    });

    // Check for network-level errors first
    if (error.code === 'ECONNABORTED') {
      return Promise.reject({
        ...error,
        message: 'Request timed out - Please check your connection'
      });
    } 
    
    if (!error.response) {
      return Promise.reject({
        ...error,
        message: 'Network error - Cannot connect to server'
      });
    }

    // Handle auth-related errors
    const isAuthEndpoint = AUTH_ENDPOINTS.some(endpoint => error.config?.url?.includes(endpoint));
    const isAuthError = error.response?.status === 401 || error.response?.status === 403;
    
    if (isAuthError) {
      // Log auth status for debugging
      console.log('[Auth Status]:', {
        isAuthEndpoint,
        url: error.config?.url,
        token: tokenManager.getToken(),
        currentPath: window.location.pathname
      });

      // Only clear token automatically for non-auth endpoints. Do NOT perform a hard redirect
      // here; let the app (AuthContext/components) decide navigation to avoid loops.
      if (!isAuthEndpoint) {
        console.log('[Auth Error]: Handling unauthorized access');
        tokenManager.clearToken(); // Clear auth state
      }
    }

    // Pass along the error with a formatted message
    return Promise.reject({
      ...error,
      message: error.response?.data?.message || error.message || 'An unexpected error occurred'
    });
  }
);

// (Note) Only one response interceptor is registered above. Duplicate handlers were removed to
// avoid multiple token clears or duplicate side effects.

// Auth related API calls
export const authAPI = {
  // Send OTP
  sendOTP: async (phoneNumber) => {
    try {
      const normalized = normalizePhone(phoneNumber);
      const response = await api.post('/auth/send-otp', { phoneNumber: normalized });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to send OTP');
    }
  },

  // Verify OTP
  verifyOTP: async (phoneNumber, otp) => {
    try {
      // Clear any existing auth state
      tokenManager.clearToken();
      
      const normalized = normalizePhone(phoneNumber);
      const response = await api.post('/auth/verify-otp', { 
          phoneNumber: normalized, 
          otp,
          timestamp: Date.now()
        });

      console.log('OTP Verification Response:', response.data);

      if (!response.data?.token) {
        throw new Error('No authentication token received');
      }

      // Set the new token
      tokenManager.setToken(response.data.token);

      // Return the full response data for the caller to handle
      return {
        ...response.data,
        isNewUser: !!response.data.isNewUser,
        isProfileComplete: !!response.data.isProfileComplete
      };
    } catch (error) {
      console.error('OTP Verification Error:', error);
      if (error.response?.status === 401 || 
          (error.response?.data?.message || '').toLowerCase().includes('expired')) {
        throw new Error('Invalid OTP or OTP has expired');
      }
      throw new Error(error.response?.data?.message || 'Failed to verify OTP');
    }
  },

  // Verify existing token
  verifyToken: async () => {
    try {
      const token = tokenManager.getToken();
      if (!token) {
        throw new Error('No auth token found');
      }

      // The backend does not expose /auth/verify in current API surface.
      // Use the protected `/users/profile` endpoint to validate the token instead.
      const response = await api.get('/users/profile');
      // If this succeeds (200), the token is valid and we return the profile data.
      return response.data;
    } catch (error) {
      // Only clear token automatically on explicit auth errors (401/403).
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        tokenManager.clearToken();
        throw new Error('Token verification failed');
      }

      // For other errors (404, network issues), do not clear token here.
      // Let the caller decide how to handle these cases.
      throw error;
    }
  },

//Register user
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to register');
    }
  },

  // Check user status
  checkUserStatus: async (phoneNumber) => {
    return api.get(`/status/check/${phoneNumber}`);
  }
};

// User related API calls
export const userAPI = {
  // Get user profile
  getProfile: async () => {
    try {
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch profile');
    }
  },

  // Get user stats (reports, forum counts, impact score, achievements)
  getStats: async (userId) => {
    try {
      const response = await api.get(`/users/${userId}/stats`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch user stats');
    }
  },

  // Get recent user activity
  getActivity: async (userId, limit = 20) => {
    try {
      const response = await api.get(`/users/${userId}/activity?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user activity:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch user activity');
    }
  },

  // Update user profile
  updateProfile: async (userData) => {
    try {
      const response = await api.put('/users/profile', userData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to update profile');
    }
  },

  // Get community-level aggregated stats
  getCommunityStats: async () => {
    try {
      const response = await api.get('/community/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch community stats:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch community stats');
    }
  }
};

// Environmental metrics related API calls
// Export the token manager for use in components
export const auth = {
  ...tokenManager,
  isLoggedIn: () => tokenManager.isAuthenticated()
};

export const metricsAPI = {
  // Get current environmental metrics
  getCurrentMetrics: async () => {
    try {
      const response = await api.get('/metrics/current');
      if (!response?.data) {
        throw new Error('Invalid response format from metrics endpoint');
      }
      return response.data;
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch environmental metrics');
    }
  },

  // Get active alerts
  getActiveAlerts: async () => {
    try {
      const response = await api.get('/metrics/alerts');
      if (!response?.data) {
        throw new Error('Invalid response format from alerts endpoint');
      }
      return response.data;
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      return {
        success: true,
        data: [],
        message: error.response?.data?.message || error.message
      };
    }
  },

  // Get historical metrics
  getMetricsHistory: async (type, duration) => {
    try {
      const response = await api.get(`/metrics/history?type=${type}&duration=${duration}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch metrics history');
    }
  },

  // Force update metrics (admin only)
  forceUpdate: async () => {
    try {
      const response = await api.post('/metrics/update');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to force update metrics');
    }
  }
};

export default api;