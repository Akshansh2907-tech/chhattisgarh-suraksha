import { dbConnect, query } from '../config/database.js';

class GamificationService {
  // Achievement types and their points
  static ACHIEVEMENTS = {
    FIRST_REPORT: {
      id: 'first_report',
      name: 'First Alert',
      description: 'Submit your first environmental report',
      points: 100,
      icon: '🎯'
    },
    CONSISTENT_REPORTER: {
      id: 'consistent_reporter',
      name: 'Consistent Reporter',
      description: 'Submit reports for 7 consecutive days',
      points: 500,
      icon: '📊'
    },
    COMMUNITY_VALIDATOR: {
      id: 'community_validator',
      name: 'Community Validator',
      description: 'Verify 10 reports from other users',
      points: 300,
      icon: '✅'
    },
    DATA_SCIENTIST: {
      id: 'data_scientist',
      name: 'Data Scientist',
      description: 'Analyze and comment on 5 environmental trends',
      points: 400,
      icon: '🔬'
    },
    IMPACT_MAKER: {
      id: 'impact_maker',
      name: 'Impact Maker',
      description: 'Have 3 of your reports lead to official action',
      points: 1000,
      icon: '⭐'
    }
  };

  async awardAchievement(userId, achievementId) {
    try {
      const achievement = GamificationService.ACHIEVEMENTS[achievementId];
      if (!achievement) {
        throw new Error('Invalid achievement ID');
      }

      // Normalize achievements into the canonical `achievements` table and
      // use the integer PK for user_achievements (the DB schema expects an int).
      // Start transaction
      await query('BEGIN');

      // Ensure achievement exists in the achievements table; insert if missing
      const achRes = await query(
        `SELECT id FROM achievements WHERE required_activity_type = $1 LIMIT 1`,
        [achievement.id]
      );

      let achDbId;
      if (achRes.rows.length === 0) {
        const insertRes = await query(
          `INSERT INTO achievements (name, description, icon, required_activity_type, required_count, points_reward, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING id`,
          [achievement.name, achievement.description, achievement.icon, achievement.id, 1, achievement.points]
        );
        achDbId = insertRes.rows[0].id;
      } else {
        achDbId = achRes.rows[0].id;
      }

      // Check if already awarded
      const existing = await query(
        'SELECT * FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
        [userId, achDbId]
      );

      if (existing.rows.length > 0) {
        await query('ROLLBACK');
        return { success: false, message: 'Achievement already awarded' };
      }

      // Award achievement (using integer achievement_id)
      await query(
        `INSERT INTO user_achievements (user_id, achievement_id, achieved_at, created_at)
         VALUES ($1, $2, NOW(), NOW())`,
        [userId, achDbId]
      );

      // Add points
      await query(
        `INSERT INTO user_points (user_id, points, reason, awarded_at)
         VALUES ($1, $2, $3, NOW())`,
        [userId, achievement.points, `Achievement: ${achievement.name}`]
      );

      // Update total points
      await query(
        `UPDATE users 
         SET total_points = total_points + $1,
             achievements_count = achievements_count + 1
         WHERE id = $2`,
        [achievement.points, userId]
      );

      await query('COMMIT');

      // Return success with achievement details
      return {
        success: true,
        achievement: {
          ...achievement,
          awardedAt: new Date()
        }
      };
    } catch (error) {
      await query('ROLLBACK');
      console.error('Failed to award achievement:', error);
      throw error;
    }
  }

  async checkAndAwardAchievements(userId) {
    try {
      const awarded = [];

      // Check FIRST_REPORT
      const reports = await query(
        'SELECT COUNT(*) as count FROM environmental_reports WHERE reporter_id = $1',
        [userId]
      );
      if (reports.rows[0].count === 1) {
        const result = await this.awardAchievement(userId, 'FIRST_REPORT');
        if (result.success) awarded.push(result.achievement);
      }

      // Check CONSISTENT_REPORTER
      const consecutiveDays = await query(
        `SELECT COUNT(*) as count
         FROM (
           SELECT DISTINCT DATE(created_at)
           FROM environmental_reports
           WHERE reporter_id = $1
           ORDER BY DATE(created_at) DESC
           LIMIT 7
         ) as dates`,
        [userId]
      );
      if (consecutiveDays.rows[0].count >= 7) {
        const result = await this.awardAchievement(userId, 'CONSISTENT_REPORTER');
        if (result.success) awarded.push(result.achievement);
      }

      // Check COMMUNITY_VALIDATOR
      const validations = await query(
        'SELECT COUNT(*) as count FROM report_validations WHERE validator_id = $1',
        [userId]
      );
      if (validations.rows[0].count >= 10) {
        const result = await this.awardAchievement(userId, 'COMMUNITY_VALIDATOR');
        if (result.success) awarded.push(result.achievement);
      }

      // Check DATA_SCIENTIST
      const analyses = await query(
        'SELECT COUNT(*) as count FROM environmental_analyses WHERE analyst_id = $1',
        [userId]
      );
      if (analyses.rows[0].count >= 5) {
        const result = await this.awardAchievement(userId, 'DATA_SCIENTIST');
        if (result.success) awarded.push(result.achievement);
      }

      // Check IMPACT_MAKER
      const impactfulReports = await query(
        `SELECT COUNT(*) as count 
         FROM environmental_reports 
         WHERE reporter_id = $1 AND led_to_action = true`,
        [userId]
      );
      if (impactfulReports.rows[0].count >= 3) {
        const result = await this.awardAchievement(userId, 'IMPACT_MAKER');
        if (result.success) awarded.push(result.achievement);
      }

      return awarded;
    } catch (error) {
      console.error('Failed to check achievements:', error);
      throw error;
    }
  }

