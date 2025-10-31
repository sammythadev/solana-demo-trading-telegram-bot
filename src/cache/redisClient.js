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
