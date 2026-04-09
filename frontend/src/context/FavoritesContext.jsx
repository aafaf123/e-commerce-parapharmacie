// frontend/src/context/FavoritesContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import axios from '../api/axios'
import { useAuth } from './AuthContext'

const FavoritesContext = createContext()

export const useFavorites = () => {
  const context = useContext(FavoritesContext)
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider')
  }
  return context
}

export const FavoritesProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const initialLoadDone = useRef(false)

  // Stabiliser fetchFavorites avec useCallback
  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true)
      const response = await axios.get('/user/favorites')
      const favoritesData = response.data || []
      setFavorites(favoritesData)
      localStorage.setItem('favorites', JSON.stringify(favoritesData))
    } catch (error) {
      console.error('Erreur chargement favoris:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Charger les favoris - UNE SEULE FOIS
  useEffect(() => {
    if (initialLoadDone.current) return
    
    if (isAuthenticated) {
      initialLoadDone.current = true
      fetchFavorites()
    } else {
      const saved = localStorage.getItem('favorites')
      if (saved) {
        try {
          setFavorites(JSON.parse(saved))
        } catch (e) {
          setFavorites([])
        }
      }
      setLoading(false)
    }
  }, [isAuthenticated, fetchFavorites])

  const addFavorite = useCallback(async (product) => {
    if (updating) return false
    
    try {
      setUpdating(true)
      
      if (isAuthenticated) {
        await axios.post('/user/favorites', { productId: product.id })
        setFavorites(prev => {
          const newFavorites = [...prev, product]
          localStorage.setItem('favorites', JSON.stringify(newFavorites))
          return newFavorites
        })
      } else {
        setFavorites(prev => {
          const newFavorites = [...prev, product]
          localStorage.setItem('favorites', JSON.stringify(newFavorites))
          return newFavorites
        })
      }
      console.log('✅ Favori ajouté:', product.name)
      return true
    } catch (error) {
      console.error('Erreur ajout favori:', error)
      return false
    } finally {
      setUpdating(false)
    }
  }, [isAuthenticated, updating])

  const removeFavorite = useCallback(async (productId, productName) => {
    if (updating) return false
    
    try {
      setUpdating(true)
      
      if (isAuthenticated) {
        await axios.delete(`/user/favorites/${productId}`)
        setFavorites(prev => {
          const newFavorites = prev.filter(fav => fav.id !== productId)
          localStorage.setItem('favorites', JSON.stringify(newFavorites))
          return newFavorites
        })
      } else {
        setFavorites(prev => {
          const newFavorites = prev.filter(fav => fav.id !== productId)
          localStorage.setItem('favorites', JSON.stringify(newFavorites))
          return newFavorites
        })
      }
      console.log('✅ Favori retiré:', productName)
      return true
    } catch (error) {
      console.error('Erreur suppression favori:', error)
      return false
    } finally {
      setUpdating(false)
    }
  }, [isAuthenticated, updating])

  // DÉCLARER isFavorite AVANT toggleFavorite
  const isFavorite = useCallback((product) => {
    return favorites.some(fav => fav.id === product.id)
  }, [favorites])

  // MAINTENANT toggleFavorite peut utiliser isFavorite
  const toggleFavorite = useCallback(async (product) => {
    const isFav = isFavorite(product)
    if (isFav) {
      return await removeFavorite(product.id, product.name)
    } else {
      return await addFavorite(product)
    }
  }, [addFavorite, removeFavorite, isFavorite])

  const getFavoritesCount = useCallback(() => favorites.length, [favorites])

  const refreshFavorites = useCallback(() => {
    initialLoadDone.current = false
    fetchFavorites()
  }, [fetchFavorites])

  const value = {
    favorites,
    loading,
    updating,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    getFavoritesCount,
    refreshFavorites
  }

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  )
}