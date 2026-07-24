/**
 * Stage 7.4 — In-memory cache with optional Redis (if REDIS_URL + ioredis installed).
 */
const logger = require('../utils/logger');

const memory = new Map();
let redis = null;
let redisTried = false;

async function getRedis() {
  if (redisTried) return redis;
  redisTried = true;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    // Optional peer dependency
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    const Redis = require('ioredis');
    redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    logger.info('redis.cache.connected');
    return redis;
  } catch (err) {
    logger.info('redis unavailable — using memory cache', { error: err.message });
    redis = null;
    return null;
  }
}

class CacheService {
  constructor() {
    this.hits = 0;
    this.misses = 0;
    this.driver = 'memory';
  }

  async init() {
    const r = await getRedis();
    if (r) this.driver = 'redis';
  }

  _memGet(key) {
    const row = memory.get(key);
    if (!row) return null;
    if (row.exp && row.exp < Date.now()) {
      memory.delete(key);
      return null;
    }
    return row.val;
  }

  _memSet(key, val, ttlSec = 60) {
    memory.set(key, { val, exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 });
  }

  async get(key) {
    const r = await getRedis();
    if (r) {
      try {
        const raw = await r.get(key);
        if (raw == null) {
          this.misses += 1;
          return null;
        }
        this.hits += 1;
        return JSON.parse(raw);
      } catch {
        /* fall through */
      }
    }
    const v = this._memGet(key);
    if (v == null) this.misses += 1;
    else this.hits += 1;
    return v;
  }

  async set(key, value, ttlSec = 60) {
    const r = await getRedis();
    if (r) {
      try {
        await r.set(key, JSON.stringify(value), 'EX', ttlSec);
        return true;
      } catch {
        /* fall through */
      }
    }
    this._memSet(key, value, ttlSec);
    return true;
  }

  async del(key) {
    const r = await getRedis();
    if (r) {
      try {
        await r.del(key);
      } catch {
        /* ignore */
      }
    }
    memory.delete(key);
  }

  async wrap(key, ttlSec, fn) {
    const cached = await this.get(key);
    if (cached != null) return cached;
    const value = await fn();
    await this.set(key, value, ttlSec);
    return value;
  }

  stats() {
    return {
      driver: this.driver,
      memoryKeys: memory.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses ? Math.round((this.hits / (this.hits + this.misses)) * 100) : 0,
    };
  }

  clearMemory() {
    memory.clear();
  }
}

module.exports = new CacheService();
