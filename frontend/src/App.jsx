// frontend/src/App.jsx
import { useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ClientNotifications from './components/ClientNotifications'
import Footer from './components/Footer'
import { useState, useEffect, useRef } from 'react'

function App() {
  const { isAdmin, isAuthenticated } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const hasRedirected = useRef(false)
  const [showClickCollectInfo, setShowClickCollectInfo] = useState(false)

  // 🏠 TOUJOURS forcer à l'accueil au démarrage
  useEffect(() => {
    if (!hasRedirected.current && location.pathname !== '/' && !location.pathname.startsWith('/admin') && !['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname)) {
      hasRedirected.current = true
      navigate('/', { replace: true })
    }
  }, [])

  const isAdminRoute = location.pathname.startsWith('/admin')
  const isAuthRoute = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname)
  const hideFooter = isAdminRoute || isAuthRoute

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Banner */}
      {!isAdminRoute && !isAuthRoute && (
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-2 px-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-4">
            <p className="text-sm md:text-base font-medium text-center">
              <span className="font-bold">Click & Collect :</span> Commandez vos produits parapharmacie et venez les récupérer ou faites-vous livrer
            </p>
            <button
              onClick={() => setShowClickCollectInfo(!showClickCollectInfo)}
              className="bg-white text-emerald-700 px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-emerald-50 transition-colors whitespace-nowrap"
            >
              Comment ça marche ?
            </button>
          </div>
          {showClickCollectInfo && (
            <div className="max-w-3xl mx-auto mt-4 p-4 bg-white/10 rounded-lg text-sm text-center">
              <ol className="list-decimal list-inside space-y-1">
                <li>Parcourez notre catalogue et ajoutez vos produits au panier</li>
                <li>Validez votre commande et choisissez le créneau de retrait</li>
                <li>Suivez le statut de votre commande par email</li>
                <li>Choisissez le retrait en parapharmacie ou la livraison à domicile</li>
              </ol>
            </div>
          )}
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