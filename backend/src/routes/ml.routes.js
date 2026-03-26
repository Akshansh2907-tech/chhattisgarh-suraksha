import express from 'express';
import {
  getPollutionHotspots,
  getForecast,
  getRiskAssessment,
  getPatterns,
  trainModels,
  getModelInfo
} from '../controllers/ml.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get pollution hotspot predictions (public)
router.get('/hotspots', getPollutionHotspots);

// Get 24-hour air quality forecast (public)
router.get('/forecast', getForecast);

// Get health risk assessment (public)
router.get('/risk-assessment', getRiskAssessment);

// Get recognized environmental patterns (public)
router.get('/patterns', getPatterns);

// Trigger model training (admin only - requires auth)
// TODO: Add admin-specific middleware
router.post('/train', authMiddleware, trainModels);

// Get model information (public)
router.get('/models/info', getModelInfo);

export default router;
