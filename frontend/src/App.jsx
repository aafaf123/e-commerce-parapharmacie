// frontend/src/App.jsx
import { useLocation, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ClientNotifications from './components/ClientNotifications'
import Footer from './components/Footer'

function App() {
  const { isAdmin, isAuthenticated } = useAuth()
  const location = useLocation()

  const isAdminRoute = location.pathname.startsWith('/admin')
  const isAuthRoute = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname)
  const hideFooter = isAdminRoute || isAuthRoute

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Banner */}
      {!isAdminRoute && !isAuthRoute && (
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white py-1 px-4 text-center">
          <p className="text-sm md:text-base font-medium">
            Click & Collect : Choisissez vos produits et venez les récupérer en pharmacie
          </p>
        </div>
      )}

      {/* Navbar */}
      {!isAdminRoute && !isAuthRoute && <Navbar />}

      {/* Main */}
      <main className="flex-grow">
        <Outlet />
      </main>

      <ClientNotifications />

      {/* Footer */}
      {!hideFooter && <Footer />}
    </div>
  )
}

export default App