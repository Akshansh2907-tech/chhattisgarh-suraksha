import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ImpactTracking = ({ impactData, recentActivities: recentActivitiesProp = [] }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const periods = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'all', label: 'All Time' }
  ];

  const categories = [
    { value: 'all', label: 'All Activities', icon: 'Activity' },
    { value: 'reports', label: 'Reports', icon: 'FileText' },
    { value: 'community', label: 'Community', icon: 'Users' },
    { value: 'data', label: 'Data Collection', icon: 'Database' }
  ];

  // Derive achievements from backend if available, otherwise fallback to a small placeholder
  const achievements = (impactData?.achievements && Array.isArray(impactData.achievements))
    ? impactData.achievements.map((a, idx) => ({
        id: a.id || a.name || `ach-${idx}`,
        title: a.name || a.title || 'Achievement',
        description: a.description || '',
        icon: a.icon || 'Award',
        earned: !!a.achieved_at || !!a.achievedAt || false,
        earnedDate: a.achieved_at || a.achievedAt || null,
        progress: a.progress || (a.required_count ? Math.min(100, Math.floor((a.progress || 0) / a.required_count * 100)) : 0),
        color: 'text-primary'
      }))
    : [
        { id: 'placeholder-1', title: 'Getting Started', description: 'Participate to earn badges', icon: 'Award', earned: false, progress: 0, color: 'text-muted' }
      ];

  // Normalize stats coming from backend: the service returns reportsSubmitted, forumPosts, forumReplies, dataExports, impactScore
  const reportsSubmitted = impactData?.reportsSubmitted || impactData?.reports_submitted || 0;
  const forumPosts = impactData?.forumPosts || impactData?.forum_posts || 0;
  const forumReplies = impactData?.forumReplies || impactData?.forum_replies || 0;
  const dataExports = impactData?.dataExports || impactData?.data_exports || 0;
  const impactScore = impactData?.impactScore || impactData?.environmentalScore || 0;

  const contributionStats = [
    {
      label: 'Reports Submitted',
      value: reportsSubmitted,
      change: '+0%',
      trend: 'up',
      icon: 'FileText',
      color: 'text-primary'
    },
    {
      label: 'Community Interactions',
      value: forumPosts + forumReplies,
      change: '+0%',
      trend: 'up',
      icon: 'MessageCircle',
      color: 'text-secondary'
    },
    {
      label: 'Data Points Contributed',
      value: dataExports,
      change: '+0%',
      trend: 'up',
      icon: 'TrendingUp',
      color: 'text-success'
    },
    {
      label: 'Environmental Score',
      value: impactScore,
      change: '+0%',
      trend: 'up',
      icon: 'Leaf',
      color: 'text-accent'
    }
  ];

  // Use recentActivities passed from parent if available, otherwise fallback to an empty array
  const recentActivities = (Array.isArray(recentActivitiesProp) && recentActivitiesProp.length > 0)
    ? recentActivitiesProp.map(a => ({
        id: a.id || a.activity_id || `${a.type}-${Math.random().toString(36).slice(2,8)}`,
        type: a.type || a.activity_type || 'activity',
        title: a.title || a.description || a.type || 'Activity',
        description: a.description || a.metadata?.description || a.metadata || '',
        timestamp: a.timestamp || a.created_at || a.createdAt || new Date().toISOString(),
        impact: a.impact || (a.points ? `+${a.points} points` : ''),
        icon: a.icon || (a.type === 'report' ? 'FileText' : 'Activity')
      }))
    : [];

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'report':
        return 'FileText';
      case 'community':
        return 'Users';
      case 'data':
        return 'Database';
      case 'achievement':
        return 'Award';
      default:
        return 'Activity';
    }
  };

  return (
    <div className="space-y-6">
      {/* Period and Category Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex flex-wrap gap-2">
          {periods?.map((period) => (
            <Button
              key={period?.value}
              variant={selectedPeriod === period?.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(period?.value)}
            >
              {period?.label}
            </Button>
          ))}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {categories?.map((category) => (
            <Button
              key={category?.value}
              variant={selectedCategory === category?.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category?.value)}
              iconName={category?.icon}
              iconPosition="left"
            >
              {category?.label}
            </Button>
          ))}
        </div>
      </div>
      {/* Contribution Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {contributionStats?.map((stat, index) => (
          <div key={index} className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Icon name={stat?.icon} size={24} className={stat?.color} />
              <div className={`flex items-center space-x-1 text-sm ${
                stat?.trend === 'up' ? 'text-success' : 'text-error'
              }`}>
                <Icon name={stat?.trend === 'up' ? 'TrendingUp' : 'TrendingDown'} size={14} />
                <span>{stat?.change}</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground mb-1">{stat?.value}</div>
            <div className="text-sm text-muted-foreground">{stat?.label}</div>
          </div>
        ))}
      </div>
      {/* Achievements & Badges */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Icon name="Trophy" size={20} className="mr-2 text-primary" />
          Achievements & Badges
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {achievements?.map((achievement) => (
            <div
              key={achievement?.id}
              className={`p-4 border rounded-lg transition-all duration-200 ${
                achievement?.earned
                  ? 'border-success bg-success/5' :'border-border bg-muted/30'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${
                  achievement?.earned ? 'bg-success/20' : 'bg-muted'
                }`}>
                  <Icon
                    name={achievement?.icon}
                    size={20}
                    className={achievement?.earned ? 'text-success' : 'text-muted-foreground'}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={`font-medium ${
                      achievement?.earned ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {achievement?.title}
                    </h4>
                    {achievement?.earned && (
                      <Icon name="Check" size={16} className="text-success" />
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2">
                    {achievement?.description}
                  </p>
                  
                  {achievement?.earned ? (
                    <div className="text-xs text-success">
                      Earned {new Date(achievement.earnedDate)?.toLocaleDateString()}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="text-foreground">{achievement?.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${achievement?.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Recent Activities */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Icon name="Activity" size={20} className="mr-2 text-primary" />
          Recent Activities
        </h3>
        
        <div className="space-y-4">
          {recentActivities?.map((activity) => (
            <div key={activity?.id} className="flex items-start space-x-3 p-3 hover:bg-muted rounded-lg transition-colors duration-200">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon name={activity?.icon} size={16} className="text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-foreground">{activity?.title}</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-success font-medium">{activity?.impact}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(activity?.timestamp)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{activity?.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 text-center">
          <Button variant="outline" iconName="MoreHorizontal" iconPosition="left">
            View All Activities
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImpactTracking;