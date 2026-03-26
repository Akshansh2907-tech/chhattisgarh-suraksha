-- Indices for forum_topics table
CREATE INDEX IF NOT EXISTS idx_forum_topics_created_at ON forum_topics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_topics_category ON forum_topics(category);
CREATE INDEX IF NOT EXISTS idx_forum_topics_view_count ON forum_topics(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_forum_topics_author ON forum_topics(author_id);

-- Full text search indices for title and content
CREATE INDEX IF NOT EXISTS idx_forum_topics_title_trgm ON forum_topics USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_forum_topics_content_trgm ON forum_topics USING gin(content gin_trgm_ops);

-- Indices for forum_votes table
CREATE INDEX IF NOT EXISTS idx_forum_votes_topic_type ON forum_votes(topic_id, vote_type);

-- Indices for forum_replies table
CREATE INDEX IF NOT EXISTS idx_forum_replies_topic ON forum_replies(topic_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_created_at ON forum_replies(created_at);

-- Indices for forum_topic_tags table
CREATE INDEX IF NOT EXISTS idx_forum_topic_tags_name ON forum_topic_tags(tag_name);

-- Add gin_trgm extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;