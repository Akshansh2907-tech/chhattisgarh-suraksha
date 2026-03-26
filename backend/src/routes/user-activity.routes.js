import express from 'express';
import {
  getUserStats,
  getUserActivity,
  trackActivity,
  getLeaderboard
} from '../controllers/user-activity.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get user statistics (public - any user can view any user's stats)
router.get('/:id/stats', getUserStats);

// Get user recent activity (public)
router.get('/:id/activity', getUserActivity);

// Track activity (requires auth - internal use)
router.post('/activity', authMiddleware, trackActivity);

// Get leaderboard (public)
router.get('/leaderboard', getLeaderboard);

export default router;
