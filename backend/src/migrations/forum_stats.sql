-- Add online users tracking table
CREATE TABLE IF NOT EXISTS forum_online_users (
  user_id INTEGER PRIMARY KEY,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  username VARCHAR(100) NOT NULL
);

-- Add cleanup function
CREATE OR REPLACE FUNCTION cleanup_offline_users() RETURNS void AS $$
BEGIN
  DELETE FROM forum_online_users
  WHERE last_active < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;