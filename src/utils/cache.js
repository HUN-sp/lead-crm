const { createClient } = require('redis');

let redisClient = null;

// Simple in-memory cache as fallback: key → { value, expiresAt }
const memoryCache = new Map();

const DEFAULT_TTL_SECONDS = 60;

/**
 * Call once at app startup. Tries to connect to Redis.
 * If Redis isn't available, silently falls back to in-memory cache.
 */
async function initCache() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('ℹ️  No REDIS_URL set — using in-memory cache');
    return;
  }

  try {
    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
      // Don't crash on Redis errors — just stop using it
      console.warn('⚠️  Redis error, falling back to memory cache:', err.message);
      redisClient = null;
    });

    await redisClient.connect();
    console.log('✅ Redis cache connected');
  } catch (err) {
    console.warn('⚠️  Redis unavailable, using in-memory cache:', err.message);
    redisClient = null;
  }
}

/**
 * Get a cached value. Returns null on miss or error.
 */
async function get(key) {
  try {
    if (redisClient?.isOpen) {
      const raw = await redisClient.get(key);
      return raw ? JSON.parse(raw) : null;
    }

    // In-memory fallback
    const item = memoryCache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return item.value;
  } catch {
    return null;
  }
}

/**
 * Set a cached value with a TTL (seconds).
 */
async function set(key, value, ttl = DEFAULT_TTL_SECONDS) {
  try {
    if (redisClient?.isOpen) {
      await redisClient.set(key, JSON.stringify(value), { EX: ttl });
      return;
    }

    // In-memory fallback
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
  } catch {
    // Cache failures should never crash the app
  }
}

/**
 * Delete a cached key (call on update/delete).
 */
async function del(key) {
  try {
    if (redisClient?.isOpen) {
      await redisClient.del(key);
      return;
    }
    memoryCache.delete(key);
  } catch {
    // Cache failures should never crash the app
  }
}

module.exports = { initCache, get, set, del };
