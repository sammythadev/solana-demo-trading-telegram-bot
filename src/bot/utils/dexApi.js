import axios from 'axios';
import { DEFAULTS } from '../../config/constants.js';
import { redisGet, redisSet } from '../../cache/redisClient.js';

const BASE = DEFAULTS.DEXSCREENER_BASE_URL;

// In-memory cache to avoid Redis/network for hot lookups
const memCache = new Map(); // mint -> { expires: number, data: object }
const inFlight = new Map(); // mint -> Promise
const MEM_TTL = 30 * 1000; // 30 seconds

// simple concurrency limiter for outgoing HTTP requests
let activeRequests = 0;
const MAX_CONCURRENCY = 6;
const requestQueue = [];

const runWithLimit = (fn) => {
  return new Promise((resolve, reject) => {
    const exec = async () => {
      activeRequests++;
      try {
        const r = await fn();
        resolve(r);
      } catch (err) {
        reject(err);
      } finally {
        activeRequests--;
        if (requestQueue.length > 0) {
          const next = requestQueue.shift();
          next();
        }
      }
    };

    if (activeRequests < MAX_CONCURRENCY) exec();
    else requestQueue.push(exec);
  });
};

export const fetchTokenData = async (mint) => {
  if (!mint) return null;
  const now = Date.now();
  // check in-memory cache first
  const cached = memCache.get(mint);
  if (cached && cached.expires > now) return cached.data;

  // check Redis next (still async)
  try {
    const key = `dex:${mint}`;
    const r = await redisGet(key);
    if (r) {
      const parsed = JSON.parse(r);
      memCache.set(mint, { expires: now + MEM_TTL, data: parsed });
      return parsed;
    }
  } catch (err) {
    // Redis failures should not block functionality
    console.warn('redisGet failed for', mint, err && err.message ? err.message : err);
  }

  // if a request for this mint is already in-flight, return the same promise
  if (inFlight.has(mint)) return inFlight.get(mint);

  const url = `${BASE}/${mint}`;
  const p = runWithLimit(() => axios.get(url)).then(async (res) => {
    if (!res || !res.data) return null;
    const data = res.data;
    memCache.set(mint, { expires: Date.now() + MEM_TTL, data });
    // best-effort Redis set
    try {
      await redisSet(`dex:${mint}`, JSON.stringify(data), 60);
    } catch (err) {
      console.warn('redisSet failed for', mint, err && err.message ? err.message : err);
    }
    return data;
  }).catch((err) => {
    console.error('fetchTokenData error', mint, err && err.message ? err.message : err);
    return null;
  }).finally(() => {
    inFlight.delete(mint);
  });

  inFlight.set(mint, p);
  return p;
};
