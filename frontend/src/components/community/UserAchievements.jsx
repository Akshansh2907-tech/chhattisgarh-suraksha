import React from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { useAuth } from '../../../contexts/AuthContext';

export default function UserAchievements() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery(['userStats', user.id], async () => {
    const response = await axios.get(`/api/gamification/stats/${user.id}`);
    return response.data;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Your Achievements</h2>
      
      {/* Impact Score */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Impact Score</h3>
          <span className="text-2xl font-bold text-primary">{stats.impactScore}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
          <div 
            className="bg-primary h-2.5 rounded-full transition-all duration-500" 
            style={{ width: `${stats.impactScore}%` }}
          ></div>
        </div>
      </div>

      {/* Points */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Total Points</h3>
          <span className="text-2xl font-bold text-primary">{stats.totalPoints}</span>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.achievements.map((achievement) => (
          <div 
            key={achievement.id}
            className="p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start space-x-3">
              <span className="text-2xl">{achievement.icon}</span>
              <div>
                <h4 className="font-semibold">{achievement.name}</h4>
                <p className="text-sm text-gray-600">{achievement.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Earned {new Date(achievement.awardedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {stats.recentActivity.map((activity, index) => (
            <div 
              key={`${activity.type}-${activity.id}-${index}`}
              className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded"
            >
              <span className="text-xl">
                {activity.type === 'report' ? '📝' : '✅'}
              </span>
              <div>
                <p className="text-sm">
                  {activity.type === 'report' 
                    ? `Submitted a report${activity.location ? ` at ${activity.location}` : ''}`
                    : 'Validated a report'
                  }
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}