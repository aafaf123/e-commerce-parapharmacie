// frontend/src/components/AdminRoute.jsx
import { Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'  // ← Ajouter l'import

const AdminRoute = ({ children }) => {
  const { user, loading: authLoading } = useAuth()  // ← Utiliser le contexte d'authentification
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // 1. Vérifier d'abord via le contexte d'authentification (le plus fiable)
    if (user) {
      if (user.role === 'ADMIN' || user.role === 'CAISSIER' || user.role === 'PREPARATEUR') {
        setIsAdmin(true)
        setLoading(false)
        return
      }
    }
    
    // 2. Fallback: vérifier l'adminToken dans localStorage (pour compatibilité)
    const adminToken = localStorage.getItem('adminToken')
    const adminUser = localStorage.getItem('adminUser')
    
    if (adminToken && adminUser) {
      try {
        const parsedUser = JSON.parse(adminUser)
        if (parsedUser.role === 'ADMIN' || parsedUser.role === 'CAISSIER' || parsedUser.role === 'PREPARATEUR') {
          setIsAdmin(true)
          setLoading(false)
          return
        }
      } catch (error) {
        console.error('Erreur parsing adminUser:', error)
      }
    }
    
    // Si ni le contexte ni le localStorage n'indiquent un admin
    setIsAdmin(false)
    setLoading(false)
  }, [user])  // ← Dépendance à user

  // Attendre que l'authentification soit chargée
  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700"></div>
      </div>
    )
  }

  if (!isAdmin) {
    // ← MODIFICATION ICI : rediriger vers /login au lieu de /admin/login
    return <Navigate to="/login" replace />
  }

  return children
}

export default AdminRoute