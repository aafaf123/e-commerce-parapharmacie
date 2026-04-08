// frontend/src/components/PrivateRoute.jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700"></div>
      </div>
    )
  }

  if (!user) {
    // Sauvegarder la destination pour rediriger après login
    const dest = location.pathname + location.search
    return <Navigate to={`/login?redirect=${encodeURIComponent(dest)}`} replace />
  }

  return children
}

export default PrivateRoute