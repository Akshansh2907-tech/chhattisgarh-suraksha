import pkg from 'pg';
const { Pool } = pkg;

// Support DATABASE_URL or individual PG_* env vars. When running via docker-compose
// the compose file sets DATABASE_URL to point to the `postgres` service; prefer
// that when available. Otherwise fall back to sensible defaults for local dev.
const connectionString = process.env.DATABASE_URL || null;

const poolConfig = connectionString
  ? { connectionString }
  : {
      user: process.env.PGUSER || process.env.DB_USER || 'postgres',
      host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
      database: process.env.PGDATABASE || process.env.DB_NAME || 'chhattisgarh_suraksha',
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres123',
      port: process.env.PGPORT || process.env.DB_PORT || 5432
    };

const pool = new Pool(poolConfig);

import Gamification from '../models/gamification.js';

export const dbConnect = async () => {
  try {
    await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100),
        phone_number VARCHAR(15) UNIQUE NOT NULL,
        email VARCHAR(100),
        address TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure gamification columns exist on users (added defensively)
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS achievements_count INTEGER DEFAULT 0;

      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(15) NOT NULL,
        otp_code VARCHAR(6) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        city VARCHAR(50) NOT NULL DEFAULT 'Raipur',
        state VARCHAR(50) NOT NULL DEFAULT 'Chhattisgarh',
        country VARCHAR(50) NOT NULL DEFAULT 'India',
        latitude DECIMAL(10, 8) NOT NULL DEFAULT 21.2514,
        longitude DECIMAL(11, 8) NOT NULL DEFAULT 81.6296,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS air_quality_metrics (
        id SERIAL PRIMARY KEY,
        location_id INTEGER REFERENCES locations(id),
        aqi INTEGER,
        pm25 DECIMAL(10, 2),
        pm10 DECIMAL(10, 2),
        no2 DECIMAL(10, 2),
        so2 DECIMAL(10, 2),
        o3 DECIMAL(10, 2),
        co DECIMAL(10, 2),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Drop existing table if exists
      DROP TABLE IF EXISTS weather_metrics CASCADE;
      
      CREATE TABLE IF NOT EXISTS weather_metrics (
        id SERIAL PRIMARY KEY,
        location_id INTEGER REFERENCES locations(id),
        temperature DECIMAL(6, 2),
        humidity DECIMAL(5, 2),
        wind_speed DECIMAL(5, 2),
        wind_direction VARCHAR(3),
        precipitation DECIMAL(6, 2),
        pressure DECIMAL(8, 2),
        visibility DECIMAL(6, 2),
        uv_index DECIMAL(4, 2),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS environmental_alerts (
        id SERIAL PRIMARY KEY,
        location_id INTEGER REFERENCES locations(id),
        type VARCHAR(20) CHECK (type IN ('air_quality', 'weather', 'emergency', 'general')),
        severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        message TEXT,
        details JSONB,
        is_active BOOLEAN DEFAULT true,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS media_features (
        id BIGSERIAL PRIMARY KEY,
        asset_id TEXT UNIQUE,
        user_id INTEGER REFERENCES users(id),
        report_id BIGINT REFERENCES reports(id),
        filename TEXT,
        url TEXT,
        sha256 TEXT,
        phash TEXT,
        width INTEGER,
        height INTEGER,
        size INTEGER,
        exif JSONB,
        blur_score NUMERIC,
        entropy NUMERIC,
        duplicate_of_asset_id TEXT,
        spam_score NUMERIC DEFAULT 0,
        status VARCHAR(20) DEFAULT 'ok',
        analysis JSONB,
        environment_score NUMERIC,
        ai_suspect BOOLEAN,
        last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Drop existing table if exists
      DROP TABLE IF EXISTS real_time_metrics CASCADE;
      
      CREATE TABLE IF NOT EXISTS real_time_metrics (
        id SERIAL PRIMARY KEY,
        location_id INTEGER REFERENCES locations(id),
        air_quality_id INTEGER REFERENCES air_quality_metrics(id),
        weather_id INTEGER REFERENCES weather_metrics(id),
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Insert default location if not exists
      INSERT INTO locations (city, state, country, latitude, longitude)
      VALUES ('Raipur', 'Chhattisgarh', 'India', 21.2514, 81.6296)
      ON CONFLICT DO NOTHING;
    `);
    
    console.log('Database tables initialized');

    // Run forum stats migration
    await pool.query(`
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
    `);

    // Initialize gamification tables
    await Gamification.createTables();

    await pool.query(`
      ALTER TABLE media_features
      ADD COLUMN IF NOT EXISTS analysis JSONB,
      ADD COLUMN IF NOT EXISTS environment_score NUMERIC,
      ADD COLUMN IF NOT EXISTS ai_suspect BOOLEAN,
      ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);
  } catch (err) {
    console.error('Database connection error:', err);
    throw err;
  }
};

export const query = (text, params) => pool.query(text, params);

export default pool;

// Also provide a named export for legacy imports that expect `{ pool }`.
export { pool };