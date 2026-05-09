import { jest } from '@jest/globals';

// ── Mock redisCache ──────────────────────────────────────────────────────────
const store = {};
const mockRedis = {
  cacheGet: jest.fn(async (key) => store[key] ?? null),
  cacheSet: jest.fn(async (key, val) => { store[key] = val; return true; }),
  cacheDel: jest.fn(async (key) => { delete store[key]; return true; }),
};
jest.unstable_mockModule('../../src/utils/redisCache.js', () => mockRedis);

const {
  OFFLINE_CACHE_KEYS,
  cacheUserCategory,
  cacheUserProducts,
  cacheUserProductDetail,
  getUserOfflineData,
  getUserProductDetail,
  clearUserOfflineCache,
} = await import('../../src/utils/offlineCache.js');

const USER_ID = 'user-abc';

// ── OFFLINE_CACHE_KEYS (fonctions pures) ─────────────────────────────────────
describe('OFFLINE_CACHE_KEYS', () => {
  it('USER_CATEGORIES génère la bonne clé', () => {
    expect(OFFLINE_CACHE_KEYS.USER_CATEGORIES('u1')).toBe('offline:user:u1:categories');
  });

  it('USER_PRODUCTS génère la bonne clé', () => {
    expect(OFFLINE_CACHE_KEYS.USER_PRODUCTS('u1')).toBe('offline:user:u1:products');
  });

  it('USER_PRODUCT_DETAIL génère la bonne clé', () => {
    expect(OFFLINE_CACHE_KEYS.USER_PRODUCT_DETAIL('u1', 'p1')).toBe('offline:user:u1:product:p1');
  });

  it('USER_LAST_SYNC génère la bonne clé', () => {
    expect(OFFLINE_CACHE_KEYS.USER_LAST_SYNC('u1')).toBe('offline:user:u1:last_sync');
  });
});

// ── cacheUserCategory ────────────────────────────────────────────────────────
describe('cacheUserCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(store).forEach(k => delete store[k]);
  });

  it('ajoute une catégorie au cache', async () => {
    const cat = { id: 'cat-1', name: 'Soins', icon: '💊' };
    const result = await cacheUserCategory(USER_ID, cat);
    expect(result).toBe(true);
    expect(mockRedis.cacheSet).toHaveBeenCalled();
  });

  it('ne duplique pas une catégorie déjà présente', async () => {
    const cat = { id: 'cat-1', name: 'Soins', icon: '💊' };
    await cacheUserCategory(USER_ID, cat);
    await cacheUserCategory(USER_ID, cat);

    const key = OFFLINE_CACHE_KEYS.USER_CATEGORIES(USER_ID);
    const saved = store[key];
    expect(saved.filter(c => c.id === 'cat-1').length).toBe(1);
  });

  it('met à jour visitedAt si catégorie déjà présente', async () => {
    const cat = { id: 'cat-1', name: 'Soins', icon: '💊' };
    await cacheUserCategory(USER_ID, cat);

    const key = OFFLINE_CACHE_KEYS.USER_CATEGORIES(USER_ID);
    const firstVisit = store[key][0].visitedAt;

    await new Promise(r => setTimeout(r, 5));
    await cacheUserCategory(USER_ID, cat);

    const secondVisit = store[key][0].visitedAt;
    expect(secondVisit >= firstVisit).toBe(true);
  });

  it('limite à 50 catégories max', async () => {
    for (let i = 0; i < 55; i++) {
      await cacheUserCategory(USER_ID, { id: `cat-${i}`, name: `Cat ${i}`, icon: 'x' });
    }
    const key = OFFLINE_CACHE_KEYS.USER_CATEGORIES(USER_ID);
    expect(store[key].length).toBeLessThanOrEqual(50);
  });
});

