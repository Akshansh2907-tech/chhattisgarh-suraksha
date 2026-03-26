import { query } from '../config/database.js';

export const getCommunityStats = async (req, res, next) => {
  try {
    // Total reports
    const reportsRes = await query('SELECT COUNT(*)::int AS total_reports FROM reports');
    const reportsCount = reportsRes.rows[0]?.total_reports || 0;

    // Total registered users
    const usersRes = await query('SELECT COUNT(*)::int AS total_users FROM users');
    const membersCount = usersRes.rows[0]?.total_users || 0;

    // Total impact points (sum of all user activity points)
    const pointsRes = await query('SELECT COALESCE(SUM(points),0)::int AS total_points FROM user_activity_points');
    const impactPoints = pointsRes.rows[0]?.total_points || 0;

    // Optionally provide recent activity summary
    const recentActivityRes = await query(
      `SELECT activity_type, COUNT(*)::int as count
       FROM user_activity
       WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY activity_type`
    );

    res.status(200).json({
      success: true,
      data: {
        reportsCount,
        membersCount,
        impactPoints,
        recentActivity: recentActivityRes.rows || []
      }
    });
  } catch (error) {
    console.error('Error getting community stats:', error);
    next(error);
  }
};

export default { getCommunityStats };
