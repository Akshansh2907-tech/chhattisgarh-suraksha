import { query, pool } from '../config/database.js';

import ForumValidator from './forum-validator.js';

import { ValidationError, TopicNotFoundError, DatabaseError } from './forum-errors.js';



class Forum {

  // Create forum tables if they don't exist

  static async createTables() {

    // Forum topics table

    await query(`

      CREATE TABLE IF NOT EXISTS forum_topics (

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

      )

    `);

        

    // Forum online users table

    await query(`

      CREATE TABLE IF NOT EXISTS forum_online_users (

        user_id INTEGER PRIMARY KEY,

        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        username VARCHAR(100) NOT NULL

      )

    `);



    // Forum replies table

    await query(`

      CREATE TABLE IF NOT EXISTS forum_replies (

        id SERIAL PRIMARY KEY,

        topic_id INTEGER NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,

        author_id INTEGER NOT NULL,

        content TEXT NOT NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

      )

    `);



    // Forum votes table

    await query(`

      CREATE TABLE IF NOT EXISTS forum_votes (

        id SERIAL PRIMARY KEY,

        topic_id INTEGER NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,

        user_id INTEGER NOT NULL,

        vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(topic_id, user_id)

      )

    `);



    // Forum topic tags table

    await query(`

      CREATE TABLE IF NOT EXISTS forum_topic_tags (

        topic_id INTEGER NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,

        tag_name VARCHAR(50) NOT NULL,

        PRIMARY KEY (topic_id, tag_name)

      )

    `);



    console.log('✅ Forum tables created/verified');

  }



  // Get all topics with filters

  static async getAllTopics(filters = {}) {

    console.log('📊 Getting topics with filters:', filters);

        

    // Validate filters

    const validationErrors = ForumValidator.validateSearchParams(filters);

    if (validationErrors.length > 0) {

      throw new ValidationError(validationErrors);

    }



    const {

      category = 'all',

      sort = 'recent',

      status = 'all',

      search = '',

      limit = 20,

      offset = 0

    } = filters;



    // Validate pagination

    const paginationErrors = ForumValidator.validatePaginationParams({ limit, offset });

    if (paginationErrors.length > 0) {

      throw new ValidationError(paginationErrors);

    }



    let whereClause = '';

    const params = [];

    let paramCount = 1;



    // Category filter

    if (category && category !== 'all') {

      whereClause += `ft.category = $${paramCount}`;

      params.push(category);

      paramCount++;

    }



    // Status filter

    if (status === 'pinned') {

      whereClause += (whereClause ? ' AND ' : '') + `ft.is_pinned = true`;

    } else if (status === 'locked') {

      whereClause += (whereClause ? ' AND ' : '') + `ft.is_locked = true`;

    }



    // Search filter

    if (search) {

      whereClause += (whereClause ? ' AND ' : '') +

        `(ft.title ILIKE $${paramCount} OR ft.content ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`;

      params.push(`%${search}%`);

      paramCount++;

    }



    // Sort order

    let orderBy = 'ft.created_at DESC';

    if (sort === 'popular') orderBy = '(COALESCE(COUNT(DISTINCT CASE WHEN fv.vote_type = \'up\' THEN fv.id END), 0) - COALESCE(COUNT(DISTINCT CASE WHEN fv.vote_type = \'down\' THEN fv.id END), 0)) DESC';

    else if (sort === 'replies') orderBy = 'reply_count DESC';

    else if (sort === 'views') orderBy = 'ft.view_count DESC';

    else if (sort === 'oldest') orderBy = 'ft.created_at ASC';



    const sql = `

      SELECT

        ft.id,

        ft.title,

        ft.content,

        ft.category,

        ft.created_at,

        ft.updated_at,

        ft.is_pinned as "isPinned",

        ft.is_locked as "isLocked",

        ft.view_count,

        COALESCE(COUNT(DISTINCT fr.id), 0) as reply_count,

        COALESCE(COUNT(DISTINCT CASE WHEN fv.vote_type = 'up' THEN fv.id END), 0) as upvotes,

        COALESCE(COUNT(DISTINCT CASE WHEN fv.vote_type = 'down' THEN fv.id END), 0) as downvotes,

        ARRAY_AGG(DISTINCT ftt.tag_name) FILTER (WHERE ftt.tag_name IS NOT NULL) as tags,

        u.id as author_id,

        COALESCE(u.full_name, u.phone_number) as author_name

      FROM forum_topics ft

      LEFT JOIN users u ON u.id = ft.author_id

      LEFT JOIN forum_replies fr ON ft.id = fr.topic_id

      LEFT JOIN forum_votes fv ON ft.id = fv.topic_id

      LEFT JOIN forum_topic_tags ftt ON ft.id = ftt.topic_id

      ${whereClause ? 'WHERE ' + whereClause : ''}

      GROUP BY ft.id, u.id, u.full_name, u.phone_number

      ORDER BY ${orderBy}

      LIMIT $${paramCount} OFFSET $${paramCount + 1}

    `;



    params.push(limit, offset);



    const result = await query(sql, params);



    // Get total count for pagination

    const countSql = `

      SELECT COUNT(DISTINCT ft.id) as total

      FROM forum_topics ft

      ${whereClause ? 'WHERE ' + whereClause : ''}

    `;

    const countResult = await query(countSql, params.slice(0, -2));



    return {

      topics: result.rows,

      total: parseInt(countResult.rows[0].total)

    };

  }



