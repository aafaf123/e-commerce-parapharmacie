// Service pour gérer le mode offline côté client
class OfflineService {
  constructor() {
    this.isOnline = navigator.onLine
    this.offlineData = null
    this.listeners = []
    
    // Écouter les changements de connexion
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
    
    // Charger les données offline au démarrage
    this.loadOfflineData()
  }

  /**
   * Ajouter un listener pour les changements de statut
   */
  addListener(callback) {
    this.listeners.push(callback)
  }

  /**
   * Supprimer un listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback)
  }

  /**
   * Notifier tous les listeners
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback({
          isOnline: this.isOnline,
          hasOfflineData: !!this.offlineData,
          offlineData: this.offlineData
        })
      } catch (error) {
        console.error('Erreur listener offline:', error)
      }
    })
  }

  /**
   * Gérer le passage en ligne
   */
  async handleOnline() {
    console.log('🌐 Connexion rétablie - Mode online')
    this.isOnline = true
    
    // Synchroniser automatiquement les données
    await this.syncOfflineData()
    
    this.notifyListeners()
  }

  /**
   * Gérer le passage hors ligne
   */
  handleOffline() {
    console.log('📱 Connexion perdue - Mode offline')
    this.isOnline = false
    this.notifyListeners()
  }

  /**
   * Charger les données offline depuis le serveur
   */
  async loadOfflineData() {
    try {
      const response = await fetch('/api/offline/data', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        this.offlineData = result.data
        
        // Sauvegarder en localStorage comme backup
        localStorage.setItem('offlineData', JSON.stringify(this.offlineData))
        
        console.log('📦 Données offline chargées:', {
          categories: this.offlineData.categories.length,
          products: this.offlineData.products.length,
          lastSync: this.offlineData.lastSync
        })
      } else {
        // Fallback: charger depuis localStorage
        const cached = localStorage.getItem('offlineData')
        if (cached) {
          this.offlineData = JSON.parse(cached)
          console.log('📦 Données offline chargées depuis localStorage')
        }
      }
    } catch (error) {
      console.error('Erreur chargement données offline:', error)
      
      // Fallback: charger depuis localStorage
      const cached = localStorage.getItem('offlineData')
      if (cached) {
        this.offlineData = JSON.parse(cached)
        console.log('📦 Données offline chargées depuis localStorage (fallback)')
      }
    }
    
    this.notifyListeners()
  }

  /**
   * Synchroniser les données offline
   */
  async syncOfflineData() {
    if (!this.isOnline) return false

    try {
      console.log('🔄 Synchronisation des données offline...')
      
      const response = await fetch('/api/offline/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        this.offlineData = result.data
        
        // Mettre à jour localStorage
        localStorage.setItem('offlineData', JSON.stringify(this.offlineData))
        
        console.log('✅ Synchronisation terminée')
        this.notifyListeners()
        return true
      }
    } catch (error) {
      console.error('Erreur synchronisation:', error)
    }
    
    return false
  }

  /**
   * Obtenir les catégories (online ou offline)
   */
  async getCategories() {
    if (this.isOnline) {
      try {
        const response = await fetch('/api/categories')
        if (response.ok) {
          return await response.json()
        }
      } catch (error) {
        console.error('Erreur fetch categories online:', error)
      }
    }

    // Mode offline ou erreur online
    if (this.offlineData?.categories) {
      console.log('📱 Catégories depuis cache offline')
      return this.offlineData.categories
    }

    return []
  }

  /**
   * Obtenir les produits (online ou offline)
   */
  async getProducts(params = {}) {
    if (this.isOnline) {
      try {
        const queryString = new URLSearchParams(params).toString()
        const response = await fetch(`/api/products?${queryString}`)
        if (response.ok) {
          return await response.json()
        }
      } catch (error) {
        console.error('Erreur fetch products online:', error)
      }
    }

    // Mode offline ou erreur online
    if (this.offlineData?.products) {
      console.log('📱 Produits depuis cache offline')
      
      let products = [...this.offlineData.products]
      
      // Filtrer par catégorie si demandé
      if (params.categoryId) {
        products = products.filter(p => p.category?.id === params.categoryId)
      }
      
      // Filtrer par recherche si demandé
      if (params.search) {
        const search = params.search.toLowerCase()
        products = products.filter(p => 
          p.name.toLowerCase().includes(search) ||
          p.brand?.toLowerCase().includes(search)
        )
      }
      
      // Pagination simple
      const page = parseInt(params.page) || 1
      const limit = parseInt(params.limit) || 12
      const start = (page - 1) * limit
      const end = start + limit
      
      return {
        products: products.slice(start, end),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(products.length / limit),
          total: products.length,
          hasMore: end < products.length
        }
      }
    }

    return { products: [], pagination: { currentPage: 1, totalPages: 1, total: 0, hasMore: false } }
  }

  /**
   * Obtenir un produit détaillé (online ou offline)
   */
  async getProductDetail(productId) {
    if (this.isOnline) {
      try {
        const response = await fetch(`/api/products/${productId}`)
        if (response.ok) {
          return await response.json()
        }
      } catch (error) {
        console.error('Erreur fetch product detail online:', error)
      }
    }

    // Mode offline ou erreur online
    try {
      const response = await fetch(`/api/offline/product/${productId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('📱 Détail produit depuis cache offline')
        return result.data
      }
    } catch (error) {
      console.error('Erreur fetch product offline:', error)
    }

    return null
  }

  /**
   * Vérifier le statut du cache
   */
  async getCacheStatus() {
    try {
      const response = await fetch('/api/offline/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        return result.status
      }
    } catch (error) {
      console.error('Erreur statut cache:', error)
    }
    
    return null
  }

  /**
   * Vérifier si les actions de commande sont autorisées
   */
  canPlaceOrder() {
    return this.isOnline
  }

  /**
   * Obtenir le statut actuel
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      hasOfflineData: !!this.offlineData,
      categoriesCount: this.offlineData?.categories?.length || 0,
      productsCount: this.offlineData?.products?.length || 0,
      lastSync: this.offlineData?.lastSync,
      canPlaceOrder: this.canPlaceOrder()
    }
  }
}

// Instance singleton
const offlineService = new OfflineService()

export default offlineService