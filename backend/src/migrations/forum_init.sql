-- Drop existing tables in reverse order of dependencies
DROP TABLE IF EXISTS forum_online_users CASCADE;
DROP TABLE IF EXISTS forum_topic_tags CASCADE;
DROP TABLE IF EXISTS forum_votes CASCADE;
DROP TABLE IF EXISTS forum_replies CASCADE;
DROP TABLE IF EXISTS forum_topics CASCADE;

-- Create forum topics table
CREATE TABLE forum_topics (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  author_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0
);

-- Create forum replies table
CREATE TABLE forum_replies (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create forum votes table
CREATE TABLE forum_votes (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(topic_id, user_id)
);

-- Create forum topic tags table
CREATE TABLE forum_topic_tags (
  topic_id INTEGER NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  tag_name VARCHAR(50) NOT NULL,
  PRIMARY KEY (topic_id, tag_name)
);

-- Create forum online users table
CREATE TABLE forum_online_users (
  user_id INTEGER PRIMARY KEY,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  username VARCHAR(100) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_forum_topics_author ON forum_topics(author_id);
CREATE INDEX idx_forum_topics_category ON forum_topics(category);
CREATE INDEX idx_forum_replies_topic ON forum_replies(topic_id);
CREATE INDEX idx_forum_replies_author ON forum_replies(author_id);
CREATE INDEX idx_forum_votes_topic ON forum_votes(topic_id);
CREATE INDEX idx_forum_votes_user ON forum_votes(user_id);
CREATE INDEX idx_forum_tags_topic ON forum_topic_tags(topic_id);
CREATE INDEX idx_online_users_last_active ON forum_online_users(last_active);