  // Get single topic by ID

  static async getTopicById(id) {

    const result = await query(

      `SELECT

        ft.*,

        COALESCE(COUNT(DISTINCT fr.id), 0) as reply_count,

        COALESCE(COUNT(DISTINCT CASE WHEN fv.vote_type = 'up' THEN fv.id END), 0) as upvotes,

        COALESCE(COUNT(DISTINCT CASE WHEN fv.vote_type = 'down' THEN fv.id END), 0) as downvotes,

        ARRAY_AGG(DISTINCT ftt.tag_name) FILTER (WHERE ftt.tag_name IS NOT NULL) as tags

      FROM forum_topics ft

      LEFT JOIN forum_replies fr ON ft.id = fr.topic_id

      LEFT JOIN forum_votes fv ON ft.id = fv.topic_id

      LEFT JOIN forum_topic_tags ftt ON ft.id = ftt.topic_id

      WHERE ft.id = $1

      GROUP BY ft.id`,

      [id]

    );



    return result.rows[0];

  }



  // Create new topic

  static async createTopic(data, userId) {

    // Validate input data

    const validationErrors = ForumValidator.validateTopicData(data);

    if (validationErrors.length > 0) {

      throw new ValidationError(validationErrors);

    }



    const { title, content, category, tags = [] } = data;



    try {

      // Insert topic

      const topicResult = await query(

        `INSERT INTO forum_topics (title, content, category, author_id)

         VALUES ($1, $2, $3, $4)

         RETURNING *`,

        [title, content, category, userId]

      );



      const topic = topicResult.rows[0];

      if (!topic) {

        throw new DatabaseError('Failed to create topic');

      }



      // Insert tags

      if (tags && tags.length > 0) {

        for (const tag of tags.slice(0, 5)) { // Max 5 tags

          await query(

            `INSERT INTO forum_topic_tags (topic_id, tag_name)

             VALUES ($1, $2)

             ON CONFLICT DO NOTHING`,

            [topic.id, tag]

          );

        }

      }



      return topic;

    } catch (error) {

      if (error instanceof ForumError) {

        throw error;

      }

      throw new DatabaseError(error.message);

    }

  }



  // Update topic

