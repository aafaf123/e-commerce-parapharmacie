import { jest } from '@jest/globals';

// ── Mock ioredis ─────────────────────────────────────────────────────────────
const mockRedisInstance = {
  get:    jest.fn(),
  setex:  jest.fn(),
  del:    jest.fn(),
  keys:   jest.fn(),
  on:     jest.fn(),
};
jest.unstable_mockModule('ioredis', () => ({
  default: jest.fn(() => mockRedisInstance),
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  CACHE_KEYS,
  isRedisConnected,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  invalidateProductCache,
  invalidateCategoryCache,
} = await import('../../src/utils/redisCache.js');

// ── CACHE_KEYS (fonctions pures) ─────────────────────────────────────────────
describe('CACHE_KEYS', () => {
  it('PRODUCTS_LIST est une constante string', () => {
    expect(CACHE_KEYS.PRODUCTS_LIST).toBe('products:list');
  });

  it('PRODUCTS_LIST_PAGE génère la bonne clé', () => {
    expect(CACHE_KEYS.PRODUCTS_LIST_PAGE(1)).toBe('products:list:page:1');
    expect(CACHE_KEYS.PRODUCTS_LIST_PAGE(5)).toBe('products:list:page:5');
  });

  it('PRODUCT_DETAIL génère la bonne clé', () => {
    expect(CACHE_KEYS.PRODUCT_DETAIL('abc-123')).toBe('products:abc-123');
  });

  it('CATEGORIES_LIST est une constante string', () => {
    expect(CACHE_KEYS.CATEGORIES_LIST).toBe('categories:list');
  });

  it('CATEGORY_DETAIL génère la bonne clé', () => {
    expect(CACHE_KEYS.CATEGORY_DETAIL('cat-1')).toBe('categories:cat-1');
  });

  it('CATEGORIES_TREE est une constante string', () => {
    expect(CACHE_KEYS.CATEGORIES_TREE).toBe('categories:tree');
  });
});

// ── isRedisConnected ─────────────────────────────────────────────────────────
describe('isRedisConnected', () => {
  it('retourne false par défaut (pas encore connecté)', () => {
    expect(isRedisConnected()).toBe(false);
  });
});

// ── Dégradation gracieuse quand Redis est déconnecté ────────────────────────
describe('cacheGet — Redis déconnecté', () => {
  it('retourne null sans lancer d\'erreur', async () => {
    const result = await cacheGet('some:key');
    expect(result).toBeNull();
  });
});

describe('cacheSet — Redis déconnecté', () => {
  it('retourne false sans lancer d\'erreur', async () => {
    const result = await cacheSet('some:key', { data: 'test' });
    expect(result).toBe(false);
  });
});

describe('cacheDel — Redis déconnecté', () => {
  it('retourne false sans lancer d\'erreur', async () => {
    const result = await cacheDel('some:key');
    expect(result).toBe(false);
  });
});

describe('cacheDelPattern — Redis déconnecté', () => {
  it('retourne false sans lancer d\'erreur', async () => {
    const result = await cacheDelPattern('products:*');
    expect(result).toBe(false);
  });
});

describe('invalidateProductCache — Redis déconnecté', () => {
  it('retourne false sans lancer d\'erreur', async () => {
    const result = await invalidateProductCache();
    expect(result).toBe(false);
  });
});

describe('invalidateCategoryCache — Redis déconnecté', () => {
  it('retourne false sans lancer d\'erreur', async () => {
    const result = await invalidateCategoryCache();
    expect(result).toBe(false);
  });
});
