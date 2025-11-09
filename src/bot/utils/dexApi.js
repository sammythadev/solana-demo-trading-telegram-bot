import axios from 'axios';
import http from 'http';
import https from 'https';
import { DEFAULTS } from '../../config/constants.js';
import { redisGet, redisSet } from '../../cache/redisClient.js';

const BASE = DEFAULTS.DEXSCREENER_BASE_URL;

// Short in-process cache to avoid hitting Redis/external API for very hot
// lookups. We keep entries small and short-lived (prices change frequently).
const memCache = new Map(); // mint -> { expires: number, data: object }
const inFlight = new Map(); // mint -> Promise resolving to data
const MEM_TTL = 30 * 1000; // keep in-memory price data for 30s

// Limit concurrent outbound HTTP requests to avoid spikes. We create an
// axios instance that reuses TCP/TLS connections (keepAlive) and a simple
// queue to bound concurrency.
const MAX_CONCURRENCY = 6;
let activeRequests = 0;
const requestQueue = [];

// Axios instance with keepAlive agents and a sane timeout.
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
const axiosInstance = axios.create({
  timeout: 10000,
  httpAgent,
  httpsAgent,
});

const runWithLimit = (fn) => new Promise((resolve, reject) => {
  const exec = async () => {
    activeRequests += 1;
    try {
      const r = await fn();
      resolve(r);
    } catch (err) {
      reject(err);
    } finally {
      activeRequests -= 1;
      if (requestQueue.length > 0) requestQueue.shift()();
    }
  };

  if (activeRequests < MAX_CONCURRENCY) exec();
  else requestQueue.push(exec);
});

// Fetch token data from Dexscreener with multi-layer caching and request
// coalescing. Returns parsed API response or null on error.
export const fetchTokenData = async (mint) => {
  if (!mint) return null;
  const now = Date.now();

  // 1) In-process cache
  const cached = memCache.get(mint);
  if (cached && cached.expires > now) return cached.data;

  // 2) Shared Redis cache (best-effort)
  try {
    const key = `dex:${mint}`;
    const raw = await redisGet(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      memCache.set(mint, { expires: now + MEM_TTL, data: parsed });
      return parsed;
    }
  } catch (err) {
    // Redis issues should not prevent the app from functioning
    console.warn('redisGet failed for', mint, err && err.message ? err.message : err);
  }

  // 3) If a fetch is already in progress for this mint, return the same promise
  if (inFlight.has(mint)) return inFlight.get(mint);

  // 4) Issue the external request through the concurrency limiter
  const url = `${BASE}/${mint}`;
  const p = runWithLimit(() => axiosInstance.get(url)).then(async (res) => {
    if (!res || !res.data) return null;
    const data = res.data;
    memCache.set(mint, { expires: Date.now() + MEM_TTL, data });
    // best-effort write to Redis to warm the shared cache
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
