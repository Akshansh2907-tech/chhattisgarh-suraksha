-- Community positions and achievements

-- Position types and their requirements
CREATE TABLE position_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    description TEXT,
    required_points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default position types
INSERT INTO position_types (name, icon, description, required_points) VALUES
('Citizen', 'User', 'New community member', 0),
('Community Leader', 'Users', 'Active community participant with high engagement', 1000),
('Topics Creator', 'MessageSquare', 'Creates valuable discussion topics', 500),
('River Guardian', 'Droplet', 'Focused on water-related environmental issues', 750),
('Air Guardian', 'Wind', 'Focused on air quality issues', 750);

-- User positions and progress
CREATE TABLE user_positions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    position_id INTEGER REFERENCES position_types(id),
    current_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    progress_to_next_level FLOAT DEFAULT 0,
    achieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, position_id)
);

-- Activity points configuration
CREATE TABLE activity_points (
    id SERIAL PRIMARY KEY,
    activity_type VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default activity points
INSERT INTO activity_points (activity_type, points, description) VALUES
('report_submission', 10, 'Submit an environmental report'),
('report_verification', 5, 'Verify another user''s report'),
('forum_post', 3, 'Create a forum post'),
('forum_comment', 1, 'Comment on a forum post'),
('data_contribution', 5, 'Contribute environmental data');

-- User achievements
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    required_activity_type VARCHAR(50),
    required_count INTEGER,
    points_reward INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert some default achievements
INSERT INTO achievements (name, description, icon, required_activity_type, required_count, points_reward) VALUES
('First Report', 'Submit your first environmental report', 'Award', 'report_submission', 1, 50),
('Active Reporter', 'Submit 10 verified reports', 'Star', 'report_submission', 10, 200),
('Community Voice', 'Create 5 forum discussions', 'MessageCircle', 'forum_post', 5, 100),
('Data Champion', 'Contribute environmental data 20 times', 'Database', 'data_contribution', 20, 300);

-- User achievement tracking
CREATE TABLE user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    achievement_id INTEGER REFERENCES achievements(id),
    progress INTEGER DEFAULT 0,
    achieved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

-- Activity history for points calculation
-- Use activity_point_id as FK to activity_points(id) (safer than referencing a non-unique activity_type)
CREATE TABLE user_activity_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    activity_point_id INTEGER REFERENCES activity_points(id),
    points_earned INTEGER,
    reference_id INTEGER, -- ID of the related content (report, post, etc)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function to update user position based on points
CREATE OR REPLACE FUNCTION update_user_position() RETURNS TRIGGER AS $$
BEGIN
    -- Update user's position based on total points
    WITH user_total_points AS (
        SELECT user_id, SUM(points_earned) as total_points
        FROM user_activity_history
        WHERE user_id = NEW.user_id
        GROUP BY user_id
    )
    INSERT INTO user_positions (user_id, position_id, current_points)
    SELECT 
        NEW.user_id,
        (SELECT id FROM position_types 
         WHERE required_points <= utp.total_points 
         ORDER BY required_points DESC LIMIT 1),
        utp.total_points
    FROM user_total_points utp
    ON CONFLICT (user_id, position_id) 
    DO UPDATE SET 
        current_points = EXCLUDED.current_points,
        progress_to_next_level = (
            EXCLUDED.current_points::float / 
            (SELECT required_points FROM position_types WHERE id = EXCLUDED.position_id)
        ) * 100;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update position after activity
CREATE TRIGGER after_activity_update_position
    AFTER INSERT ON user_activity_history
    FOR EACH ROW
    EXECUTE FUNCTION update_user_position();