// ── cacheUserProducts ────────────────────────────────────────────────────────
describe('cacheUserProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(store).forEach(k => delete store[k]);
  });

  it('ajoute des produits au cache', async () => {
    const products = [
      { id: 'p1', name: 'Crème', price: 29.99, stock: 10 },
      { id: 'p2', name: 'Sérum', price: 49.99, stock: 5 },
    ];
    const result = await cacheUserProducts(USER_ID, products);
    expect(result).toBe(true);

    const key = OFFLINE_CACHE_KEYS.USER_PRODUCTS(USER_ID);
    expect(store[key].length).toBe(2);
  });

  it('met à jour un produit existant', async () => {
    await cacheUserProducts(USER_ID, [{ id: 'p1', name: 'Crème', price: 29.99, stock: 10 }]);
    await cacheUserProducts(USER_ID, [{ id: 'p1', name: 'Crème Hydratante', price: 34.99, stock: 8 }]);

    const key = OFFLINE_CACHE_KEYS.USER_PRODUCTS(USER_ID);
    expect(store[key].length).toBe(1);
    expect(store[key][0].name).toBe('Crème Hydratante');
    expect(store[key][0].price).toBe(34.99);
  });

  it('limite à 200 produits max', async () => {
    const batch = Array.from({ length: 210 }, (_, i) => ({
      id: `p-${i}`, name: `Produit ${i}`, price: 10, stock: 5
    }));
    await cacheUserProducts(USER_ID, batch);

    const key = OFFLINE_CACHE_KEYS.USER_PRODUCTS(USER_ID);
    expect(store[key].length).toBeLessThanOrEqual(200);
  });
});

// ── cacheUserProductDetail ───────────────────────────────────────────────────
describe('cacheUserProductDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(store).forEach(k => delete store[k]);
  });

  it('met en cache le détail d\'un produit', async () => {
    const product = {
      id: 'p1', name: 'Crème', description: 'Hydratante',
      price: 29.99, stock: 10, images: [], productVariants: []
    };
    const result = await cacheUserProductDetail(USER_ID, product);
    expect(result).toBe(true);

    const key = OFFLINE_CACHE_KEYS.USER_PRODUCT_DETAIL(USER_ID, 'p1');
    expect(store[key]).toBeTruthy();
    expect(store[key].name).toBe('Crème');
  });
});

// ── getUserOfflineData ───────────────────────────────────────────────────────
describe('getUserOfflineData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(store).forEach(k => delete store[k]);
  });

  it('retourne des tableaux vides si rien en cache', async () => {
    const data = await getUserOfflineData('unknown-user');
    expect(data.categories).toEqual([]);
    expect(data.products).toEqual([]);
    expect(data.lastSync).toBeNull();
    expect(data.timestamp).toBeTruthy();
  });

  it('retourne les données mises en cache', async () => {
    await cacheUserCategory(USER_ID, { id: 'cat-1', name: 'Soins', icon: '💊' });
    await cacheUserProducts(USER_ID, [{ id: 'p1', name: 'Crème', price: 10, stock: 5 }]);

    const data = await getUserOfflineData(USER_ID);
    expect(data.categories.length).toBe(1);
    expect(data.products.length).toBe(1);
  });
});

// ── getUserProductDetail ─────────────────────────────────────────────────────
describe('getUserProductDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(store).forEach(k => delete store[k]);
  });

  it('retourne null si produit pas en cache', async () => {
    const result = await getUserProductDetail(USER_ID, 'p-inexistant');
    expect(result).toBeNull();
  });

  it('retourne le produit mis en cache', async () => {
    const product = { id: 'p1', name: 'Crème', price: 29.99, stock: 10, images: [], productVariants: [] };
    await cacheUserProductDetail(USER_ID, product);

    const result = await getUserProductDetail(USER_ID, 'p1');
    expect(result.name).toBe('Crème');
  });
});

// ── clearUserOfflineCache ────────────────────────────────────────────────────
describe('clearUserOfflineCache', () => {
  it('supprime les clés du cache utilisateur', async () => {
    await cacheUserCategory(USER_ID, { id: 'cat-1', name: 'Soins', icon: '💊' });
    const result = await clearUserOfflineCache(USER_ID);
    expect(result).toBe(true);
    expect(mockRedis.cacheDel).toHaveBeenCalledTimes(3);
  });
});
