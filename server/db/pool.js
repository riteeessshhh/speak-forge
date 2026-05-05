/**
 * pool.js — PostgreSQL Connection Pool
 */

import pg from 'pg';
import url from 'url';

const { Pool } = pg;

// Robust parsing for connection strings with special characters (like @ in passwords)
const params = url.parse(process.env.DATABASE_URL);
const auth = params.auth.split(':');

const pool = new Pool({
  user: auth[0],
  password: auth[1],
  host: params.hostname,
  port: params.port,
  database: params.pathname.split('/')[1],
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
