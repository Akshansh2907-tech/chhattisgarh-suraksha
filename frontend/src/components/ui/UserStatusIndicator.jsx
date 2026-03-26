import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';
import { useAuth } from '../../contexts/AuthContext';

const UserStatusIndicator = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [browserPermissions, setBrowserPermissions] = React.useState([]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef?.current && !dropdownRef?.current?.contains(event?.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name) => {
    return name?.split(' ')?.map(word => word?.charAt(0))?.join('')?.toUpperCase()?.slice(0, 2);
  };

  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case 'environmental scientist':
        return 'Microscope';
      case 'city planner':
        return 'Building';
      case 'activist':
        return 'Megaphone';
      case 'citizen':
        return 'User';
      default:
        return 'User';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return 'bg-success';
      case 'away':
        return 'bg-warning';
      case 'offline':
        return 'bg-muted-foreground';
      default:
        return 'bg-muted-foreground';
    }
  };

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    try {
      await logout();
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  // Query browser permissions for common items and show to user
  useEffect(() => {
    let mounted = true;
    const permsToCheck = [
      { key: 'geolocation', label: 'Location' },
      { key: 'notifications', label: 'Notifications' },
      { key: 'camera', label: 'Camera' },
      { key: 'microphone', label: 'Microphone' }
    ];

    const runQuery = async () => {
      const results = [];
      for (const p of permsToCheck) {
        try {
          if (navigator.permissions && navigator.permissions.query) {
            const status = await navigator.permissions.query({ name: p.key });
            results.push({ key: p.key, label: p.label, state: status.state });
          } else {
            results.push({ key: p.key, label: p.label, state: 'unknown' });
          }
        } catch (err) {
          // Some permissions (camera/microphone) may throw; mark as unknown
          results.push({ key: p.key, label: p.label, state: 'unknown' });
        }
      }

      if (mounted) setBrowserPermissions(results);
    };

    runQuery();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 p-2"
      >
          <div className="relative">
          {user?.avatar ? (
            <img
              src={user?.avatar}
              alt={user?.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
              {getInitials(user?.name || 'User')}
            </div>
          )}
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(user?.status)}`} />
        </div>
        <div className="hidden lg:block text-left">
          <div className="text-sm font-medium text-foreground">{user?.name || (loading ? 'Loading...' : 'Guest')}</div>
          <div className="text-xs text-muted-foreground">{user?.role || ''}</div>
        </div>
        <Icon name="ChevronDown" size={16} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </Button>
      {isDropdownOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-popover border border-border rounded-lg shadow-elevated z-50">
          {/* User Info Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="relative">
                {user?.avatar ? (
                  <img
                    src={user?.avatar}
                    alt={user?.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-lg font-medium">
                    {getInitials(user?.name)}
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${getStatusColor(user?.status)}`} />
              </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{user?.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                <div className="flex items-center space-x-1 mt-1">
                  <Icon name={getRoleIcon(user?.role)} size={12} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{user?.role}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status, Position & Permissions */}
          <div className="p-4 border-t border-border">
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Status
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-sm capitalize">online</span>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Community Position
                </div>
                <div className="flex items-center space-x-2">
                  <Icon name={user?.position?.icon || 'User'} size={16} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">{user?.position?.title || 'Citizen'}</span>
                  {user?.position?.level && (
                    <span className="text-xs text-muted-foreground">Level {user?.position?.level}</span>
                  )}
                </div>
                {user?.position?.progress && (
                  <div className="mt-1">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${user.position.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {user?.position?.nextMilestone}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Browser Permissions
                </div>
                <div className="flex flex-wrap gap-1">
                  {browserPermissions.map((p) => (
                    <span key={p.key} className="inline-flex items-center px-2 py-1 text-xs bg-muted text-muted-foreground rounded-md">
                      {p.label}: {p.state}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div className="p-2 border-t border-border">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 w-full px-3 py-2 text-sm text-left text-error hover:bg-error/10 rounded-md transition-colors duration-200"
            >
              <Icon name="LogOut" size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserStatusIndicator;