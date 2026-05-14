// frontend/src/context/AuthProviderNew.jsx
import { useState, useCallback, useEffect } from 'react'
import { AuthContext } from './AuthContextNew'
import useAuthStore from '../stores/authStore'

const API = import.meta.env.VITE_API_URL || '/api'

export const AuthProviderNew = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        // Si le profil stocké est incomplet (pas de phone/authProvider), fetch le profil complet
        if (parsedUser.role === 'CLIENT' && parsedUser.phone === undefined) {
          fetch(`${API}/user/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null)
            .then(profile => {
              const fullUser = profile ? { ...parsedUser, ...profile } : parsedUser
              localStorage.setItem('user', JSON.stringify(fullUser))
              setUser(fullUser)
              setIsAuthenticated(true)
              useAuthStore.setState({ user: fullUser, isAuthenticated: true })
            })
            .catch(() => {
              setUser(parsedUser)
              setIsAuthenticated(true)
            })
            .finally(() => setInitializing(false))
          return
        }
        setUser(parsedUser)
        setIsAuthenticated(true)
        useAuthStore.setState({ user: parsedUser, isAuthenticated: true })
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setInitializing(false)
  }, [])

  const login = useCallback(async (email, password) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('token', data.token)
        let fullUser = data.user
        if (data.user.role === 'CLIENT') {
          const profileRes = await fetch(`${API}/user/profile`, { headers: { 'Authorization': `Bearer ${data.token}` } })
          if (profileRes.ok) {
            const profile = await profileRes.json()
            fullUser = { ...data.user, ...profile }
          }
        }
        localStorage.setItem('user', JSON.stringify(fullUser))
        setUser(fullUser); setIsAuthenticated(true); setLoading(false)
        useAuthStore.setState({ user: fullUser, isAuthenticated: true })
        return { success: true, user: fullUser }
      }
      setError(data.message); setLoading(false)
      return { success: false, error: data.message, accountDeleted: !!data.accountDeleted }
    } catch {
      setError('Erreur de connexion'); setLoading(false)
      return { success: false, error: 'Erreur de connexion' }
    }
  }, [])

  const adminLogin = useCallback(async (email, password) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setUser(data.user); setIsAuthenticated(true); setLoading(false)
        // Sync Zustand store so components using useAuth() also see the user
        useAuthStore.setState({ user: data.user, isAuthenticated: true })
        return { success: true, user: data.user }
      }
      setError(data.message); setLoading(false)
      return { success: false, error: data.message }
    } catch {
      setError('Erreur de connexion administrateur'); setLoading(false)
      return { success: false, error: 'Erreur de connexion administrateur' }
    }
  }, [])

  const signup = useCallback(async (userData) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData) })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setUser(data.user); setIsAuthenticated(true); setLoading(false)
        useAuthStore.setState({ user: data.user, isAuthenticated: true })
        return { success: true, user: data.user }
      }
      setError(data.message); setLoading(false)
      return { success: false, error: data.message }
    } catch {
      setError("Erreur lors de l'inscription"); setLoading(false)
      return { success: false, error: "Erreur lors de l'inscription" }
    }
  }, [])

  const loginWithGoogle = useCallback(async (credential) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('token', data.token)
        // Fetch full profile to get authProvider, phone, whatsapp
        const profileRes = await fetch(`${API}/user/profile`, { headers: { 'Authorization': `Bearer ${data.token}` } })
        const profile = profileRes.ok ? await profileRes.json() : data.user
        const fullUser = { ...data.user, ...profile }
        localStorage.setItem('user', JSON.stringify(fullUser))
        setUser(fullUser); setIsAuthenticated(true); setLoading(false)
        useAuthStore.setState({ user: fullUser, isAuthenticated: true })
        return { success: true, user: fullUser }
      }
      setError(data.message); setLoading(false)
      return { success: false, error: data.message }
    } catch {
      setError('Erreur de connexion Google'); setLoading(false)
      return { success: false, error: 'Erreur de connexion Google' }
    }
  }, [])

  const updateProfile = useCallback(async (profileData) => {
    setLoading(true); setError(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/user/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(profileData) })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('user', JSON.stringify(data.user))
        setUser(data.user); setLoading(false)
        return { success: true, user: data.user }
      }
      setError(data.message); setLoading(false)
      return { success: false, error: data.message }
    } catch {
      setError('Erreur lors de la mise à jour'); setLoading(false)
      return { success: false, error: 'Erreur lors de la mise à jour' }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null); setIsAuthenticated(false); setError(null)
    useAuthStore.setState({ user: null, isAuthenticated: false })
  }, [])

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, initializing, loading, error,
      login, adminLogin, signup, loginWithGoogle, updateProfile, logout,
      isAdmin: user?.role === 'ADMIN',
      isEmploye: ['ADMIN', 'EMPLOYE', 'PREPARATEUR', 'CAISSIER'].includes(user?.role)
    }}>
      {children}
    </AuthContext.Provider>
  )
}
