import React, { useEffect } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { useAuth } from '../../../contexts/AuthContext';
import UserAchievements from '../../../components/community/UserAchievements';
import CommunityLeaderboard from '../../../components/community/CommunityLeaderboard';
import { useToast } from '../../../contexts/ToastContext';

export default function CommunityPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Fetch achievements periodically to check for new ones
  const { data: latestAchievements } = useQuery(
    ['checkAchievements', user.id],
    async () => {
      const response = await axios.post(`/api/gamification/check-achievements/${user.id}`);
      return response.data;
    },
    {
      refetchInterval: 60000, // Check every minute
      refetchIntervalInBackground: true
    }
  );

  // Show toast for new achievements
  useEffect(() => {
    if (latestAchievements?.length > 0) {
      latestAchievements.forEach(achievement => {
        showToast({
          title: '🎉 New Achievement!',
          message: `You earned the "${achievement.name}" achievement!`,
          type: 'success',
          duration: 5000
        });
      });
    }
  }, [latestAchievements, showToast]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Community & Achievements</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - User's Achievements */}
        <div className="space-y-8">
          <UserAchievements />
        </div>

        {/* Right Column - Community Leaderboard */}
        <div className="space-y-8">
          <CommunityLeaderboard />
        </div>
      </div>
    </div>
  );
}