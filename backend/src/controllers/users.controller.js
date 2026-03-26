import { query } from '../config/database.js';

// Get user profile
export const getUserProfile = async (req, res, next) => {
    try {
        const { userId } = req.user;

        // Get user details with position and points
        const userResult = await query(
            `SELECT u.id, u.phone_number, u.full_name, u.email, u.address, u.created_at,
                    pt.name as position_name, pt.icon as position_icon, 
                    up.current_points, up.level, up.progress_to_next_level,
                    (SELECT pt2.name 
                     FROM position_types pt2 
                     WHERE pt2.required_points > up.current_points 
                     ORDER BY pt2.required_points ASC 
                     LIMIT 1) as next_position
             FROM users u
             LEFT JOIN user_positions up ON u.id = up.user_id
             LEFT JOIN position_types pt ON up.position_id = pt.id
             WHERE u.id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = userResult.rows[0];

        // Get user achievements with progress
        const achievementsResult = await query(
            `SELECT 
               a.id,
               a.name, 
               a.icon, 
               a.description, 
               a.required_count,
               ua.progress,
               ua.achieved_at,
               CASE 
                 WHEN ua.progress >= a.required_count THEN true 
                 ELSE false 
               END as is_achieved,
               LEAST(100, ROUND((ua.progress::float / a.required_count::float * 100))) as progress_percent
             FROM achievements a
             LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
             ORDER BY a.required_count ASC`,
            [userId]
        );

        // Format the response
        const response = {
            name: user.full_name,
            email: user.email || '',
            phoneNumber: user.phone_number,
            location: user.address || '',
            joinDate: user.created_at,
            position: {
                title: user.position_name || 'Citizen',
                icon: user.position_icon || 'User',
                level: user.level || 1,
                points: user.current_points || 0,
                progress: user.progress_to_next_level || 0,
                nextMilestone: user.next_position ? `Next: ${user.next_position}` : 'Max Level'
            },
            achievements: achievementsResult.rows,
            status: 'online'
        };

        // Determine role: if there's an employees row, mark as municipality
        try {
            const empRes = await query('SELECT employee_id FROM employees WHERE user_id = $1 LIMIT 1', [userId]);
            if (empRes.rows.length > 0) {
                response.role = 'municipality';
                response.employeeId = empRes.rows[0].employee_id;
            } else {
                response.role = 'citizen';
            }
        } catch (err) {
            // If employees table missing or error, default to citizen
            response.role = 'citizen';
        }
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

// Update user profile
export const updateUserProfile = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { fullName, email, address } = req.body;

        // Update user details
        const result = await query(
            'UPDATE users SET full_name = $1, email = $2, address = $3 WHERE id = $4 RETURNING *',
            [fullName, email, address, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result.rows[0];

        res.status(200).json({
            name: user.full_name,
            email: user.email,
            phoneNumber: user.phone_number,
            location: user.address
        });
    } catch (error) {
        next(error);
    }
};

// Get user activity and achievements
export const getUserActivity = async (req, res, next) => {
    try {
        const { userId } = req.user;

        // Get user points with activity breakdown
        const pointsResult = await query(
            `SELECT 
               activity_type,
               SUM(points) as points,
               COUNT(*) as count,
               MAX(created_at) as last_activity
             FROM user_activity_points 
             WHERE user_id = $1
             GROUP BY activity_type
             ORDER BY last_activity DESC`,
            [userId]
        );

        // Get user position in leaderboard
        const rankResult = await query(
            `WITH user_ranks AS (
               SELECT 
                 user_id,
                 SUM(points) as total_points,
                 RANK() OVER (ORDER BY SUM(points) DESC) as rank
               FROM user_activity_points
               GROUP BY user_id
             )
             SELECT rank, total_points
             FROM user_ranks
             WHERE user_id = $1`,
            [userId]
        );

        const totalPoints = rankResult.rows[0]?.total_points || 0;
        const rank = rankResult.rows[0]?.rank || 0;

        // Get recent activity
        const recentActivity = await query(
            `SELECT 
               uap.activity_type,
               uap.points,
               uap.created_at,
               CASE 
                 WHEN uap.activity_type = 'report_submission' THEN r.title
                 WHEN uap.activity_type = 'forum_post' THEN p.content
                 ELSE NULL
               END as activity_details
             FROM user_activity_points uap
             LEFT JOIN reports r ON uap.reference_id = r.id AND uap.activity_type = 'report_submission'
             LEFT JOIN forum_posts p ON uap.reference_id = p.id AND uap.activity_type = 'forum_post'
             WHERE uap.user_id = $1
             ORDER BY uap.created_at DESC
             LIMIT 10`,
            [userId]
        );

        res.json({
            points: {
                total: totalPoints,
                rank,
                breakdown: pointsResult.rows,
                recentActivity: recentActivity.rows
            }
        });
    } catch (error) {
        next(error);
    }
};