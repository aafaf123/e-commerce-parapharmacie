// frontend/src/components/AdminRoute.jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const AdminRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  const isAdmin = user?.role === 'ADMIN'
  const isEmploye = user?.role === 'EMPLOYE'

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (!isAdmin && !isEmploye) {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    alert('Accès refusé : Vous n\'avez pas les permissions administrateur pour accéder à cette page.')
    return <Navigate to="/" replace />
  }

  // Les EMPLOYE ne peuvent pas accéder au dashboard admin
  if (isEmploye && (location.pathname === '/admin/admindashboard' || location.pathname === '/admin/dashboard')) {
    return <Navigate to="/admin/employee" replace />
  }

  // Les EMPLOYE n'ont pas accès aux pages suivantes
  const employeRestrictedPaths = [
    '/admin/users',
    '/admin/promotions',
    '/admin/reports',
    '/admin/suppliers',
    '/admin/settings',
    '/admin/time-slots'
  ]

  if (isEmploye) {
    const isRestricted = employeRestrictedPaths.some(path => location.pathname.startsWith(path))
    if (isRestricted) {
      // Stocker le message d'accès refusé
      sessionStorage.setItem('accessDeniedMessage', "Vous n'avez pas les permissions nécessaires pour accéder à cette section.")
      return <Navigate to="/admin/employee" replace />
    }
  }

  return children
}

export default AdminRoute
