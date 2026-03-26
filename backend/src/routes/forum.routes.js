import express from 'express';
import {
  getAllTopics,
  getTopicById,
  createTopic,
  updateTopic,
  deleteTopic,
  voteTopic,
  addReply,
  getReplies,
  getForumStats,
  getTopContributors,
  updateUserOnlineStatus
} from '../controllers/forum.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/topics', getAllTopics);
router.get('/topics/:id', getTopicById);
router.post('/topics', authMiddleware, createTopic);
router.put('/topics/:id', authMiddleware, updateTopic);
router.delete('/topics/:id', authMiddleware, deleteTopic);
router.post('/topics/:id/vote', authMiddleware, voteTopic);
router.post('/topics/:id/replies', authMiddleware, addReply);
router.get('/topics/:id/replies', getReplies);
router.get('/stats', getForumStats);
router.get('/contributors', getTopContributors);
router.post('/online', authMiddleware, updateUserOnlineStatus);

export default router;