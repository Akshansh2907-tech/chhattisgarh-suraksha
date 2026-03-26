import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { gamificationService } from '../services/gamification.service.js';

const router = Router();

// Get user's achievements and stats
router.get('/stats/:userId', authMiddleware, async (req, res) => {
  try {
    const stats = await gamificationService.getUserStats(req.params.userId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get global leaderboard
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    const leaderboard = await gamificationService.getLeaderboard(timeframe);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available achievements
router.get('/achievements', authMiddleware, (req, res) => {
  try {
    res.json(Object.values(gamificationService.constructor.ACHIEVEMENTS));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export const gamificationRoutes = router;