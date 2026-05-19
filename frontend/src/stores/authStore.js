import { create } from 'zustand'

// Nettoyer l'ancienne clé persist au démarrage
localStorage.removeItem('auth-storage')

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  setUser: (userData) => set({ user: userData, isAuthenticated: !!userData, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('auth-storage')
    sessionStorage.removeItem('admin_session')
    sessionStorage.removeItem('session_active')
    set({ user: null, isAuthenticated: false, loading: false, error: null })
  },

  initializeAuth: () => set({ loading: false }),

  getUser: () => get().user,
  getIsAuthenticated: () => get().isAuthenticated,
  getIsAdmin: () => get().user?.role === 'ADMIN',
  getIsEmployee: () => ['ADMIN', 'PREPARATEUR', 'CAISSIER', 'EMPLOYE'].includes(get().user?.role),
}))

export default useAuthStore
