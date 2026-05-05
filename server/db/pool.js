/**
 * pool.js — PostgreSQL Connection Pool (Production Hardened)
 */

import pg from 'pg';

const { Pool } = pg;

// URL encode the password part of the connection string if it has special characters like '@'
const rawConnectionString = process.env.DATABASE_URL || '';
let connectionString = rawConnectionString;

if (rawConnectionString.includes('@') && rawConnectionString.indexOf('@') !== rawConnectionString.lastIndexOf('@')) {
  // If there are multiple @ symbols, we need to encode the password section
  try {
    const parts = rawConnectionString.split('@');
    const hostPart = parts.pop();
    const authAndPrefix = parts.join('@');
    const prefix = 'postgresql://';
    const authPart = authAndPrefix.startsWith(prefix) ? authAndPrefix.slice(prefix.length) : authAndPrefix;
    
    const [user, ...passwordParts] = authPart.split(':');
    const password = passwordParts.join(':');
    
    connectionString = `postgresql://${user}:${encodeURIComponent(password)}@${hostPart}`;
  } catch (e) {
    console.error('Failed to pre-parse DATABASE_URL, using raw string');
  }
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  // Force IPv4 to avoid ENETUNREACH errors on Render/Supabase
  family: 4, 
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

export default pool;
