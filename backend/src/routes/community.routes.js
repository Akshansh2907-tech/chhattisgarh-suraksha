import express from 'express';
import { getCommunityStats } from '../controllers/community.controller.js';

const router = express.Router();

// Community-level aggregate statistics
router.get('/stats', getCommunityStats);

export default router;
