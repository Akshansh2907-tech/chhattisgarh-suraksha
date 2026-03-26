import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Header from '../../components/ui/Header';
import AlertNotificationBar from '../../components/ui/AlertNotificationBar';
import LocationSelector from '../../components/ui/LocationSelector';
import UserStatusIndicator from '../../components/ui/UserStatusIndicator';
import DataLayerToggle from '../../components/ui/DataLayerToggle';
import { userAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

// Import components
import ProfileHeader from './components/ProfileHeader';
import AccountSettings from './components/AccountSettings';
import EnvironmentalPreferences from './components/EnvironmentalPreferences';
import ImpactTracking from './components/ImpactTracking';
import DataManagement from './components/DataManagement';
import NotificationSettings from './components/NotificationSettings';

function UserProfile() {
  const navigate = useNavigate();
  const { logout, user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // User data state
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    location: '',
    userType: 'Citizen',
    bio: '',
    avatar: null,
    joinDate: '',
    interests: [],
    twoFactorEnabled: false,
    emailNotifications: true,
    smsNotifications: false,
    marketingEmails: false,
    dataSharing: true
  });

  // Fetch user data on component mount
  React.useEffect(() => {
    const fetchUserData = async () => {
      try {
        // If auth context is still loading, wait
        if (loading) return;

        // If no authenticated user, redirect to login
        if (!user) {
          navigate('/login');
          return;
        }

        // Try to fetch latest profile from server to populate detailed fields
        const profile = await userAPI.getProfile();
        // userAPI returns data (already unwrapped in utils/api), but be defensive
        const profileData = profile?.data || profile || null;
        if (profileData) {
          setUserData(profileData);
          // Fetch impact/stats and recent activity for the profile we just loaded
          (async () => {
            try {
              const userId = profileData.id || user?.id;
              if (!userId) return;

              const [statsRes, activityRes] = await Promise.allSettled([
                userAPI.getStats(userId),
                userAPI.getActivity(userId, 10)
              ]);

              if (statsRes.status === 'fulfilled') {
                const stats = statsRes.value?.data || statsRes.value || null;
                setImpactData(stats || null);
              }

              if (activityRes.status === 'fulfilled') {
                const activitiesPayload = activityRes.value?.data || activityRes.value || null;
                const activities = activitiesPayload?.activities || activitiesPayload || [];
                setRecentActivities(activities);
              }
            } catch (err) {
              console.warn('Could not load impact data:', err?.message || err);
            }
          })();
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        if (error.response?.status === 401) {
          // Delegate logout handling to AuthContext
          alert('Your session has expired. Please log in again.');
          logout();
        } else {
          console.error('Failed to load user profile:', error.message || error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [navigate, user, loading, logout]);

  // Mock environmental preferences
  const [environmentalPreferences, setEnvironmentalPreferences] = useState({
    dashboardWidgets: {
      air_quality: true,
      water_quality: true,
      temperature: true,
      noise_levels: false,
      vegetation: true,
      traffic: false,
      emissions: true,
      weather: true
    },
    alertThresholds: {
      air_quality: 100,
      water_quality: 75,
      noise_levels: 70,
      temperature: 35
    },
    measurementUnit: 'metric',
    dataRefreshRate: '15',
    showPredictions: true,
    enableAutoAlerts: true
  });

  // Mock notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    deliveryMethods: {
      email: true,
      sms: false,
      push: true,
      in_app: true
    },
    notifications: {
      environmental_alerts: {
        email: true,
        push: true,
        in_app: true
      },
      air_quality: {
        email: true,
        push: true,
        in_app: true
      },
      water_quality: {
        email: true,
        push: true,
        in_app: true
      },
      community_updates: {
        email: false,
        push: true,
        in_app: true
      },
      report_status: {
        email: true,
        push: true,
        in_app: true
      },
      system_updates: {
        email: false,
        in_app: true
      }
    },
    frequency: {
      environmental_alerts: 'immediate',
      air_quality: 'immediate',
      water_quality: 'immediate',
      community_updates: 'daily',
      report_status: 'immediate',
      system_updates: 'weekly'
    },
    quietHours: '22-08',
    locationBased: true,
    predictiveAlerts: true,
    communityDigest: true
  });

  // Mock impact data
  // Impact data fetched from backend (replaces previous hardcoded mock)
  const [impactData, setImpactData] = React.useState(null);
  const [recentActivities, setRecentActivities] = React.useState([]);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: 'User', component: ProfileHeader },
    { id: 'account', label: 'Account', icon: 'Settings', component: AccountSettings },
    { id: 'preferences', label: 'Environmental', icon: 'Leaf', component: EnvironmentalPreferences },
    { id: 'impact', label: 'Impact', icon: 'TrendingUp', component: ImpactTracking },
    { id: 'notifications', label: 'Notifications', icon: 'Bell', component: NotificationSettings },
    { id: 'data', label: 'Data', icon: 'Database', component: DataManagement }
  ];

  const handleUpdateUser = (updatedUser) => {
    setUserData(updatedUser);
  };

  const handleUpdateSettings = (updatedSettings) => {
    setUserData(prev => ({ ...prev, ...updatedSettings }));
  };

  const handleUpdatePreferences = (updatedPreferences) => {
    setEnvironmentalPreferences(updatedPreferences);
  };

  const handleUpdateNotifications = (updatedNotifications) => {
    setNotificationSettings(updatedNotifications);
  };

  const renderTabContent = () => {
    const activeTabData = tabs?.find(tab => tab?.id === activeTab);
    if (!activeTabData) return null;

    const Component = activeTabData?.component;
    
    switch (activeTab) {
      case 'profile':
        return <Component user={userData} onUpdateUser={handleUpdateUser} />;
      case 'account':
        return <Component user={userData} onUpdateSettings={handleUpdateSettings} />;
      case 'preferences':
        return <Component preferences={environmentalPreferences} onUpdatePreferences={handleUpdatePreferences} />;
      case 'impact':
        return <Component impactData={impactData} recentActivities={recentActivities} />;
      case 'notifications':
        return <Component settings={notificationSettings} onUpdateSettings={handleUpdateNotifications} />;
      case 'data':
        return <Component />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <AlertNotificationBar />
        <div className="flex items-center justify-center min-h-screen">
          <Icon name="Loader2" size={32} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>User Profile - Chhattisgarh Suraksha</title>
        <meta name="description" content="Manage your Chhattisgarh Suraksha profile, preferences, and settings" />
      </Helmet>
      <Header />
      <AlertNotificationBar />
      <div className="pt-16">
        <div className="flex">
          {/* Fixed Sidebar - Desktop */}
          <div className="hidden lg:flex lg:w-80 lg:flex-col lg:fixed lg:inset-y-0 lg:pt-16">
            <div className="flex flex-col flex-1 min-h-0 bg-card border-r border-border">
              <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                <div className="px-4 mb-6">
                  <div className="flex items-center space-x-3">
                    <LocationSelector />
                    <UserStatusIndicator />
                  </div>
                </div>
                
                <nav className="flex-1 px-2 space-y-1">
                  {tabs?.map((tab) => (
                    <button
                      key={tab?.id}
                      onClick={() => setActiveTab(tab?.id)}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full transition-colors duration-200 ${
                        activeTab === tab?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon
                        name={tab?.icon}
                        size={20}
                        className="mr-3 flex-shrink-0"
                      />
                      {tab?.label}
                    </button>
                  ))}
                </nav>
                
                {/* Logout Button */}
                <div className="px-2 pt-2 pb-2 border-t border-border">
                  <button
                    onClick={() => {
                      // Use AuthContext logout to clear token and redirect
                      logout();
                    }}
                    className="group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full transition-colors duration-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Icon
                      name="LogOut"
                      size={20}
                      className="mr-3 flex-shrink-0"
                    />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Tab Navigation */}
          <div className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-card border-b border-border">
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center space-x-2">
                <LocationSelector />
                <UserStatusIndicator />
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden"
              >
                <Icon name={isMobileMenuOpen ? 'X' : 'Menu'} size={20} />
              </Button>
            </div>
            
            {isMobileMenuOpen && (
              <div className="border-t border-border bg-card">
                <nav className="px-2 py-2 space-y-1">
                  {tabs?.map((tab) => (
                    <button
                      key={tab?.id}
                      onClick={() => {
                        setActiveTab(tab?.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full transition-colors duration-200 ${
                        activeTab === tab?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon
                        name={tab?.icon}
                        size={20}
                        className="mr-3 flex-shrink-0"
                      />
                      {tab?.label}
                    </button>
                  ))}

                  {/* Mobile Logout Button */}
                  <button
                    onClick={() => logout()}
                    className="group flex items-center px-2 py-2 mt-4 text-sm font-medium rounded-md w-full transition-colors duration-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-border"
                  >
                    <Icon
                      name="LogOut"
                      size={20}
                      className="mr-3 flex-shrink-0"
                    />
                    Logout
                  </button>
                </nav>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 lg:pl-80">
            <div className={`pt-4 lg:pt-6 ${isMobileMenuOpen ? 'mt-16' : 'mt-0'} lg:mt-0`}>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Page Header */}
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">
                        {tabs?.find(tab => tab?.id === activeTab)?.label} Settings
                      </h1>
                      <p className="text-muted-foreground mt-1">
                        Manage your account settings and environmental preferences
                      </p>
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="hidden sm:flex items-center space-x-3">
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="Download"
                        iconPosition="left"
                        onClick={() => setActiveTab('data')}
                      >
                        Export Data
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="HelpCircle"
                        iconPosition="left"
                      >
                        Help
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="pb-8">
                  {renderTabContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
        <DataLayerToggle />
      </div>
    </div>
  );
}export default UserProfile;