  async getUserStats(userId) {
    try {
      // Get user's achievements
      const achievements = await query(
        `SELECT a.achievement_id, a.awarded_at, u.total_points
         FROM user_achievements a
         JOIN users u ON u.id = a.user_id
         WHERE a.user_id = $1
         ORDER BY a.awarded_at DESC`,
        [userId]
      );

      // Get recent activity
      const activity = await query(
        `SELECT 'report' as type, created_at as timestamp, id, location
         FROM environmental_reports
         WHERE reporter_id = $1
         UNION ALL
         SELECT 'validation' as type, validated_at as timestamp, report_id as id, null as location
         FROM report_validations
         WHERE validator_id = $1
         ORDER BY timestamp DESC
         LIMIT 10`,
        [userId]
      );

      // Calculate impact score
      const impactScore = await this.calculateImpactScore(userId);

      return {
        achievements: achievements.rows.map(a => ({
          ...GamificationService.ACHIEVEMENTS[a.achievement_id],
          awardedAt: a.awarded_at
        })),
        totalPoints: achievements.rows[0]?.total_points || 0,
        recentActivity: activity.rows,
        impactScore
      };
    } catch (error) {
      console.error('Failed to get user stats:', error);
      throw error;
    }
  }

  async calculateImpactScore(userId) {
    try {
      const weights = {
        reports: 0.3,
        validations: 0.2,
        verifiedReports: 0.3,
        actionableReports: 0.2
      };

      const [reports, validations, verified, actionable] = await Promise.all([
        query('SELECT COUNT(*) as count FROM environmental_reports WHERE reporter_id = $1', [userId]),
        query('SELECT COUNT(*) as count FROM report_validations WHERE validator_id = $1', [userId]),
        query('SELECT COUNT(*) as count FROM environmental_reports WHERE reporter_id = $1 AND verified = true', [userId]),
        query('SELECT COUNT(*) as count FROM environmental_reports WHERE reporter_id = $1 AND led_to_action = true', [userId])
      ]);

      const score = 
        (reports.rows[0].count * weights.reports) +
        (validations.rows[0].count * weights.validations) +
        (verified.rows[0].count * weights.verifiedReports) +
        (actionable.rows[0].count * weights.actionableReports);

      return Math.min(100, Math.round(score * 10)); // Scale to 0-100
    } catch (error) {
      console.error('Failed to calculate impact score:', error);
      return 0;
    }
  }

  async getLeaderboard(timeframe = '7d') {
    try {
      const interval = timeframe === '30d' ? 'interval \'30 days\''
                    : timeframe === 'all' ? 'interval \'100 years\''
                    : 'interval \'7 days\'';

      const leaderboard = await query(
        `SELECT 
           u.id,
           u.full_name,
           u.profile_image,
           u.total_points,
           COUNT(DISTINCT er.id) as reports_count,
           COUNT(DISTINCT rv.id) as validations_count,
           COUNT(DISTINCT ua.achievement_id) as achievements_count
         FROM users u
         LEFT JOIN environmental_reports er ON er.reporter_id = u.id 
           AND er.created_at > NOW() - $1
         LEFT JOIN report_validations rv ON rv.validator_id = u.id 
           AND rv.validated_at > NOW() - $1
         LEFT JOIN user_achievements ua ON ua.user_id = u.id
         GROUP BY u.id, u.full_name, u.profile_image, u.total_points
         ORDER BY u.total_points DESC
         LIMIT 100`,
        [interval]
      );

      return leaderboard.rows;
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      throw error;
    }
  }
}

export const gamificationService = new GamificationService();