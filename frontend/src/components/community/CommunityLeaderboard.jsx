import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import clsx from 'clsx';

export default function CommunityLeaderboard() {
  const [timeframe, setTimeframe] = useState('7d');
  
  const { data: leaderboard, isLoading } = useQuery(
    ['leaderboard', timeframe],
    async () => {
      const response = await axios.get(`/api/gamification/leaderboard?timeframe=${timeframe}`);
      return response.data;
    }
  );

  const timeframeOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'all', label: 'All Time' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Community Leaderboard</h2>
        
        <div className="flex space-x-2">
          {timeframeOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setTimeframe(option.value)}
              className={clsx(
                'px-3 py-1 rounded-full text-sm transition-colors',
                timeframe === option.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {leaderboard.map((user, index) => (
          <div 
            key={user.id}
            className={clsx(
              'flex items-center p-4 rounded-lg transition-all',
              index < 3 ? 'bg-gradient-to-r from-primary-50 to-white' : 'hover:bg-gray-50'
            )}
          >
            {/* Rank */}
            <div className="w-12 text-center">
              <span className={clsx(
                'inline-flex items-center justify-center w-8 h-8 rounded-full font-bold',
                index === 0 ? 'bg-yellow-400 text-white' :
                index === 1 ? 'bg-gray-300 text-white' :
                index === 2 ? 'bg-amber-600 text-white' :
                'bg-gray-100'
              )}>
                {index + 1}
              </span>
            </div>

            {/* User Info */}
            <div className="flex-1 flex items-center">
              <img 
                src={user.profile_image || '/default-avatar.png'} 
                alt={user.full_name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="ml-3">
                <h3 className="font-semibold">{user.full_name}</h3>
                <div className="text-sm text-gray-600">
                  <span className="mr-4">{user.reports_count} Reports</span>
                  <span>{user.validations_count} Validations</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{user.total_points}</div>
                <div className="text-xs text-gray-500">Points</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{user.achievements_count}</div>
                <div className="text-xs text-gray-500">Achievements</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}