import { useEffect } from 'react'
import { useAuthStore, useFavoritesStore } from '../stores'

const StoreInitializer = ({ children }) => {
  const initializeAuth = useAuthStore(state => state.initializeAuth)
  const loadFavorites = useFavoritesStore(state => state.loadFavorites)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

  useEffect(() => {
    // Initialiser l'authentification au démarrage
    initializeAuth()
  }, [initializeAuth])

  useEffect(() => {
    // Charger les favoris si l'utilisateur est connecté
    if (isAuthenticated) {
      loadFavorites()
    }
  }, [isAuthenticated, loadFavorites])

  return children
}

export default StoreInitializer