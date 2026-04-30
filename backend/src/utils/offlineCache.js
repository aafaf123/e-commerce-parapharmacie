import { cacheGet, cacheSet, cacheDel } from './redisCache.js'

// Durée de cache : 7 jours
const OFFLINE_CACHE_TTL = 7 * 24 * 60 * 60 // 7 jours en secondes

// Clés de cache pour données offline utilisateur
export const OFFLINE_CACHE_KEYS = {
  USER_CATEGORIES: (userId) => `offline:user:${userId}:categories`,
  USER_PRODUCTS: (userId) => `offline:user:${userId}:products`,
  USER_PRODUCT_DETAIL: (userId, productId) => `offline:user:${userId}:product:${productId}`,
  USER_LAST_SYNC: (userId) => `offline:user:${userId}:last_sync`
}

/**
 * Enregistrer qu'un utilisateur a visité une catégorie
 */
export async function cacheUserCategory(userId, category) {
  try {
    const key = OFFLINE_CACHE_KEYS.USER_CATEGORIES(userId)
    
    // Récupérer les catégories existantes
    let categories = await cacheGet(key) || []
    
    // Ajouter la nouvelle catégorie si pas déjà présente
    const exists = categories.find(c => c.id === category.id)
    if (!exists) {
      categories.push({
        id: category.id,
        name: category.name,
        icon: category.icon,
        image: category.image,
        hasSubcategories: category.hasSubcategories,
        subcategories: category.subcategories || [],
        visitedAt: new Date().toISOString()
      })
    } else {
      // Mettre à jour la date de visite
      exists.visitedAt = new Date().toISOString()
      if (category.subcategories) {
        exists.subcategories = category.subcategories
      }
    }
    
    // Limiter à 50 catégories max par utilisateur
    if (categories.length > 50) {
      categories = categories.sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)).slice(0, 50)
    }
    
    await cacheSet(key, categories, OFFLINE_CACHE_TTL)
    await updateLastSync(userId)
    
    return true
  } catch (error) {
    console.error('Erreur cache catégorie utilisateur:', error)
    return false
  }
}

/**
 * Enregistrer qu'un utilisateur a visité des produits
 */
export async function cacheUserProducts(userId, products) {
  try {
    const key = OFFLINE_CACHE_KEYS.USER_PRODUCTS(userId)
    
    // Récupérer les produits existants
    let cachedProducts = await cacheGet(key) || []
    
    // Ajouter/mettre à jour les nouveaux produits
    products.forEach(product => {
      const existingIndex = cachedProducts.findIndex(p => p.id === product.id)
      
      const productToCache = {
        id: product.id,
        name: product.name,
        price: product.price,
        priceHT: product.priceHT,
        priceTTC: product.priceTTC,
        oldPrice: product.oldPrice,
        image: product.image,
        brand: product.brand,
        stock: product.stock,
        rating: product.rating,
        isNew: product.isNew,
        category: product.category ? {
          id: product.category.id,
          name: product.category.name
        } : null,
        visitedAt: new Date().toISOString()
      }
      
      if (existingIndex >= 0) {
        cachedProducts[existingIndex] = productToCache
      } else {
        cachedProducts.push(productToCache)
      }
    })
    
    // Limiter à 200 produits max par utilisateur
    if (cachedProducts.length > 200) {
      cachedProducts = cachedProducts.sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)).slice(0, 200)
    }
    
    await cacheSet(key, cachedProducts, OFFLINE_CACHE_TTL)
    await updateLastSync(userId)
    
    return true
  } catch (error) {
    console.error('Erreur cache produits utilisateur:', error)
    return false
  }
}

/**
 * Enregistrer qu'un utilisateur a visité une fiche produit détaillée
 */
export async function cacheUserProductDetail(userId, product) {
  try {
    const key = OFFLINE_CACHE_KEYS.USER_PRODUCT_DETAIL(userId, product.id)
    
    const productDetail = {
      id: product.id,
      name: product.name,
      description: product.description,
      usage: product.usage,
      composition: product.composition,
      benefits: product.benefits,
      price: product.price,
      priceHT: product.priceHT,
      priceTTC: product.priceTTC,
      oldPrice: product.oldPrice,
      image: product.image,
      images: product.images,
      brand: product.brand,
      stock: product.stock,
      rating: product.rating,
      reviews: product.reviews,
      barcode: product.barcode,
      category: product.category ? {
        id: product.category.id,
        name: product.category.name
      } : null,
      productImages: product.productImages || [],
      productVariants: product.productVariants || [],
      visitedAt: new Date().toISOString()
    }
    
    await cacheSet(key, productDetail, OFFLINE_CACHE_TTL)
    await updateLastSync(userId)
    
    return true
  } catch (error) {
    console.error('Erreur cache détail produit utilisateur:', error)
    return false
  }
}

/**
 * Récupérer toutes les données offline d'un utilisateur
 */
export async function getUserOfflineData(userId) {
  try {
    const [categories, products, lastSync] = await Promise.all([
      cacheGet(OFFLINE_CACHE_KEYS.USER_CATEGORIES(userId)),
      cacheGet(OFFLINE_CACHE_KEYS.USER_PRODUCTS(userId)),
      cacheGet(OFFLINE_CACHE_KEYS.USER_LAST_SYNC(userId))
    ])
    
    return {
      categories: categories || [],
      products: products || [],
      lastSync: lastSync || null,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Erreur récupération données offline:', error)
    return {
      categories: [],
      products: [],
      lastSync: null,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Récupérer un produit détaillé du cache utilisateur
 */
export async function getUserProductDetail(userId, productId) {
  try {
    const key = OFFLINE_CACHE_KEYS.USER_PRODUCT_DETAIL(userId, productId)
    return await cacheGet(key)
  } catch (error) {
    console.error('Erreur récupération détail produit offline:', error)
    return null
  }
}

/**
 * Mettre à jour le timestamp de dernière synchronisation
 */
async function updateLastSync(userId) {
  try {
    const key = OFFLINE_CACHE_KEYS.USER_LAST_SYNC(userId)
    await cacheSet(key, new Date().toISOString(), OFFLINE_CACHE_TTL)
  } catch (error) {
    console.error('Erreur mise à jour last sync:', error)
  }
}

/**
 * Nettoyer le cache d'un utilisateur
 */
export async function clearUserOfflineCache(userId) {
  try {
    await Promise.all([
      cacheDel(OFFLINE_CACHE_KEYS.USER_CATEGORIES(userId)),
      cacheDel(OFFLINE_CACHE_KEYS.USER_PRODUCTS(userId)),
      cacheDel(OFFLINE_CACHE_KEYS.USER_LAST_SYNC(userId))
    ])
    
    // Nettoyer aussi tous les détails de produits
    // Note: En production, il faudrait une meilleure méthode pour nettoyer par pattern
    
    return true
  } catch (error) {
    console.error('Erreur nettoyage cache utilisateur:', error)
    return false
  }
}

export default {
  cacheUserCategory,
  cacheUserProducts,
  cacheUserProductDetail,
  getUserOfflineData,
  getUserProductDetail,
  clearUserOfflineCache
}