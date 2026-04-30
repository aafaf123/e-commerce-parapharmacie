import { useState, useEffect } from 'react'
import offlineService from '../services/offlineService'

/**
 * Hook pour utiliser le service offline dans les composants React
 */
export const useOffline = () => {
  const [status, setStatus] = useState(offlineService.getStatus())

  useEffect(() => {
    const handleStatusChange = (newStatus) => {
      setStatus(newStatus)
    }

    offlineService.addListener(handleStatusChange)
    
    // Mettre à jour le statut initial
    setStatus(offlineService.getStatus())

    return () => {
      offlineService.removeListener(handleStatusChange)
    }
  }, [])

  return {
    isOnline: status.isOnline,
    isOffline: !status.isOnline,
    hasOfflineData: status.hasOfflineData,
    categoriesCount: status.categoriesCount,
    productsCount: status.productsCount,
    lastSync: status.lastSync,
    canPlaceOrder: status.canPlaceOrder,
    
    // Méthodes du service
    getCategories: offlineService.getCategories.bind(offlineService),
    getProducts: offlineService.getProducts.bind(offlineService),
    getProductDetail: offlineService.getProductDetail.bind(offlineService),
    syncData: offlineService.syncOfflineData.bind(offlineService),
    getCacheStatus: offlineService.getCacheStatus.bind(offlineService)
  }
}

/**
 * Hook pour les données avec fallback offline automatique
 */
export const useOfflineData = (fetchFunction, dependencies = []) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { isOnline } = useOffline()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const result = await fetchFunction()
        setData(result)
      } catch (err) {
        setError(err.message)
        console.error('Erreur fetch avec fallback offline:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isOnline, ...dependencies])

  return { data, loading, error, refetch: () => fetchData() }
}

export default useOffline