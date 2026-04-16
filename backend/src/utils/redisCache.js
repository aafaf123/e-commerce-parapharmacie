import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis;
let isConnected = false;

function getClient() {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        if (times > 10) {
          console.log('Redis connection failed after 10 retries');
          return null;
        }
        return delay;
      },
      lazyConnect: true,
    });

    redis.on('connect', () => {
      isConnected = true;
      console.log('Redis connected');
    });

    redis.on('error', (err) => {
      isConnected = false;
      console.log('Redis error:', err.message);
    });

    redis.on('close', () => {
      isConnected = false;
      console.log('Redis connection closed');
    });
  }
  return redis;
}

export function isRedisConnected() {
  return isConnected;
}

const DEFAULT_TTL = 3600; // 1 hour

export async function cacheGet(key) {
  try {
    const client = getClient();
    if (!isConnected) return null;
    
    const data = await client.get(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Redis cacheGet error:', error);
    return null;
  }
}

export async function cacheSet(key, value, ttl = DEFAULT_TTL) {
  try {
    const client = getClient();
    if (!isConnected) return false;
    
    await client.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis cacheSet error:', error);
    return false;
  }
}

export async function cacheDel(key) {
  try {
    const client = getClient();
    if (!isConnected) return false;
    
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Redis cacheDel error:', error);
    return false;
  }
}

export async function cacheDelPattern(pattern) {
  try {
    const client = getClient();
    if (!isConnected) return false;
    
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
    return true;
  } catch (error) {
    console.error('Redis cacheDelPattern error:', error);
    return false;
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
  PRODUCT_DETAIL: (id) => `products:${id}`,
  CATEGORIES_LIST: 'categories:list',
  CATEGORY_DETAIL: (id) => `categories:${id}`,
  CATEGORIES_TREE: 'categories:tree',
};

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