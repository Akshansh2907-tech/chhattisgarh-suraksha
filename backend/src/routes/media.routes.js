import express from 'express';
import { uploadMedia } from '../controllers/media.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Upload media for analysis (auth required)
router.post('/upload', authMiddleware, uploadMedia);

export default router;
