import { LRUCache } from 'lru-cache';
import { fetchTokenData } from './dexApi.js';
import { redisGet, redisSet } from '../../cache/redisClient.js';

// In-process LRU to cap memory and keep recently-used token entries.
// Tune `max` to control process memory footprint. TTL is configurable here
// for a safe default (5 minutes for metadata; prices are refreshed elsewhere).
const tokenCache = new LRUCache({
    max: 500,
    ttl: 1000 * 60 * 5,
    updateAgeOnGet: true
});

// Track promises for tokens currently being fetched so we coalesce
// duplicate requests (in-flight deduplication).
const inFlightRequests = new Map();

// Lightweight prefetch queue processed in small batches to warm cache
// without blocking request handlers.
const prefetchQueue = new Set();
let prefetchTimer = null;

// Maximum parallel fetches per batch to avoid spiking external API usage.
const BATCH_SIZE = 10;

/**
 * Process prefetch queue in background
 */
async function processPrefetchQueue() {
    if (prefetchQueue.size === 0) {
        prefetchTimer = null;
        return;
    }

    const batch = Array.from(prefetchQueue).slice(0, BATCH_SIZE);
    for (const mint of batch) {
        prefetchQueue.delete(mint);
    }

    try {
        await Promise.all(batch.map(mint => 
            fetchAndCache(mint).catch(err => console.warn(`Prefetch failed for ${mint}:`, err))
        ));
    } catch (err) {
        console.error('Batch prefetch error:', err);
    }

    if (prefetchQueue.size > 0) {
        prefetchTimer = setTimeout(() => processPrefetchQueue(), 100);
    } else {
        prefetchTimer = null;
    }
}

/**
 * Queue a token for background prefetch
 */
export function queuePrefetch(mint) {
    if (!tokenCache.has(mint) && !inFlightRequests.has(mint)) {
        prefetchQueue.add(mint);
        if (!prefetchTimer) {
            prefetchTimer = setTimeout(() => processPrefetchQueue(), 100);
        }
    }
}

/**
 * Fetch and cache a single token's data
 */
async function fetchAndCache(mint) {
    // Check memory cache first
    const cached = tokenCache.get(mint);
    if (cached) return cached;

    // Check for in-flight request
    let inFlight = inFlightRequests.get(mint);
    if (inFlight) return inFlight;

    // Check Redis cache
    try {
        const redisData = await redisGet(`token:${mint}`);
        if (redisData) {
            const parsed = JSON.parse(redisData);
            tokenCache.set(mint, parsed);
            return parsed;
        }
    } catch (err) {
        console.warn('Redis cache read failed:', err);
    }

    // Start new fetch
    inFlight = fetchTokenData(mint).then(async (data) => {
        // Cache successful results
        tokenCache.set(mint, data);
        try {
            await redisSet(`token:${mint}`, JSON.stringify(data), 60); // 1 minute Redis TTL
        } catch (err) {
            console.warn('Redis cache write failed:', err);
        }
        return data;
    }).finally(() => {
        inFlightRequests.delete(mint);
    });

    inFlightRequests.set(mint, inFlight);
    return inFlight;
}

/**
 * Fetch multiple tokens in parallel with batching
 */
export async function fetchTokensBatch(mints) {
    // Split into batches of BATCH_SIZE
    const batches = [];
    for (let i = 0; i < mints.length; i += BATCH_SIZE) {
        batches.push(mints.slice(i, i + BATCH_SIZE));
    }

    // Process batches in parallel
    const results = new Map();
    await Promise.all(batches.map(async batch => {
        const batchResults = await Promise.all(
            batch.map(mint => fetchAndCache(mint)
                .then(data => ({ mint, data }))
                .catch(err => {
                    console.error(`Failed to fetch ${mint}:`, err);
                    return { mint, data: null };
                })
            )
        );
        
        batchResults.forEach(({ mint, data }) => {
            if (data) results.set(mint, data);
        });
    }));

    return results;
}

// Preload tokens that will be needed soon
export function preloadTokens(mints) {
    for (const mint of mints) {
        queuePrefetch(mint);
    }
}