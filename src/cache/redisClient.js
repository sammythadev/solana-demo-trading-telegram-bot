import { createClient } from 'redis';
import { REDIS_URL } from '../config/redis.js';

let client;
export const initRedis = async () => {
  if (client) return client;
  client = createClient({ url: REDIS_URL });
  // Surface runtime errors but don't crash the process here; callers should
  // handle Redis failures gracefully.
  client.on('error', (err) => console.error('Redis error', err));
  await client.connect();
  console.log('Redis connected');
  return client;
};

export const redisGet = async (key) => {
  if (!client) await initRedis();
  return client.get(key);
};

export const redisSet = async (key, value, ttl = 60) => {
  if (!client) await initRedis();
  await client.set(key, value, { EX: ttl });
};

// Simple Redis-backed lock: set key to a random token with NX and PX. Returns
// the token when acquired; caller must pass token to releaseLock.
export const acquireLock = async (key, ttl = 30000) => {
  if (!client) await initRedis();
  const token = Math.random().toString(36).slice(2);
  const res = await client.set(key, token, { NX: true, PX: ttl });
  if (res === 'OK') return token;
  return null;
};

// Release the lock only if the token matches using a Lua script for atomicity.
export const releaseLock = async (key, token) => {
  if (!client) await initRedis();
  const script = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;
  try {
    const res = await client.eval(script, { keys: [key], arguments: [token] });
    return res === 1;
  } catch (err) {
    console.warn('releaseLock error', err && err.message ? err.message : err);
    try { await client.del(key); } catch (e) {}
    return false;
  }
};
