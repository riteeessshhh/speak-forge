import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  console.log('Starting migration...');
  const client = await pool.connect();
  try {
    const res = await client.query('ALTER TABLE generated_topics ADD COLUMN IF NOT EXISTS is_behavioral BOOLEAN DEFAULT FALSE;');
    console.log('Migration successful:', res);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
