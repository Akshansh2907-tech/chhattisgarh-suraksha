import express from 'express';
import { getUserProfile, updateUserProfile, getUserActivity } from '../controllers/users.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get user profile
router.get('/profile', authMiddleware, getUserProfile);

// Update user profile
router.put('/profile', authMiddleware, updateUserProfile);

// Get user activity and achievements
router.get('/activity', authMiddleware, getUserActivity);

export default router;