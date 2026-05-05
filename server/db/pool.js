/**
 * pool.js — PostgreSQL Connection Pool (Production Hardened)
 */

import pg from 'pg';
import { log } from '../lib/logger.js';

const { Pool } = pg;

// Use the connectionString directly — but we must ensure it is parsed correctly by pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

pool.on('connect', () => {
  log.info('Database pool connected successfully');
});

pool.on('error', (err) => {
  log.error('Unexpected error on idle database client:', err.message);
});

export default pool;
