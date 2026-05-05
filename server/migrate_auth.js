/**
 * migrate_auth.js — Clean Slate Migration
 * 
 * 1. Truncates existing sessions, recordings, analytics (clean slate)
 * 2. Creates `users` table
 * 3. Creates `analytics` table
 * 4. Adds FK constraints with ON DELETE CASCADE
 * 
 * Usage: node migrate_auth.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('[Migration] Step 1: Clean Slate — Truncating old data...');
    // Order matters: truncate children first (recordings depends on sessions)
    await client.query('TRUNCATE TABLE recordings CASCADE');
    await client.query('TRUNCATE TABLE sessions CASCADE');
    await client.query('TRUNCATE TABLE generated_topics CASCADE');
    console.log('[Migration] ✓ Old data purged.');

    console.log('[Migration] Step 2: Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Migration] ✓ users table created.');

    console.log('[Migration] Step 3: Updating sessions table...');
    // Drop old user_id column if it exists (it was a plain UUID with no FK)
    await client.query(`
      ALTER TABLE sessions DROP COLUMN IF EXISTS user_id;
    `);
    await client.query(`
      ALTER TABLE sessions ADD COLUMN user_id UUID NOT NULL DEFAULT uuid_generate_v4();
    `);
    await client.query(`
      ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    `);
    // Remove the default after adding the FK (it was only needed to not break the ALTER)
    await client.query(`
      ALTER TABLE sessions ALTER COLUMN user_id DROP DEFAULT;
    `);
    console.log('[Migration] ✓ sessions.user_id linked to users with CASCADE.');

    console.log('[Migration] Step 4: Creating analytics table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id UUID NOT NULL UNIQUE,
        user_id UUID NOT NULL,
        filler_word_count INTEGER NOT NULL DEFAULT 0,
        confidence_score NUMERIC(3,1),
        clarity_score NUMERIC(3,1),
        structure_score NUMERIC(3,1),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_analytics_session
          FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
        CONSTRAINT fk_analytics_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('[Migration] ✓ analytics table created with CASCADE FKs.');

    console.log('[Migration] Step 5: Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`);
    console.log('[Migration] ✓ Indexes created.');

    await client.query('COMMIT');
    console.log('\n[Migration] ══════════════════════════════════════');
    console.log('[Migration] ✅ AUTH & ANALYTICS MIGRATION COMPLETE');
    console.log('[Migration] ══════════════════════════════════════');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] ❌ FAILED — Rolled back:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
