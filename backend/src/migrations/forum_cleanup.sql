-- Drop function if exists
DROP FUNCTION IF EXISTS cleanup_offline_users;

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_offline_users() RETURNS void AS $$
BEGIN
  DELETE FROM forum_online_users
  WHERE last_active < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;