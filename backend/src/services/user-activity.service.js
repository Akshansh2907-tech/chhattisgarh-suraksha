import { query } from '../config/database.js';

class UserActivityService {
  // Constants for achievement types
  static ACHIEVEMENT_TYPES = {
    REPORT_SUBMITTED: 'report_submitted',
    FORUM_POST: 'forum_post_created',
    FORUM_REPLY: 'forum_reply_added',
    DATA_EXPORT: 'data_exported'
  };

  // Base points configuration
  static BASE_POINTS = {
    [UserActivityService.ACHIEVEMENT_TYPES.REPORT_SUBMITTED]: 10,
    [UserActivityService.ACHIEVEMENT_TYPES.FORUM_POST]: 5,
    [UserActivityService.ACHIEVEMENT_TYPES.FORUM_REPLY]: 2,
    [UserActivityService.ACHIEVEMENT_TYPES.DATA_EXPORT]: 1
  };

  // Additional points for report details
  static REPORT_BONUS_POINTS = {
    HAS_PHOTOS: 5,
    HAS_DESCRIPTION: 3,
    HAS_KEYWORDS: 2,
    HAS_ADDITIONAL_DATA: 5,
    SEVERITY_HIGH: 5,
    SEVERITY_MEDIUM: 3,
    SEVERITY_LOW: 1
  };

  // Calculate report points based on details
  static calculateReportPoints(reportData) {
    let points = this.BASE_POINTS[this.ACHIEVEMENT_TYPES.REPORT_SUBMITTED];
    
    // Add bonus points for detailed reports
    if (reportData.photoHash) {
      points += this.REPORT_BONUS_POINTS.HAS_PHOTOS;
    }
    
    if (reportData.description && reportData.description.length > 50) {
      points += this.REPORT_BONUS_POINTS.HAS_DESCRIPTION;
    }
    
    if (reportData.keywords) {
      points += this.REPORT_BONUS_POINTS.HAS_KEYWORDS;
    }
    
    if (reportData.additionalData && Object.keys(reportData.additionalData).length > 0) {
      points += this.REPORT_BONUS_POINTS.HAS_ADDITIONAL_DATA;
    }
    
    // Add points based on severity
    switch(reportData.severity?.toLowerCase()) {
      case 'high':
        points += this.REPORT_BONUS_POINTS.SEVERITY_HIGH;
        break;
      case 'medium':
        points += this.REPORT_BONUS_POINTS.SEVERITY_MEDIUM;
        break;
      case 'low':
        points += this.REPORT_BONUS_POINTS.SEVERITY_LOW;
        break;
    }
    
    return points;
  }

