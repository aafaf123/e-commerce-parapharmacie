import jwt from 'jsonwebtoken'
import { cacheUserCategory, cacheUserProducts, cacheUserProductDetail } from '../utils/offlineCache.js'

/**
 * Middleware pour extraire l'ID utilisateur du token JWT (optionnel)
 */
export function extractUserId(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.userId = decoded.userId
    } else {
      // Utilisateur anonyme - utiliser IP + User-Agent comme identifiant
      const ip = req.ip || req.connection.remoteAddress
      const userAgent = req.headers['user-agent'] || ''
      req.userId = `anonymous_${Buffer.from(ip + userAgent).toString('base64').slice(0, 16)}`
    }
  } catch (error) {
    // Token invalide - traiter comme anonyme
    const ip = req.ip || req.connection.remoteAddress
    const userAgent = req.headers['user-agent'] || ''
    req.userId = `anonymous_${Buffer.from(ip + userAgent).toString('base64').slice(0, 16)}`
  }
  
  next()
}

/**
 * Middleware pour tracker les visites de catégories
 */
export function trackCategoryVisit(req, res, next) {
  // Intercepter la réponse pour cacher les catégories visitées
  const originalSend = res.json
  
  res.json = function(data) {
    // Appeler la méthode originale d'abord
    const result = originalSend.call(this, data)
    
    // Puis cacher les données si c'est un succès et qu'on a un userId
    if (req.userId && res.statusCode === 200) {
      // Traitement asynchrone pour ne pas ralentir la réponse
      setImmediate(async () => {
        try {
          if (Array.isArray(data)) {
            // Liste de catégories
            for (const category of data) {
              if (category.id && category.name) {
                await cacheUserCategory(req.userId, category)
              }
            }
          } else if (data.id && data.name) {
            // Catégorie unique
            await cacheUserCategory(req.userId, data)
          }
        } catch (error) {
          console.error('Erreur tracking catégorie:', error)
        }
      })
    }
    
    return result
  }
  
  next()
}

/**
 * Middleware pour tracker les visites de produits
 */
export function trackProductVisit(req, res, next) {
  const originalSend = res.json
  
  res.json = function(data) {
    const result = originalSend.call(this, data)
    
    if (req.userId && res.statusCode === 200) {
      setImmediate(async () => {
        try {
          if (data.products && Array.isArray(data.products)) {
            // Liste de produits avec pagination
            await cacheUserProducts(req.userId, data.products)
          } else if (Array.isArray(data)) {
            // Liste simple de produits
            await cacheUserProducts(req.userId, data)
          } else if (data.id && data.name && data.price !== undefined) {
            // Produit unique - vérifier si c'est un détail complet
            if (data.description || data.productVariants || data.productImages) {
              // Fiche produit détaillée
              await cacheUserProductDetail(req.userId, data)
            } else {
              // Produit simple
              await cacheUserProducts(req.userId, [data])
            }
          }
        } catch (error) {
          console.error('Erreur tracking produit:', error)
        }
      })
    }
    
    return result
  }
  
  next()
}

/**
 * Middleware combiné pour toutes les routes qui doivent être trackées
 */
export function trackOfflineData(req, res, next) {
  extractUserId(req, res, () => {
    // Déterminer le type de tracking basé sur la route
    const path = req.path.toLowerCase()
    
    if (path.includes('categories') || path.includes('categorie')) {
      trackCategoryVisit(req, res, next)
    } else if (path.includes('products') || path.includes('produit')) {
      trackProductVisit(req, res, next)
    } else {
      next()
    }
  })
}

export default {
  extractUserId,
  trackCategoryVisit,
  trackProductVisit,
  trackOfflineData
}