import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      // État
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      // Actions
      setUser: (userData) => set({ 
        user: userData, 
        isAuthenticated: !!userData,
        error: null 
      }),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),

      login: async (email, password) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          })

          const data = await response.json()

          if (response.ok) {
            localStorage.setItem('token', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))
            
            set({ 
              user: data.user, 
              isAuthenticated: true, 
              loading: false,
              error: null 
            })
            
            return { success: true, user: data.user }
          } else {
            set({ error: data.message, loading: false })
            return { success: false, error: data.message }
          }
        } catch (error) {
          const errorMsg = 'Erreur de connexion'
          set({ error: errorMsg, loading: false })
          return { success: false, error: errorMsg }
        }
      },

      signup: async (userData) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
          })

          const data = await response.json()

          if (response.ok) {
            localStorage.setItem('token', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))
            
            set({ 
              user: data.user, 
              isAuthenticated: true, 
              loading: false,
              error: null 
            })
            
            return { success: true, user: data.user }
          } else {
            set({ error: data.message, loading: false })
            return { success: false, error: data.message }
          }
        } catch (error) {
          const errorMsg = 'Erreur lors de l\'inscription'
          set({ error: errorMsg, loading: false })
          return { success: false, error: errorMsg }
        }
      },

      loginWithGoogle: async (credential) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential })
          })

          const data = await response.json()

          if (response.ok) {
            localStorage.setItem('token', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))
            
            set({ 
              user: data.user, 
              isAuthenticated: true, 
              loading: false,
              error: null 
            })
            
            return { success: true, user: data.user }
          } else {
            set({ error: data.message, loading: false })
            return { success: false, error: data.message }
          }
        } catch (error) {
          const errorMsg = 'Erreur de connexion Google'
          set({ error: errorMsg, loading: false })
          return { success: false, error: errorMsg }
        }
      },

      updateProfile: async (profileData) => {
        set({ loading: true, error: null })
        
        try {
          const token = localStorage.getItem('token')
          const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profileData)
          })

          const data = await response.json()

          if (response.ok) {
            localStorage.setItem('user', JSON.stringify(data.user))
            
            set({ 
              user: data.user, 
              loading: false,
              error: null 
            })
            
            return { success: true, user: data.user }
          } else {
            set({ error: data.message, loading: false })
            return { success: false, error: data.message }
          }
        } catch (error) {
          const errorMsg = 'Erreur lors de la mise à jour'
          set({ error: errorMsg, loading: false })
          return { success: false, error: errorMsg }
        }
      },

      logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        set({ 
          user: null, 
          isAuthenticated: false, 
          loading: false,
          error: null 
        })
      },

      initializeAuth: () => {
        const token = localStorage.getItem('token')
        const userData = localStorage.getItem('user')
        
        if (token && userData) {
          try {
            const user = JSON.parse(userData)
            set({ 
              user, 
              isAuthenticated: true,
              loading: false,
              error: null 
            })
          } catch (error) {
            console.error('Erreur parsing user data:', error)
            get().logout()
          }
        } else {
          set({ loading: false })
        }
      },

      // Getters
      getUser: () => get().user,
      getIsAuthenticated: () => get().isAuthenticated,
      getIsAdmin: () => get().user?.role === 'ADMIN',
      getIsEmployee: () => ['ADMIN', 'PREPARATEUR', 'CAISSIER', 'EMPLOYE'].includes(get().user?.role),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      })
    }
  )
)

export default useAuthStore