import express from 'express';
import {
  getCurrentMetrics,
  getActiveAlerts,
  getMetricsHistory,
  forceMetricsUpdate
} from '../controllers/metrics.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get current environmental metrics (requires auth)
router.get('/current', authMiddleware, getCurrentMetrics);

// Get active alerts (requires auth)
router.get('/alerts', authMiddleware, getActiveAlerts);

// Get historical metrics (requires auth)
router.get('/history', authMiddleware, getMetricsHistory);

// Force update metrics (admin only)
router.post('/update', authMiddleware, forceMetricsUpdate);

export default router;