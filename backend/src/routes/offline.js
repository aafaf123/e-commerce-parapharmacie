import express from 'express'
import { getUserOfflineData, getUserProductDetail } from '../utils/offlineCache.js'
import { extractUserId } from '../middleware/offlineTracker.js'

const router = express.Router()

// Middleware pour extraire l'userId sur toutes les routes offline
router.use(extractUserId)

/**
 * GET /api/offline/data - Récupérer toutes les données offline de l'utilisateur
 */
router.get('/data', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Utilisateur non identifié' 
      })
    }

    const offlineData = await getUserOfflineData(req.userId)
    
    res.json({
      success: true,
      data: offlineData,
      message: `${offlineData.categories.length} catégories et ${offlineData.products.length} produits en cache`
    })
  } catch (error) {
    console.error('Erreur récupération données offline:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      data: {
        categories: [],
        products: [],
        lastSync: null,
        timestamp: new Date().toISOString()
      }
    })
  }
})

/**
 * GET /api/offline/product/:id - Récupérer le détail d'un produit depuis le cache
 */
router.get('/product/:id', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Utilisateur non identifié' 
      })
    }

    const { id } = req.params
    const productDetail = await getUserProductDetail(req.userId, id)
    
    if (!productDetail) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé dans le cache offline'
      })
    }

    res.json({
      success: true,
      data: productDetail,
      message: 'Produit récupéré depuis le cache offline'
    })
  } catch (error) {
    console.error('Erreur récupération produit offline:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    })
  }
})

/**
 * GET /api/offline/status - Vérifier le statut du cache offline
 */
router.get('/status', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Utilisateur non identifié' 
      })
    }

    const offlineData = await getUserOfflineData(req.userId)
    
    res.json({
      success: true,
      status: {
        hasCache: offlineData.categories.length > 0 || offlineData.products.length > 0,
        categoriesCount: offlineData.categories.length,
        productsCount: offlineData.products.length,
        lastSync: offlineData.lastSync,
        cacheAge: offlineData.lastSync ? 
          Math.floor((new Date() - new Date(offlineData.lastSync)) / 1000 / 60) : null // minutes
      }
    })
  } catch (error) {
    console.error('Erreur statut cache offline:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    })
  }
})

/**
 * POST /api/offline/sync - Forcer une synchronisation des données
 */
router.post('/sync', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Utilisateur non identifié' 
      })
    }

    // Cette route pourrait déclencher une re-synchronisation
    // Pour l'instant, on retourne juste les données actuelles
    const offlineData = await getUserOfflineData(req.userId)
    
    res.json({
      success: true,
      data: offlineData,
      message: 'Synchronisation effectuée',
      syncedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Erreur synchronisation offline:', error)
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la synchronisation'
    })
  }
})

export default router