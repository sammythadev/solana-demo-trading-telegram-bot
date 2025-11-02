import { createClient } from 'redis';
import { REDIS_URL } from '../config/redis.js';

let client;
export const initRedis = async () => {
  if (client) return client;
  client = createClient({ url: REDIS_URL });
  client.on('error', (err) => console.error('Redis error', err));
  await client.connect();
  console.log('Redis connected');
  return client;
};

export const redisGet = async (key) => {
  if (!client) await initRedis();
  const v = await client.get(key);
  return v;
};

export const redisSet = async (key, value, ttl = 60) => {
  if (!client) await initRedis();
  await client.set(key, value, { EX: ttl });
};

// Acquire a simple Redis lock with a token. Returns token string when acquired, or null.
export const acquireLock = async (key, ttl = 30000) => {
  if (!client) await initRedis();
  const token = Math.random().toString(36).slice(2);
  // SET key token NX PX ttl
  const res = await client.set(key, token, { NX: true, PX: ttl });
  if (res === 'OK') return token;
  return null;
};

// Release lock only if token matches (safe unlock)
export const releaseLock = async (key, token) => {
  if (!client) await initRedis();
  // Use Lua script for atomic check-and-del
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
