import '../lib/env.js';
import pool from '../db/pool.js';

async function migrateJobStatus() {
  const client = await pool.connect();
  try {
    console.log("Adding status, error_message, and progress_step columns to sessions table...");
    await client.query(`
      ALTER TABLE sessions 
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed',
      ADD COLUMN IF NOT EXISTS error_message TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS progress_step VARCHAR(50) DEFAULT 'ready';

      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON sessions(user_id, status);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
    `);
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrateJobStatus();
