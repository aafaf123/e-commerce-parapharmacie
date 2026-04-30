import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Database, Clock, RefreshCw } from 'lucide-react'
import offlineService from '../services/offlineService'

const OfflineIndicator = () => {
  const [status, setStatus] = useState(offlineService.getStatus())
  const [isVisible, setIsVisible] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    // Listener pour les changements de statut
    const handleStatusChange = (newStatus) => {
      setStatus(newStatus)
      
      // Afficher l'indicateur quand on passe offline ou qu'on a des données offline
      setIsVisible(!newStatus.isOnline || newStatus.hasOfflineData)
    }

    offlineService.addListener(handleStatusChange)
    
    // État initial
    const initialStatus = offlineService.getStatus()
    setStatus(initialStatus)
    setIsVisible(!initialStatus.isOnline || initialStatus.hasOfflineData)

    return () => {
      offlineService.removeListener(handleStatusChange)
    }
  }, [])

  const handleSync = async () => {
    if (!status.isOnline) return
    
    setIsSyncing(true)
    await offlineService.syncOfflineData()
    setIsSyncing(false)
  }

  const formatLastSync = (lastSync) => {
    if (!lastSync) return 'Jamais'
    
    const date = new Date(lastSync)
    const now = new Date()
    const diffMinutes = Math.floor((now - date) / 1000 / 60)
    
    if (diffMinutes < 1) return 'À l\'instant'
    if (diffMinutes < 60) return `Il y a ${diffMinutes}min`
    if (diffMinutes < 1440) return `Il y a ${Math.floor(diffMinutes / 60)}h`
    return `Il y a ${Math.floor(diffMinutes / 1440)}j`
  }

  if (!isVisible) return null

  return (
    <div className={`fixed top-16 right-4 z-50 transition-all duration-300 ${
      status.isOnline ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
    } border rounded-lg shadow-lg p-3 max-w-sm`}>
      
      {/* Header avec icône de statut */}
      <div className="flex items-center gap-2 mb-2">
        {status.isOnline ? (
          <Wifi size={18} className="text-green-600" />
        ) : (
          <WifiOff size={18} className="text-orange-600" />
        )}
        
        <span className={`font-semibold text-sm ${
          status.isOnline ? 'text-green-800' : 'text-orange-800'
        }`}>
          {status.isOnline ? 'En ligne' : 'Mode hors ligne'}
        </span>
        
        {status.isOnline && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="ml-auto p-1 hover:bg-green-100 rounded transition-colors"
            title="Synchroniser"
          >
            <RefreshCw 
              size={14} 
              className={`text-green-600 ${isSyncing ? 'animate-spin' : ''}`} 
            />
          </button>
        )}
      </div>

      {/* Informations sur le cache */}
      {status.hasOfflineData && (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2 text-gray-600">
            <Database size={12} />
            <span>
              {status.categoriesCount} catégories, {status.productsCount} produits
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600">
            <Clock size={12} />
            <span>Dernière sync: {formatLastSync(status.lastSync)}</span>
          </div>
        </div>
      )}

      {/* Message d'information */}
      <div className={`text-xs mt-2 ${
        status.isOnline ? 'text-green-700' : 'text-orange-700'
      }`}>
        {status.isOnline ? (
          status.hasOfflineData ? 
            'Données synchronisées - Navigation offline disponible' :
            'Naviguez pour créer un cache offline'
        ) : (
          status.hasOfflineData ?
            'Vous pouvez consulter les produits visités' :
            'Aucune donnée offline disponible'
        )}
      </div>

      {/* Actions limitées en mode offline */}
      {!status.isOnline && (
        <div className="mt-2 p-2 bg-orange-100 rounded text-xs text-orange-800">
          ⚠️ Commandes et favoris indisponibles hors ligne
        </div>
      )}
    </div>
  )
}

export default OfflineIndicator