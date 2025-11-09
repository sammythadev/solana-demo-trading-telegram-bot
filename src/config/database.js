import { ENV } from './env.js';

// Centralized DB config with sensible pooling defaults. These can be tuned
// via environment variables in production and for pgbouncer setups.
export const DATABASE_URL = ENV.DATABASE_URL;

export const DB_POOL = {
	max: parseInt(ENV.DB_POOL_MAX || '20', 10),
	min: parseInt(ENV.DB_POOL_MIN || '0', 10),
	// how long a client is allowed to remain idle before being closed (ms)
	idle: parseInt(ENV.DB_POOL_IDLE || String(10000), 10),
	// how long to try getting a connection before throwing (ms)
	acquire: parseInt(ENV.DB_POOL_ACQUIRE || String(30000), 10),
	// optional: connectionTimeout in pg Pool
	connectionTimeoutMillis: parseInt(ENV.DB_CONN_TIMEOUT || String(10000), 10),
};

// If using pgbouncer in transaction pooling mode, set this to 'transaction'.
// Some deployments need special handling for prepared statements. Default: 'session'.
export const PGPOOL_MODE = ENV.PGPOOL_MODE || 'session';
