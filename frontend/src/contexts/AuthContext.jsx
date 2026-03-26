import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { userAPI, auth, authAPI } from '../utils/api';
import { toast } from 'sonner';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = useCallback(async () => {
    const token = auth.getToken();

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      // First verify the token
      await authAPI.verifyToken();
      
      // Then get the user profile
      const response = await userAPI.getProfile();
      const profile = response?.data || response;
      
      if (profile) {
        setUser({
          id: profile.id || profile.userId || null,
          name: profile.full_name || profile.name || profile.user?.full_name || 'Unknown',
          email: profile.email || profile.user?.email || '',
          phone: profile.phone_number || profile.user?.phone_number || '',
          role: profile.role || 'citizen',
          avatar: profile.avatar || null,
          status: profile.status || 'online',
          lastActive: new Date(profile.lastActive || profile.last_active || Date.now()),
          permissions: profile.permissions || [],
          position: profile.position || null,
          achievements: profile.achievements || []
        });
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      // If token verification fails or profile fetch fails, clear auth state
      if (error.response?.status === 401 || error.message === 'Token verification failed') {
        handleLogout(false); // Don't redirect on initial load
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const handleLogout = async (redirect = true) => {
    try {
      // Centralize token removal in the API token manager
      auth.clearToken();
      setUser(null);
      if (redirect) {
        toast.success('Successfully logged out');
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout properly');
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        setUser, 
        loading,
        logout: handleLogout,
        refreshProfile: loadUserProfile,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
