import Redis from 'ioredis';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// ── Cache mémoire (fallback quand Redis est absent) ──────────────────────────
const memCache = new Map(); // key → { value, expiresAt }

function memGet(key) {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.value;
}
function memSet(key, value, ttlSeconds) {
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}
function memDel(key) { memCache.delete(key); }
function memDelPattern(pattern) {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  for (const k of memCache.keys()) if (regex.test(k)) memCache.delete(k);
}

// ── Redis (optionnel) ─────────────────────────────────────────────────────────
let redis;
let isConnected = false;

function getClient() {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) return null; // abandon rapidement
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
    });
    redis.on('connect', () => { isConnected = true; logger.info('Redis connected'); });
    redis.on('error', () => { isConnected = false; });
    redis.on('close', () => { isConnected = false; });
  }
  return redis;
}

export function isRedisConnected() { return isConnected; }

const DEFAULT_TTL = 3600;

export async function cacheGet(key) {
  try {
    if (isConnected) {
      const data = await getClient().get(key);
      if (data) return JSON.parse(data);
      return null;
    }
    // Fallback mémoire
    return memGet(key);
  } catch {
    return memGet(key);
  }
}

export async function cacheSet(key, value, ttl = DEFAULT_TTL) {
  try {
    if (isConnected) {
      await getClient().setex(key, ttl, JSON.stringify(value));
      return true;
    }
    // Fallback mémoire
    memSet(key, value, ttl);
    return true;
  } catch {
    memSet(key, value, ttl);
    return true;
  }
}

export async function cacheDel(key) {
  try {
    if (isConnected) await getClient().del(key);
    memDel(key);
    return true;
  } catch {
    memDel(key);
    return true;
  }
}

export async function cacheDelPattern(pattern) {
  try {
    if (isConnected) {
      const keys = await getClient().keys(pattern);
      if (keys.length > 0) await getClient().del(...keys);
    }
    memDelPattern(pattern);
    return true;
  } catch {
    memDelPattern(pattern);
    return true;
  }
}

export function invalidateProductCache() {
  return cacheDelPattern('products:*');
}

export function invalidateCategoryCache() {
  return cacheDelPattern('categories:*');
}

export function invalidateAllCache() {
  return cacheDelPattern('*');
}

export const CACHE_KEYS = {
  PRODUCTS_LIST: 'products:list',
  PRODUCTS_LIST_PAGE: (page) => `products:list:page:${page}`,
  PRODUCT_DETAIL: (id) => `products:detail:${id}`,
  PRODUCTS_SEARCH: (q, limit) => `products:search:${q}:${limit}`,
  CATEGORIES_LIST: 'categories:list',
  CATEGORY_DETAIL: (id) => `categories:${id}`,
  CATEGORIES_TREE: 'categories:tree',
  PROMOTIONS_ACTIVE: 'promotions:active',
  ADMIN_KPIS: 'admin:kpis',
};

export function invalidateAdminKpis() {
  return cacheDel(CACHE_KEYS.ADMIN_KPIS);
}

export default {
  getClient,
  isRedisConnected,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  invalidateProductCache,
  invalidateCategoryCache,
  invalidateAllCache,
  CACHE_KEYS,
};