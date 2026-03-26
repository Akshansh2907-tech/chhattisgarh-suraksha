import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;

  // If user is authenticated, redirect them to the dashboard
  if (user) {
    return <Navigate to="/environmental-dashboard" replace />;
  }

  // Otherwise render public children (login/signup pages)
  return children;
};

export default PublicRoute;