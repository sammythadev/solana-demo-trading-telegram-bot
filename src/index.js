import './config/env.js';
import { initDB } from './db/index.js';
import { initRedis } from './cache/redisClient.js';
import { initBot } from './bot/index.js';

const start = async () => {
  try {
    await initDB();
    await initRedis();
    await initBot();
    console.log('Bot started.');
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
};

start();