  static async updateTopic(id, updates, userId) {

    const { title, content } = updates;



    const result = await query(

      `UPDATE forum_topics

       SET title = COALESCE($1, title),

           content = COALESCE($2, content),

           updated_at = CURRENT_TIMESTAMP

       WHERE id = $3 AND author_id = $4

       RETURNING *`,

      [title, content, id, userId]

    );



    return result.rows[0];

  }



  // Delete topic

  static async deleteTopic(id, userId) {

    const result = await query(

      `DELETE FROM forum_topics

       WHERE id = $1 AND author_id = $2

       RETURNING *`,

      [id, userId]

    );



    return result.rows[0];

  }



  // Add reply to topic

  static async addReply(topicId, content, userId) {

    // Insert reply

    const replyResult = await query(

      `INSERT INTO forum_replies (topic_id, author_id, content)

       VALUES ($1, $2, $3)

       RETURNING *`,

      [topicId, userId, content]

    );



    // Update topic updated_at

    await query(

      `UPDATE forum_topics

       SET updated_at = CURRENT_TIMESTAMP

       WHERE id = $1`,

      [topicId]

    );



    return replyResult.rows[0];

  }



  // Get replies for a topic

  static async getTopicReplies(topicId, limit = 50, offset = 0) {

    const result = await query(

      `SELECT fr.*

       FROM forum_replies fr

       WHERE fr.topic_id = $1

       ORDER BY fr.created_at ASC

       LIMIT $2 OFFSET $3`,

      [topicId, limit, offset]

    );



    // Get total count

    const countResult = await query(

      `SELECT COUNT(*) as total

       FROM forum_replies

       WHERE topic_id = $1`,

      [topicId]

    );



    return {

      replies: result.rows,

      total: parseInt(countResult.rows[0].total)

    };

  }



  // Vote on topic

  static async voteTopic(topicId, userId, voteType) {

    // Check existing vote

    const existingVote = await query(

      `SELECT * FROM forum_votes

       WHERE topic_id = $1 AND user_id = $2`,

      [topicId, userId]

    );



    if (existingVote.rows.length > 0) {

      if (existingVote.rows[0].vote_type === voteType) {

        // Same vote type - remove vote (toggle off)

        await query(

          `DELETE FROM forum_votes

           WHERE topic_id = $1 AND user_id = $2`,

          [topicId, userId]

        );

      } else {

        // Different vote type - update

        await query(

          `UPDATE forum_votes

           SET vote_type = $1

           WHERE topic_id = $2 AND user_id = $3`,

          [voteType, topicId, userId]

        );

      }

    } else {

      // No existing vote - insert new

      await query(

        `INSERT INTO forum_votes (topic_id, user_id, vote_type)

         VALUES ($1, $2, $3)`,

        [topicId, userId, voteType]

      );

    }



    // Get updated vote counts

    const voteResult = await query(

      `SELECT

        COUNT(CASE WHEN vote_type = 'up' THEN 1 END) as upvotes,

        COUNT(CASE WHEN vote_type = 'down' THEN 1 END) as downvotes

       FROM forum_votes

       WHERE topic_id = $1`,

      [topicId]

    );



    // Get user's current vote

    const userVote = await query(

      `SELECT vote_type FROM forum_votes

       WHERE topic_id = $1 AND user_id = $2`,

      [topicId, userId]

    );



    return {

      upvotes: parseInt(voteResult.rows[0].upvotes),

      downvotes: parseInt(voteResult.rows[0].downvotes),

      userVote: userVote.rows[0]?.vote_type || null

    };

  }



  // Increment view count

  static async incrementViewCount(topicId) {

    await query(

      `UPDATE forum_topics

       SET view_count = view_count + 1

       WHERE id = $1`,

      [topicId]

    );

  }



  // Get forum statistics

