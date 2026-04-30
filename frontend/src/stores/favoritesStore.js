import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useFavoritesStore = create(
  persist(
    (set, get) => ({
      // État
      favorites: [],
      loading: false,
      error: null,

      // Actions
      setFavorites: (favorites) => set({ favorites, error: null }),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),

      addToFavorites: async (product) => {
        const { favorites } = get()
        
        // Vérifier si déjà en favoris
        if (favorites.some(fav => fav.id === product.id)) {
          return { success: false, message: 'Produit déjà en favoris' }
        }

        // Ajouter localement d'abord pour une UX réactive
        set({ 
          favorites: [...favorites, product],
          error: null 
        })

        try {
          const token = localStorage.getItem('token')
          if (!token) {
            // Revenir en arrière si pas connecté
            set({ favorites })
            return { success: false, message: 'Connexion requise' }
          }

          const response = await fetch('/api/favorites', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ productId: product.id })
          })

          if (response.ok) {
            return { success: true, message: 'Ajouté aux favoris' }
          } else {
            // Revenir en arrière en cas d'erreur
            set({ favorites })
            const data = await response.json()
            set({ error: data.message })
            return { success: false, message: data.message }
          }
        } catch (error) {
          // Revenir en arrière en cas d'erreur
          set({ favorites, error: 'Erreur de connexion' })
          return { success: false, message: 'Erreur de connexion' }
        }
      },

      removeFromFavorites: async (productId) => {
        const { favorites } = get()
        const originalFavorites = [...favorites]
        
        // Supprimer localement d'abord
        set({ 
          favorites: favorites.filter(fav => fav.id !== productId),
          error: null 
        })

        try {
          const token = localStorage.getItem('token')
          if (!token) {
            // Revenir en arrière si pas connecté
            set({ favorites: originalFavorites })
            return { success: false, message: 'Connexion requise' }
          }

          const response = await fetch(`/api/favorites/${productId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (response.ok) {
            return { success: true, message: 'Retiré des favoris' }
          } else {
            // Revenir en arrière en cas d'erreur
            set({ favorites: originalFavorites })
            const data = await response.json()
            set({ error: data.message })
            return { success: false, message: data.message }
          }
        } catch (error) {
          // Revenir en arrière en cas d'erreur
          set({ favorites: originalFavorites, error: 'Erreur de connexion' })
          return { success: false, message: 'Erreur de connexion' }
        }
      },

      toggleFavorite: async (product) => {
        const { favorites } = get()
        const isFavorite = favorites.some(fav => fav.id === product.id)
        
        if (isFavorite) {
          return await get().removeFromFavorites(product.id)
        } else {
          return await get().addToFavorites(product)
        }
      },

      loadFavorites: async () => {
        set({ loading: true, error: null })
        
        try {
          const token = localStorage.getItem('token')
          if (!token) {
            set({ loading: false, favorites: [] })
            return
          }

          const response = await fetch('/api/favorites', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (response.ok) {
            const data = await response.json()
            set({ 
              favorites: data.favorites || [], 
              loading: false,
              error: null 
            })
          } else {
            const data = await response.json()
            set({ 
              error: data.message, 
              loading: false,
              favorites: [] 
            })
          }
        } catch (error) {
          set({ 
            error: 'Erreur lors du chargement', 
            loading: false,
            favorites: [] 
          })
        }
      },

      clearFavorites: () => set({ 
        favorites: [], 
        error: null 
      }),

      // Getters
      isFavorite: (productId) => {
        const { favorites } = get()
        return favorites.some(fav => fav.id === productId)
      },

      getFavoriteCount: () => {
        const { favorites } = get()
        return favorites.length
      },

      getFavoritesByCategory: (categoryId) => {
        const { favorites } = get()
        return favorites.filter(fav => fav.categoryId === categoryId)
      },

      getFavoriteIds: () => {
        const { favorites } = get()
        return favorites.map(fav => fav.id)
      }
    }),
    {
      name: 'favorites-storage',
      partialize: (state) => ({
        favorites: state.favorites
      })
    }
  )
)

export default useFavoritesStore