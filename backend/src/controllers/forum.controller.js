import ForumService from '../services/forum.service.js';
import { query } from '../config/database.js';

export const getAllTopics = async (req, res, next) => {
  try {
    const filters = {
      category: req.query.category,
      sort: req.query.sort,
      status: req.query.status,
      search: req.query.search,
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0
    };

    console.log(`📋 GET /api/forum/topics - Filters:`, filters);

    const result = await ForumService.getAllTopics(filters);

    res.status(200).json({
      success: true,
      data: {
        topics: result.topics,
        total: result.total
      }
    });
  } catch (error) {
    console.error('❌ Error getting topics:', error);
    next(error);
  }
};

export const getTopicById = async (req, res, next) => {
  try {
    const topicId = parseInt(req.params.id);

    console.log(`📖 GET /api/forum/topics/${topicId}`);

    const topic = await ForumService.getTopicById(topicId);

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    res.status(200).json({
      success: true,
      data: topic
    });
  } catch (error) {
    console.error('❌ Error getting topic:', error);
    next(error);
  }
};

export const createTopic = async (req, res, next) => {
  try {
    const userId = req.user?.id || 1; // From auth middleware
    const { title, content, category, tags } = req.body;

    console.log(`✍️ POST /api/forum/topics - User: ${userId}`);

    const topic = await ForumService.createTopic(
      { title, content, category, tags },
      userId
    );

    res.status(201).json({
      success: true,
      data: topic,
      message: 'Topic created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating topic:', error);
    // If service threw a structured ValidationError, return the errors payload directly
    if (error && (error.name === 'ValidationError' || Array.isArray(error.errors))) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: error.errors || []
      });
    }

    next(error);
  }
};

export const updateTopic = async (req, res, next) => {
  try {
    const topicId = parseInt(req.params.id);
    const userId = req.user?.id || 1;
    const { title, content } = req.body;

    console.log(`✏️ PUT /api/forum/topics/${topicId} - User: ${userId}`);

    const topic = await ForumService.updateTopic(topicId, { title, content }, userId);

    res.status(200).json({
      success: true,
      data: topic,
      message: 'Topic updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating topic:', error);
    next(error);
  }
};

export const deleteTopic = async (req, res, next) => {
  try {
    const topicId = parseInt(req.params.id);
    const userId = req.user?.id || 1;

    console.log(`🗑️ DELETE /api/forum/topics/${topicId} - User: ${userId}`);

    await ForumService.deleteTopic(topicId, userId);

    res.status(200).json({
      success: true,
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting topic:', error);
    next(error);
  }
};

export const voteTopic = async (req, res, next) => {
  try {
    const topicId = parseInt(req.params.id);
    const userId = req.user?.id || 1;
    const { voteType } = req.body;

    console.log(`👍 POST /api/forum/topics/${topicId}/vote - User: ${userId}, Type: ${voteType}`);

    const votes = await ForumService.voteTopic(topicId, userId, voteType);

    res.status(200).json({
      success: true,
      data: votes
    });
  } catch (error) {
    console.error('❌ Error voting on topic:', error);
    next(error);
  }
};

export const addReply = async (req, res, next) => {
  try {
    const topicId = parseInt(req.params.id);
    const userId = req.user?.id || 1;
    const { content } = req.body;

    console.log(`💬 POST /api/forum/topics/${topicId}/replies - User: ${userId}`);

    const reply = await ForumService.addReply(topicId, content, userId);

    res.status(201).json({
      success: true,
      data: reply,
      message: 'Reply added successfully'
    });
  } catch (error) {
    console.error('❌ Error adding reply:', error);
    if (error.message.includes('must be between')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

export const getReplies = async (req, res, next) => {
  try {
    const topicId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    console.log(`💬 GET /api/forum/topics/${topicId}/replies - Limit: ${limit}, Offset: ${offset}`);

    const result = await ForumService.getTopicReplies(topicId, limit, offset);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Error getting replies:', error);
    next(error);
  }
};

export const getForumStats = async (req, res, next) => {
  try {
    console.log('📊 GET /api/forum/stats');

    const stats = await ForumService.getForumStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error getting forum stats:', error);
    next(error);
  }
};

export const getTopContributors = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    console.log(`🏆 GET /api/forum/contributors - Limit: ${limit}`);

    const contributors = await ForumService.getTopContributors(limit);

    res.status(200).json({
      success: true,
      data: contributors
    });
  } catch (error) {
    console.error('❌ Error getting top contributors:', error);
    next(error);
  }
};

export const updateUserOnlineStatus = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const username = req.user?.username;

    let resolvedUserId = userId;
    let resolvedUsername = username;

    // If the token didn't include user id/username, try to resolve from phone number in token payload
    if ((!resolvedUserId || !resolvedUsername) && req.user?.raw?.phoneNumber) {
      try {
        const userRes = await query('SELECT id, full_name, phone_number FROM users WHERE phone_number = $1 LIMIT 1', [req.user.raw.phoneNumber]);
        if (userRes.rows.length > 0) {
          const u = userRes.rows[0];
          resolvedUserId = resolvedUserId || u.id;
          resolvedUsername = resolvedUsername || u.full_name || u.phone_number;
        }
      } catch (e) {
        console.warn('Could not resolve user from token phone number:', e && e.message ? e.message : e);
      }
    }

    if (!resolvedUserId || !resolvedUsername) {
      return res.status(400).json({
        success: false,
        message: 'User ID and username are required'
      });
    }

    console.log(`👤 POST /api/forum/online - User: ${resolvedUserId} (${resolvedUsername})`);

    await ForumService.updateUserOnlineStatus(resolvedUserId, resolvedUsername);

    res.status(200).json({
      success: true,
      message: 'Online status updated'
    });
  } catch (error) {
    console.error('❌ Error updating online status:', error);
    next(error);
  }
};