  static async getForumStats() {

    // First cleanup offline users

    try {

      await query(`SELECT cleanup_offline_users()`);

    } catch (error) {

      console.warn('Warning: cleanup_offline_users() not available:', error.message);

      await this.cleanupOfflineUsers();

    }



    const stats = await query(`

      WITH topic_counts AS (

        SELECT category, COUNT(*) as cnt

        FROM forum_topics

        GROUP BY category

      ),

      online_users AS (

        SELECT COUNT(*) as online_count

        FROM forum_online_users

        WHERE last_active > NOW() - INTERVAL '5 minutes'

      )

      SELECT 

        (SELECT COUNT(*) FROM forum_topics) as total_topics,

        (SELECT COUNT(*) FROM forum_replies) as total_replies,

        COALESCE((SELECT online_count FROM online_users), 0) as online_users,

        (SELECT COUNT(DISTINCT author_id) FROM forum_topics) as total_contributors,

        COALESCE((

          SELECT jsonb_object_agg(category, cnt)

          FROM topic_counts

        ), '{}'::jsonb) as category_counts

    `);



    // Ensure consistent keys (snake_case) returned to frontend

    const row = stats.rows[0] || {};

    return {

      total_topics: parseInt(row.total_topics || 0, 10),

      total_replies: parseInt(row.total_replies || 0, 10),

      online_users: parseInt(row.online_users || 0, 10),

      total_contributors: parseInt(row.total_contributors || 0, 10),

      category_counts: row.category_counts || {}

    };

  }



  // Get top contributors

  static async getTopContributors(limit = 10) {

    const sql = `

      WITH topic_stats AS (

        SELECT 

          t.author_id,

          COUNT(DISTINCT t.id) as topics,

          SUM(t.view_count) as views

        FROM forum_topics t

        GROUP BY t.author_id

      ),

      reply_stats AS (

        SELECT 

          r.author_id,

          COUNT(DISTINCT r.id) as replies

        FROM forum_replies r

        GROUP BY r.author_id

      ),

      vote_stats AS (

        SELECT 

          t.author_id,

          COUNT(CASE WHEN v.vote_type = 'up' THEN 1 END) as upvotes,

          COUNT(CASE WHEN v.vote_type = 'down' THEN 1 END) as downvotes

        FROM forum_topics t

        LEFT JOIN forum_votes v ON v.topic_id = t.id

        GROUP BY t.author_id

      ),

      combined_stats AS (

        SELECT 

          COALESCE(ts.author_id, rs.author_id) as author_id,

          COALESCE(ts.topics, 0) as topics,

          COALESCE(rs.replies, 0) as replies,

          COALESCE(vs.upvotes, 0) as upvotes,

          COALESCE(vs.downvotes, 0) as downvotes,

          COALESCE(ts.views, 0) as views

        FROM topic_stats ts

        FULL OUTER JOIN reply_stats rs ON rs.author_id = ts.author_id

        LEFT JOIN vote_stats vs ON vs.author_id = COALESCE(ts.author_id, rs.author_id)

      )

      SELECT 

        u.id,

        COALESCE(u.full_name, u.phone_number) as username,

        cs.topics,

        cs.replies,

        cs.upvotes - cs.downvotes as reputation,

        cs.views

      FROM combined_stats cs

      JOIN users u ON u.id = cs.author_id

      WHERE cs.topics > 0 OR cs.replies > 0

      ORDER BY reputation DESC, topics DESC, replies DESC

      LIMIT $1

    `;



    const contributors = await query(sql, [limit]);

    return contributors.rows;

  }



  // Update user's online status

  static async updateUserOnlineStatus(userId, username) {

    await query(`

      INSERT INTO forum_online_users (user_id, username, last_active)

      VALUES ($1, $2, CURRENT_TIMESTAMP)

      ON CONFLICT (user_id) 

      DO UPDATE SET last_active = CURRENT_TIMESTAMP

    `, [userId, username]);

  }



  // Cleanup offline users older than 5 minutes

  static async cleanupOfflineUsers() {

    await query(`

      DELETE FROM forum_online_users

      WHERE last_active < NOW() - INTERVAL '5 minutes'

    `);

  }

}



export default Forum;
