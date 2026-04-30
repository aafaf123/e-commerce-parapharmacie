// frontend/src/components/StoreInitializerNew.jsx
import { useEffect } from 'react'
import { useAuthNew } from '../context/AuthContextNew'
import { useFavoritesStore, usePermissionsStore } from '../stores'

const StoreInitializerNew = ({ children }) => {
  const { isAuthenticated, user } = useAuthNew()
  const loadFavorites = useFavoritesStore(state => state.loadFavorites)
  const loadPermissions = usePermissionsStore(state => state.loadPermissions)

  useEffect(() => {
    if (isAuthenticated && user) {
      // Charger les favoris si l'utilisateur est connecté
      loadFavorites()
      
      // Charger les permissions seulement pour les employés (pas les ADMIN)
      if (['PREPARATEUR', 'CAISSIER', 'EMPLOYE'].includes(user.role)) {
        loadPermissions(user.id)
      }
    }
  }, [isAuthenticated, user, loadFavorites, loadPermissions])

  return children
}

export default StoreInitializerNew
