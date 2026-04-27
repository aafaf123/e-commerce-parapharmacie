// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from '../api/axios'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await axios.get('/user/profile')
      const userData = response.data
      let currentUser = {}
      try {
        const userStr = localStorage.getItem('user')
        if (userStr) {
          currentUser = JSON.parse(userStr)
        }
      } catch (parseError) {
        console.warn('Erreur parsing localStorage user:', parseError)
        localStorage.removeItem('user')
      }
      const mergedUser = { ...userData, role: currentUser.role || userData.role }
      setUser(mergedUser)
      localStorage.setItem('user', JSON.stringify(mergedUser))
    } catch (error) {
      console.error('Erreur chargement profil:', error)
      if (error.response?.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('lastVisitedPath')
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetchUserProfile()
    } else {
      setLoading(false)
    }
  }, [fetchUserProfile])

  const login = useCallback(async (email, password) => {
    try {
      const response = await axios.post('/auth/login', { email, password })
      const { token, user: userData } = response.data

      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
      setUser(userData)

      return { success: true, user: userData }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Erreur de connexion'
      }
    }
  }, [])

  const loginWithGoogle = useCallback(async (credential) => {
    try {
      const response = await axios.post('/auth/google', { credential })
      const { token, user: userData } = response.data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
      return { success: true, user: userData }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Erreur Google' }
    }
  }, [])

  const adminLogin = useCallback(async (email, password) => {
    try {
      const response = await axios.post('/admin/login', { email, password })
      const { token, user: userData } = response.data
      
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('adminToken', token)
      setUser(userData)
      
      return { success: true, user: userData }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Erreur de connexion administrateur'
      }
    }
  }, [])

  const logout = useCallback(() => {
    // Clear ALL cart storage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('cart_')) {
        localStorage.removeItem(key)
      }
    })
    
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('favorites')
    localStorage.removeItem('lastVisitedPath')
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')

    setUser(null)
  }, [])

  const updateProfile = useCallback(async (profileData) => {
    try {
      const response = await axios.put('/user/profile', profileData)
      const updatedUser = response.data.user
      
      // Mettre à jour l'utilisateur local
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      const mergedUser = { ...currentUser, ...updatedUser }
      
      setUser(mergedUser)
      localStorage.setItem('user', JSON.stringify(mergedUser))
      
      return { success: true, user: mergedUser }
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur mise à jour profil')
    }
  }, [])

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'EMPLOYE'
  const isEmploye = user?.role === 'EMPLOYE'
  const isAdminOnly = user?.role === 'ADMIN'

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    isEmploye,
    isAdminOnly,
    login,
    loginWithGoogle,
    adminLogin,
    logout,
    fetchUserProfile,
    updateProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}