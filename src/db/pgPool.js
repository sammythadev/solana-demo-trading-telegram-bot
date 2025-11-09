import { Pool } from 'pg';
import { DATABASE_URL, DB_POOL } from '../config/database.js';

// pg.Pool configured with the same tuning surface as Sequelize. Use this
// for low-overhead raw queries (fewer allocations than Sequelize) and
// short-lived transactions.
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: DB_POOL.max,
  idleTimeoutMillis: DB_POOL.idle,
  connectionTimeoutMillis: DB_POOL.connectionTimeoutMillis,
});

// Log and swallow errors from idle clients to avoid crashing the process.
pool.on('error', (err) => {
  console.error('Unexpected idle client error in pg pool', err);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function getClient() {
  // Return a checked-out client for transactional work. Caller must call
  // `client.release()` when finished.
  return pool.connect();
}

export default pool;
