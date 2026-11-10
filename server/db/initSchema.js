/**
 * db/initSchema.js — Idempotent Startup Schema Migration & Self-Healing
 *
 * Ensures production PostgreSQL (Supabase/Render) matches expected schema,
 * columns, and UNIQUE indexes required for ON CONFLICT upserts.
 */

import pool from './pool.js';
import { log } from '../lib/logger.js';

let schemaReadyPromise = null;
let schemaVerified = false;

export function isSchemaReady() {
  return schemaVerified;
}

export async function ensureDatabaseSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    const client = await pool.connect();
    try {
      await client.query(`
        ALTER TABLE sessions
          ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed',
          ADD COLUMN IF NOT EXISTS error_message TEXT DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS progress_step VARCHAR(50) DEFAULT 'ready',
          ADD COLUMN IF NOT EXISTS audio_url TEXT DEFAULT NULL;

        CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON sessions(user_id, status);
      `);

      // Verify if recordings(session_id) already has a UNIQUE index or UNIQUE constraint
      const uniqueCheck = await client.query(`
        SELECT 1
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
        WHERE t.relname = 'recordings'
          AND i.indisunique = true
          AND array_length(i.indkey, 1) = 1
          AND a.attname = 'session_id'
        LIMIT 1;
      `);

      if (uniqueCheck.rowCount === 0) {
        log.warn('[DB Schema] recordings(session_id) lacks UNIQUE index — migrating now...');

        // Deduplicate any historical duplicate rows, retaining the latest created_at
        await client.query(`
          DELETE FROM recordings a
          USING recordings b
          WHERE a.session_id = b.session_id
            AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.recording_id::text < b.recording_id::text));
        `);

        // Drop old non-unique index if it exists so the UNIQUE index can take its place
        await client.query(`DROP INDEX IF EXISTS idx_recordings_session_id;`);
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);`);
        log.info('[DB Schema] Created UNIQUE index idx_recordings_session_id on recordings(session_id).');
      }

      // Also ensure analytics(session_id) has a unique constraint/index
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_session_id_unique ON analytics(session_id);`);

      schemaVerified = true;
      log.info('[DB Schema] Schema verification complete.');
    } catch (err) {
      log.error('[DB Schema] Auto-migration failed:', err.message);
      throw err;
    } finally {
      client.release();
    }
  })();

  return schemaReadyPromise;
}

/**
 * Waits up to maxWaitMs for startup schema verification without blocking callers indefinitely.
 */
export async function awaitSchemaReady(maxWaitMs = 10000) {
  if (schemaVerified) return true;
  const target = schemaReadyPromise || ensureDatabaseSchema();
  try {
    await Promise.race([
      target,
      new Promise((resolve) => setTimeout(resolve, maxWaitMs)),
    ]);
  } catch {
    // Allow routes to proceed cleanly or surface explicit DB query errors
  }
  return schemaVerified;
}

