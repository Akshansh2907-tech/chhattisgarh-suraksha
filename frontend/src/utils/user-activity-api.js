import api from './api.js';

export const userActivityAPI = {
  getUserStats: (userId) => api.get(`/users/${userId}/stats`),
  getUserActivity: (userId, limit = 20) => api.get(`/users/${userId}/activity`, { params: { limit } }),
  trackActivity: (activityType, metadata) => api.post('/users/activity', { activityType, metadata }),
  getLeaderboard: (type = 'impact', limit = 10) => api.get('/users/leaderboard', { params: { type, limit } })
};

export default userActivityAPI;
