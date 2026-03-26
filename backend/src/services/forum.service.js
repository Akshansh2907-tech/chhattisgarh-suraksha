import Forum from '../models/forum.js';
import { ValidationError } from '../models/forum-errors.js';

class ForumService {
  // Initialize forum tables
  static async initialize() {
    await Forum.createTables();
  }

  // Get all topics with filters
  static async getAllTopics(filters) {
    try {
      const result = await Forum.getAllTopics(filters);
      return result;
    } catch (error) {
      console.error('Error getting all topics:', error);
      throw error;
    }
  }

  // Get single topic by ID
  static async getTopicById(id) {
    try {
      // Increment view count
      await Forum.incrementViewCount(id);

      const topic = await Forum.getTopicById(id);
      return topic;
    } catch (error) {
      console.error('Error getting topic by ID:', error);
      throw error;
    }
  }

  // Create new topic
  static async createTopic(topicData, userId) {
    try {
      const { title, content, category, tags } = topicData;
      // Validation
      const errors = [];
      if (!title || title.length < 10 || title.length > 200) {
        errors.push({ field: 'title', message: 'Title must be between 10 and 200 characters' });
      }

      if (!content || content.length < 10 || content.length > 10000) {
        errors.push({ field: 'content', message: 'Content must be between 10 and 10000 characters' });
      }

      const validCategories = [
        'air_quality',
        'water_quality',
        'sustainability',
        'policy',
        'green_spaces',
        'waste_management',
        'climate_change',
        'community_events'
      ];

      if (!category || !validCategories.includes(category)) {
        errors.push({ field: 'category', message: 'Invalid category' });
      }

      if (tags && tags.length > 5) {
        errors.push({ field: 'tags', message: 'Maximum 5 tags allowed' });
      }

      if (errors.length > 0) {
        throw new ValidationError(errors);
      }

      const topic = await Forum.createTopic({ title, content, category, tags }, userId);
      return topic;
    } catch (error) {
      console.error('Error creating topic:', error);
      throw error;
    }
  }

  // Update topic
  static async updateTopic(id, updates, userId) {
    try {
      const topic = await Forum.updateTopic(id, updates, userId);

      if (!topic) {
        throw new Error('Topic not found or unauthorized');
      }

      return topic;
    } catch (error) {
      console.error('Error updating topic:', error);
      throw error;
    }
  }

  // Delete topic
  static async deleteTopic(id, userId) {
    try {
      const topic = await Forum.deleteTopic(id, userId);

      if (!topic) {
        throw new Error('Topic not found or unauthorized');
      }

      return topic;
    } catch (error) {
      console.error('Error deleting topic:', error);
      throw error;
    }
  }

  // Add reply to topic
  static async addReply(topicId, content, userId) {
    try {
      // Validation
      if (!content || content.length < 10 || content.length > 5000) {
        throw new Error('Reply content must be between 10 and 5000 characters');
      }

      const reply = await Forum.addReply(topicId, content, userId);
      return reply;
    } catch (error) {
      console.error('Error adding reply:', error);
      throw error;
    }
  }

  // Get replies for a topic
  static async getTopicReplies(topicId, limit, offset) {
    try {
      const result = await Forum.getTopicReplies(topicId, limit, offset);
      return result;
    } catch (error) {
      console.error('Error getting topic replies:', error);
      throw error;
    }
  }

  // Vote on topic
  static async voteTopic(topicId, userId, voteType) {
    try {
      if (!['up', 'down'].includes(voteType)) {
        throw new Error('Invalid vote type. Must be "up" or "down"');
      }

      const votes = await Forum.voteTopic(topicId, userId, voteType);
      return votes;
    } catch (error) {
      console.error('Error voting on topic:', error);
      throw error;
    }
  }

  // Get forum statistics
  static async getForumStats() {
    try {
      const stats = await Forum.getForumStats();
      return stats;
    } catch (error) {
      console.error('Error getting forum stats:', error);
      throw error;
    }
  }

  // Get top contributors
  static async getTopContributors(limit = 10) {
    try {
      const contributors = await Forum.getTopContributors(limit);
      return contributors;
    } catch (error) {
      console.error('Error getting top contributors:', error);
      throw error;
    }
  }

  // Update user's online status
  static async updateUserOnlineStatus(userId, username) {
    try {
      await Forum.updateUserOnlineStatus(userId, username);
    } catch (error) {
      console.error('Error updating user online status:', error);
      throw error;
    }
  }
}

export default ForumService;
