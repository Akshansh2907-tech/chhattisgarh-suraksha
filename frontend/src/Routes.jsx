import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import NotFound from "./pages/NotFound";
import InteractiveMap from './pages/interactive-map';
import EnvironmentalDashboard from './pages/environmental-dashboard';
import ReportMapView from './pages/environmental-dashboard/ReportMapView';
import CitizenReporting from './pages/citizen-reporting';
import DataAnalytics from './pages/data-analytics';
import CommunityForum from './pages/community-forum';
import MunicipalityProcessing from './pages/municipality-processing';
import TopicDetails from './pages/community-forum/components/TopicDetails';
import UserProfile from './pages/user-profile';
const Login = React.lazy(() => import('./pages/auth/Login'));

// Add a loading component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
  </div>
);
import SignUp from './pages/auth/SignUp';

const Routes = () => {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <RouterRoutes>
        {/* Public Routes */}
        <Route path="/login" element={
          <React.Suspense fallback={<LoadingSpinner />}>
            <Login />
          </React.Suspense>
        } />
        <Route path="/signup" element={<SignUp />} />
        
        {/* Direct navigation for testing */}
        <Route path="/" element={<Navigate to="/environmental-dashboard" replace />} />

        {/* Protected App Routes */}
        <Route path="/interactive-map" element={
          <ProtectedRoute>
            <InteractiveMap />
          </ProtectedRoute>
        } />
        <Route path="/environmental-dashboard" element={
          <ProtectedRoute>
            <EnvironmentalDashboard />
          </ProtectedRoute>
        } />
        <Route path="/environmental-dashboard/map" element={
          <ProtectedRoute>
            <ReportMapView />
          </ProtectedRoute>
        } />
        <Route path="/citizen-reporting" element={
          <ProtectedRoute>
            <CitizenReporting />
          </ProtectedRoute>
        } />
        <Route path="/data-analytics" element={
          <ProtectedRoute>
            <DataAnalytics />
          </ProtectedRoute>
        } />
        <Route path="/community-forum" element={
          <ProtectedRoute>
            <CommunityForum />
          </ProtectedRoute>
        } />
        <Route path="/municipality-processing" element={
          <ProtectedRoute>
            <MunicipalityProcessing />
          </ProtectedRoute>
        } />
        <Route path="/community-forum/topic/:topicId" element={
          <ProtectedRoute>
            <TopicDetails />
          </ProtectedRoute>
        } />
        <Route path="/user-profile" element={
          <ProtectedRoute>
            <UserProfile />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </ErrorBoundary>
  );
};

export default Routes;
