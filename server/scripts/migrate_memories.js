import pool from '../db/pool.js';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running migration for session_memories...");
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS vector;

      CREATE TABLE IF NOT EXISTS session_memories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id UUID NOT NULL,
        user_id UUID NOT NULL,
        track_name VARCHAR(255) NOT NULL,
        topic_text TEXT NOT NULL,
        transcript_summary TEXT NOT NULL,
        strengths TEXT[] NOT NULL DEFAULT '{}',
        weaknesses TEXT[] NOT NULL DEFAULT '{}',
        filler_word_count INTEGER DEFAULT 0,
        wpm INTEGER,
        awkward_pauses INTEGER DEFAULT 0,
        eye_contact_percent INTEGER,
        presence_score INTEGER,
        confidence_score NUMERIC(3,1),
        clarity_score NUMERIC(3,1),
        structure_score NUMERIC(3,1),
        embedding VECTOR(768),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_memories_session
          FOREIGN KEY(session_id)
          REFERENCES sessions(session_id)
          ON DELETE CASCADE,
        CONSTRAINT fk_memories_user
          FOREIGN KEY(user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_session_memories_user_id ON session_memories(user_id);
      CREATE INDEX IF NOT EXISTS idx_session_memories_embedding ON session_memories USING hnsw (embedding vector_cosine_ops);
    `);
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
