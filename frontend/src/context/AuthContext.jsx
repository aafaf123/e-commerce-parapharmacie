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
      // IMPORTANT: Garder le rôle de l'utilisateur connecté
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      const mergedUser = { ...userData, role: currentUser.role || userData.role }
      setUser(mergedUser)
      localStorage.setItem('user', JSON.stringify(mergedUser))
    } catch (error) {
      console.error('Erreur chargement profil:', error)
      if (error.response?.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
      }
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        fetchUserProfile()
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
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

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'CAISSIER' || user?.role === 'PREPARATEUR'

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    login,
    loginWithGoogle,
    logout,
    fetchUserProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}