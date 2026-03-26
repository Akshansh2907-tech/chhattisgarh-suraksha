import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';
import { useAuth } from '../../contexts/AuthContext';

const Header = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigationItems = [
    {
      label: 'Dashboard',
      path: '/environmental-dashboard',
      icon: 'BarChart3',
      tooltip: 'Environmental overview and insights'
    },
    {
      label: 'Map',
      path: '/interactive-map',
      icon: 'Map',
      tooltip: 'Interactive environmental data visualization'
    },
    {
      label: 'Analytics',
      path: '/data-analytics',
      icon: 'TrendingUp',
      tooltip: 'Comprehensive data analysis tools'
    },
    {
      label: 'Report',
      path: '/citizen-reporting',
      icon: 'FileText',
      tooltip: 'Submit environmental issues'
    },
    {
      label: 'Community',
      path: '/community-forum',
      icon: 'Users',
      tooltip: 'Discussion forums and knowledge sharing'
    }
  ];

  const { user } = useAuth();

  const isActivePath = (path) => location?.pathname === path;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-[1000] bg-card border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Logo */}
        <Link to="/environmental-dashboard" className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
            <Icon name="Leaf" size={20} color="white" />
          </div>
          <span className="text-xl font-semibold text-foreground">Chhattisgarh Suraksha</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          {navigationItems?.map((item) => (
            <Link
              key={item?.path}
              to={item?.path}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-300 ${
                isActivePath(item?.path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title={item?.tooltip}
            >
              <Icon name={item?.icon} size={18} />
              <span>{item?.label}</span>
            </Link>
          ))}
          {/* Municipality processing link - visible only for municipality employees */}
          {user?.role === 'municipality' && (
            <Link
              to="/municipality-processing"
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-300 ${
                isActivePath('/municipality-processing')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title="Municipality Report Processing"
            >
              <Icon name="Building" size={18} />
              <span>Municipality</span>
            </Link>
          )}
        </nav>

        {/* User Profile & Mobile Menu */}
        <div className="flex items-center space-x-3">
          {/* User Profile - Desktop */}
          <Link
            to="/user-profile"
            className={`hidden md:flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-300 ${
              isActivePath('/user-profile')
                ? 'bg-primary text-primary-foreground' :'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title="User profile and settings"
          >
            <Icon name="User" size={18} />
            <span>Profile</span>
          </Link>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <Icon name={isMobileMenuOpen ? 'X' : 'Menu'} size={20} />
          </Button>
        </div>
      </div>
      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-16 z-[999] bg-background md:hidden">
          <nav className="flex flex-col p-4 space-y-2">
            {navigationItems?.map((item) => (
              <Link
                key={item?.path}
                to={item?.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium transition-colors duration-300 ${
                  isActivePath(item?.path)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon name={item?.icon} size={20} />
                <span>{item?.label}</span>
              </Link>
            ))}
            
            {/* User Profile - Mobile */}
            <Link
              to="/user-profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium transition-colors duration-300 ${
                isActivePath('/user-profile')
                  ? 'bg-primary text-primary-foreground' :'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon name="User" size={20} />
              <span>Profile</span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;