  // Create user activity and stats tables if they don't exist
  static async createTables() {
    // User activity table
    await query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        activity_type VARCHAR(50) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User stats table
    await query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id INTEGER PRIMARY KEY,
        reports_submitted INTEGER DEFAULT 0,
        forum_posts INTEGER DEFAULT 0,
        forum_replies INTEGER DEFAULT 0,
        data_exports INTEGER DEFAULT 0,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Position types table
    await query(`
      CREATE TABLE IF NOT EXISTS position_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        icon VARCHAR(50) NOT NULL,
        required_points INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User positions table
    await query(`
      CREATE TABLE IF NOT EXISTS user_positions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        position_id INTEGER NOT NULL,
        current_points INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        progress_to_next_level INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (position_id) REFERENCES position_types(id)
      )
    `);

    // User activity points table
    await query(`
      CREATE TABLE IF NOT EXISTS user_activity_points (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        activity_type VARCHAR(50) NOT NULL,
        points INTEGER NOT NULL,
        reference_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Achievements table
    await query(`
      CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        icon VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        required_count INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User achievements table
    await query(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        achievement_id INTEGER NOT NULL,
        progress INTEGER DEFAULT 0,
        achieved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (achievement_id) REFERENCES achievements(id),
        UNIQUE(user_id, achievement_id)
      )
    `);

    console.log('✅ User activity and gamification tables created/verified');
  }

  // Track user activity
  static async trackActivity(userId, activityType, metadata = {}) {
    try {
      // Start a database transaction
      await query('BEGIN');

      try {
        // Insert activity record
        await query(
          `INSERT INTO user_activity (user_id, activity_type, metadata)
           VALUES ($1, $2, $3)`,
          [userId, activityType, JSON.stringify(metadata)]
        );

        // Ensure user_stats record exists
        await query(
          `INSERT INTO user_stats (user_id)
           VALUES ($1)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );

        // Update appropriate counter and award points based on activity type
        let updateField = '';
        let pointsToAward = 0;
        switch (activityType) {
          case 'report_submitted':
            updateField = 'reports_submitted = reports_submitted + 1';
            pointsToAward = this.calculateReportPoints(metadata);
            break;
          case 'forum_post_created':
            updateField = 'forum_posts = forum_posts + 1';
            pointsToAward = this.BASE_POINTS[UserActivityService.ACHIEVEMENT_TYPES.FORUM_POST];
            break;
          case 'forum_reply_added':
            updateField = 'forum_replies = forum_replies + 1';
            pointsToAward = this.BASE_POINTS[UserActivityService.ACHIEVEMENT_TYPES.FORUM_REPLY];
            break;
          case 'data_exported':
            updateField = 'data_exports = data_exports + 1';
            pointsToAward = this.BASE_POINTS[UserActivityService.ACHIEVEMENT_TYPES.DATA_EXPORT];
            break;
        }

        if (updateField) {
          await query(
            `UPDATE user_stats
             SET ${updateField},
                 last_active = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1`,
            [userId]
          );
        }

        if (pointsToAward > 0) {
          // Award points
          // Ensure referenceId is an integer (or null) to avoid type conflicts
          const refId = metadata && metadata.referenceId != null ? parseInt(metadata.referenceId) : null;
          await query(
            `INSERT INTO user_activity_points (user_id, activity_type, points, reference_id)
             VALUES ($1, $2, $3, $4)`,
            [userId, activityType, pointsToAward, Number.isNaN(refId) ? null : refId]
          );

          // Update user position based on total points
          const totalPoints = await query(
            `SELECT SUM(points) as total_points
             FROM user_activity_points
             WHERE user_id = $1`,
            [userId]
          );

          // Get next position based on total points
          const nextPosition = await query(
            `SELECT id, name, icon 
             FROM position_types
             WHERE required_points <= $1
             ORDER BY required_points DESC
             LIMIT 1`,
            [totalPoints.rows[0].total_points || 0]
          );

          // Update or create user position
          if (nextPosition.rows.length > 0) {
            const tp = Number(totalPoints.rows[0].total_points || 0);
            await query(
              `INSERT INTO user_positions 
                (user_id, position_id, current_points, level, progress_to_next_level)
               VALUES (
                 $1::int, 
                 $2::int,
                 $3::int,
                 FLOOR(SQRT($3::float / 100)) + 1,
                 $3 - (POWER(FLOOR(SQRT($3::float / 100)), 2) * 100)
               )
               ON CONFLICT (user_id) DO UPDATE
               SET position_id = $2,
                   current_points = $3,
                   level = FLOOR(SQRT($3::float / 100)) + 1,
                   progress_to_next_level = $3 - (POWER(FLOOR(SQRT($3::float / 100)), 2) * 100),
                   updated_at = CURRENT_TIMESTAMP`,
              [userId, nextPosition.rows[0].id, tp]
            );
          }

          // Check and update achievements
          const userStats = await query(
            `SELECT * FROM user_stats WHERE user_id = $1`,
            [userId]
          );

          if (userStats.rows.length > 0) {
            const stats = userStats.rows[0];
            const achievements = await query(
              `SELECT * FROM achievements WHERE type = $1`,
              [activityType]
            );

            for (const achievement of achievements.rows) {
              let progress = 0;
              switch (achievement.type) {
                case 'report_submitted':
                  progress = stats.reports_submitted;
                  break;
                case 'forum_post_created':
                  progress = stats.forum_posts;
                  break;
                case 'forum_reply_added':
                  progress = stats.forum_replies;
                  break;
              }

              await query(
                `INSERT INTO user_achievements (user_id, achievement_id, progress)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, achievement_id)
                 DO UPDATE SET 
                   progress = $3,
                   achieved_at = CASE 
                     WHEN user_achievements.progress < $4 AND $3 >= $4 THEN CURRENT_TIMESTAMP
                     ELSE user_achievements.achieved_at
                   END`,
                [userId, achievement.id, progress, achievement.required_count]
              );
            }
          }
        }

        await query('COMMIT');
        return { success: true };
      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }
    } catch (error) {
      console.error('Error tracking activity:', error);
      throw error;
    }
  }

  // Get user statistics
  static async getUserStats(userId) {
    try {
      // Ensure stats record exists
      await query(
        `INSERT INTO user_stats (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      const result = await query(
        `SELECT * FROM user_stats WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return {
          reportsSubmitted: 0,
          forumPosts: 0,
          forumReplies: 0,
          dataExports: 0,
          impactScore: 0,
          joinedDays: 0,
          lastActive: new Date().toISOString(),
          achievements: []
        };
      }

      const stats = result.rows[0];

      // Calculate additional metrics
      const joinedDays = Math.floor(
        (new Date() - new Date(stats.created_at)) / (1000 * 60 * 60 * 24)
      );

      // Calculate impact score (weighted combination of activities)
      const impactScore = Math.min(1000,
        (stats.reports_submitted * 10) +
        (stats.forum_posts * 5) +
        (stats.forum_replies * 2) +
        (stats.data_exports * 1)
      );

      // Determine achievements
      const achievements = [];
      if (stats.reports_submitted >= 1) achievements.push({ id: 'first_report', name: 'First Report', icon: '📝' });
      if (stats.reports_submitted >= 10) achievements.push({ id: 'reporter', name: 'Active Reporter', icon: '🏆' });
      if (stats.forum_posts >= 5) achievements.push({ id: 'community_contributor', name: 'Community Contributor', icon: '💬' });
      if (impactScore >= 100) achievements.push({ id: 'eco_warrior', name: 'Eco Warrior', icon: '🌱' });

      return {
        reportsSubmitted: stats.reports_submitted,
        forumPosts: stats.forum_posts,
        forumReplies: stats.forum_replies,
        dataExports: stats.data_exports,
        impactScore,
        joinedDays,
        lastActive: stats.last_active,
        achievements
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Get user recent activity
  static async getUserRecentActivity(userId, limit = 20) {
    try {
      const result = await query(
        `SELECT * FROM user_activity
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      // Format activities for display
      const activities = result.rows.map(activity => ({
        id: activity.id,
        type: activity.activity_type,
        description: this.getActivityDescription(activity.activity_type, activity.metadata),
        timestamp: activity.created_at,
        metadata: activity.metadata
      }));

      return activities;
    } catch (error) {
      console.error('Error getting user activity:', error);
      throw error;
    }
  }

  // Helper to get activity description
  static getActivityDescription(activityType, metadata) {
    switch (activityType) {
      case 'report_submitted':
        return `Submitted environmental report${metadata.reportId ? ` #${metadata.reportId}` : ''}`;
      case 'forum_post_created':
        return `Created forum topic${metadata.topicTitle ? `: ${metadata.topicTitle}` : ''}`;
      case 'forum_reply_added':
        return `Replied to forum discussion`;
      case 'data_exported':
        return `Exported environmental data (${metadata.format || 'CSV'})`;
      case 'profile_updated':
        return `Updated profile information`;
      default:
        return activityType.replace(/_/g, ' ');
    }
  }

  // Get leaderboard
  static async getLeaderboard(type = 'impact', limit = 10) {
    try {
      let orderBy = '';
      switch (type) {
        case 'reports':
          orderBy = 'reports_submitted DESC';
          break;
        case 'forum':
          orderBy = '(forum_posts + forum_replies) DESC';
          break;
        case 'impact':
        default:
          orderBy = '((reports_submitted * 10) + (forum_posts * 5) + (forum_replies * 2) + data_exports) DESC';
      }

      const result = await query(
        `SELECT
          user_id,
          reports_submitted,
          forum_posts,
          forum_replies,
          data_exports,
          ((reports_submitted * 10) + (forum_posts * 5) + (forum_replies * 2) + data_exports) as impact_score
         FROM user_stats
         WHERE (reports_submitted + forum_posts + forum_replies + data_exports) > 0
         ORDER BY ${orderBy}
         LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }
}
export default UserActivityService;
