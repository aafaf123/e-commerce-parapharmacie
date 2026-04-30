import { useEffect } from 'react'
import { useAuthStore, useFavoritesStore, usePermissionsStore } from '../stores'

const StoreInitializer = ({ children }) => {
  const initializeAuth = useAuthStore(state => state.initializeAuth)
  const loadFavorites = useFavoritesStore(state => state.loadFavorites)
  const loadPermissions = usePermissionsStore(state => state.loadPermissions)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const user = useAuthStore(state => state.user)

  useEffect(() => {
    // Initialiser l'authentification au démarrage
    initializeAuth()
  }, [initializeAuth])

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

export default StoreInitializer