import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { forumAPI } from '../../../utils/forum-api';

const ForumSidebar = ({ onCategorySelect, selectedCategory }) => {
  const categories = [
    {
      id: 'air_quality',
      name: 'Air Quality',
      icon: 'Wind',
      count: 0,
      description: 'Discussions about air pollution and quality monitoring'
    },
    {
      id: 'water_quality',
      name: 'Water Quality',
      icon: 'Droplets',
      count: 0,
      description: 'Water contamination and safety topics'
    },
    {
      id: 'sustainability',
      name: 'Sustainability Tips',
      icon: 'Recycle',
      count: 0,
      description: 'Practical advice for sustainable living'
    },
    {
      id: 'policy',
      name: 'Policy Discussions',
      icon: 'FileText',
      count: 0,
      description: 'Environmental policies and regulations'
    },
    {
      id: 'green_spaces',
      name: 'Green Spaces',
      icon: 'Trees',
      count: 0,
      description: 'Urban parks and green infrastructure'
    },
    {
      id: 'waste_management',
      name: 'Waste Management',
      icon: 'Trash2',
      count: 0,
      description: 'Waste reduction and recycling initiatives'
    },
    {
      id: 'climate_change',
      name: 'Climate Change',
      icon: 'Thermometer',
      count: 0,
      description: 'Climate science and adaptation strategies'
    },
    {
      id: 'community_events',
      name: 'Community Events',
      icon: 'Calendar',
      count: 0,
      description: 'Local environmental events and meetups'
    }
  ];

  // top contributors will be provided by the server
  const [topContributors, setTopContributors] = useState([]);
  const [stats, setStats] = useState({
    totalTopics: 0,
    totalPosts: 0,
    activeMembers: 0,
    onlineNow: 0,
    categoryCounts: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Setup online status updates
  useEffect(() => {
    let mounted = true;
    let interval;

    const updateOnlineStatus = async () => {
      try {
        if (!mounted) return;
        await forumAPI.updateOnlineStatus();
      } catch (error) {
        console.error('Error updating online status:', error);
      }
    };

    // Update every 3 minutes to stay online
    interval = setInterval(updateOnlineStatus, 3 * 60 * 1000);

    // Initial update
    updateOnlineStatus();

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  const getUserInitials = (name) => {
    return name?.split(' ')?.map(word => word?.charAt(0))?.join('')?.toUpperCase()?.slice(0, 2);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Update online status first (don't fail the whole load if this errors)
        try {
          await forumAPI.updateOnlineStatus();
        } catch (e) {
          console.debug('Non-fatal: failed to update online status', e?.message || e);
        }

        // Then fetch stats and top contributors in parallel
        const [statsRes, contribRes] = await Promise.all([
          forumAPI.getStats(),
          forumAPI.getTopContributors(5)
        ]);

        if (!mounted) return;

        const stats = statsRes?.data?.data || {};
        const contributors = contribRes?.data?.data || [];

        setStats({
          totalTopics: stats.total_topics || 0,
          totalPosts: stats.total_replies || 0,
          activeMembers: stats.total_contributors || 0,
          onlineNow: stats.online_users || 0,
          categoryCounts: stats.category_counts || {}
        });
        setTopContributors(contributors);
      } catch (e) {
        console.error('Failed to load forum sidebar data', e);
        if (mounted) setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="w-80 bg-card border-r border-border h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Categories */}
        <div>
          <h3 className="font-semibold text-foreground mb-4 flex items-center">
            <Icon name="Folder" size={18} className="mr-2 text-primary" />
            Categories
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => onCategorySelect('all')}
              className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors duration-200 ${
                selectedCategory === 'all' ?'bg-primary text-primary-foreground' :'hover:bg-muted text-muted-foreground'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon name="Grid3x3" size={16} />
                <span className="font-medium">All Topics</span>
              </div>
              <span className="text-sm">{stats.totalTopics || 0}</span>
            </button>
            
            {categories?.map((category) => (
              <button
                key={category?.id}
                onClick={() => onCategorySelect(category?.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors duration-200 ${
                  selectedCategory === category?.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon name={category?.icon} size={16} />
                  <div>
                    <div className="font-medium">{category?.name}</div>
                    <div className="text-xs opacity-75 line-clamp-1">
                      {category?.description}
                    </div>
                  </div>
                </div>
                <span className="text-sm">{(stats.categoryCounts && stats.categoryCounts[category.id]) ?? category.count ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Top Contributors */}
        <div>
          <h3 className="font-semibold text-foreground mb-4 flex items-center">
            <Icon name="Trophy" size={18} className="mr-2 text-primary" />
            Top Contributors
          </h3>
          <div className="space-y-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : error ? (
              <div className="text-sm text-destructive">Failed to load contributors</div>
            ) : topContributors.length === 0 ? (
              <div className="text-sm text-muted-foreground">No contributors yet</div>
            ) : (
              topContributors.map((contributor, index) => (
                <div
                  key={contributor.id}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted transition-colors duration-200 cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-muted-foreground w-4">#{index + 1}</span>
                    {contributor.avatar ? (
                      <img
                        src={contributor.avatar}
                        alt={contributor.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                        {getUserInitials(contributor.username)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">
                      {contributor.username}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <span>{contributor.topics} topics</span>
                      <span>•</span>
                      <span>{contributor.replies} replies</span>
                      <span>•</span>
                      <span>{contributor.reputation} rep</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Forum Stats */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3 flex items-center">
            <Icon name="BarChart3" size={16} className="mr-2 text-primary" />
            Forum Statistics
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Topics</span>
              <span className="font-medium">{stats.totalTopics}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Posts</span>
              <span className="font-medium">{stats.totalPosts}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Members</span>
              <span className="font-medium">{stats.activeMembers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Online Now</span>
              <span className="font-medium text-success">{stats.onlineNow}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h4 className="font-medium text-foreground mb-3">Quick Actions</h4>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              iconName="Search"
              iconPosition="left"
              fullWidth
            >
              Advanced Search
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconName="Bookmark"
              iconPosition="left"
              fullWidth
            >
              My Bookmarks
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconName="Bell"
              iconPosition="left"
              fullWidth
            >
              Notifications
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForumSidebar;