// frontend/src/components/AdminRoute.jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const AdminRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'CAISSIER' || user?.role === 'PREPARATEUR'

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700" />
      </div>
    )
  }

  if (!isAuthenticated) {
    // Preserve the intended destination so Login can redirect back after auth
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (!isAdmin) {
    // Clear admin tokens and redirect to home with a message
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    
    // Show an alert to inform the user they don't have admin access
    alert('Accès refusé : Vous n\'avez pas les permissions administrateur pour accéder à cette page.')
    
    return <Navigate to="/" replace />
  }

  return children
}

export default AdminRoute
