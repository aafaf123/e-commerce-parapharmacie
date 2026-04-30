// frontend/src/App.jsx
import { useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ClientNotifications from './components/ClientNotifications'
import PhoneRequiredModal from './components/PhoneRequiredModal'
import ProfileCompletionBanner from './components/ProfileCompletionBanner'
import Footer from './components/Footer'
import { useState, useEffect, useRef } from 'react'

function App() {
  const { user, loading, logout, updateProfile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [showClickCollectInfo, setShowClickCollectInfo] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const hasCleaned = useRef(false)

  // Afficher le modal téléphone UNIQUEMENT pour les utilisateurs Google sans téléphone
  useEffect(() => {
    if (user && !loading) {
      // Seulement pour les comptes Google
      if (user.authProvider !== 'google') return

      // Seulement si pas de téléphone
      const needsPhone = !user.phone || user.phone.trim() === ''
      if (!needsPhone) return

      // Clé unique par utilisateur : ne montrer qu'une seule fois
      const dismissedKey = `phone_modal_dismissed_${user.id}`
      if (localStorage.getItem(dismissedKey)) return

      // Ne pas afficher sur certaines pages
      const excludedPaths = ['/profile', '/login', '/signup', '/admin']
      if (excludedPaths.some(path => location.pathname.startsWith(path))) return

      setTimeout(() => setShowPhoneModal(true), 2000)
    }
  }, [user?.id, loading])

  // Gérer la soumission du modal téléphone
  const handlePhoneSubmit = async (formData) => {
    try {
      await updateProfile({
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        notificationEmail: formData.notificationEmail,
        notificationSMS: formData.notificationSMS,
        notificationWhatsApp: formData.notificationWhatsApp,
        notificationPush: formData.notificationPush
      })
      // Marquer comme traité pour ne plus jamais afficher
      if (user?.id) localStorage.setItem(`phone_modal_dismissed_${user.id}`, '1')
      setShowPhoneModal(false)
    } catch (error) {
      throw error
    }
  }

  // 🔧 FORCER LA DÉCONNEXION TOTALE UNIQUEMENT SUR L'ACCUEIL
  useEffect(() => {
    // Ne nettoyer qu'une seule fois et seulement sur la page d'accueil
    if (!hasCleaned.current && location.pathname === '/') {
      hasCleaned.current = true
      
      // Vérifier s'il y a quelqu'un de connecté
      const token = localStorage.getItem('token')
      const userStr = localStorage.getItem('user')
      
      if (token || userStr) {
        console.log('🧹 Nettoyage complet - Déconnexion forcée sur accueil')
        
        // Supprimer TOUS les tokens
        console.log('🧹 Nettoyage complet de la session - Déconnexion forcée')
        
        // Supprimer TOUS les tokens et données utilisateur
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminUser')
        localStorage.removeItem('lastVisitedPath')
        
        // Nettoyer les paniers
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('cart_')) {
            localStorage.removeItem(key)
          }
        })
        
        // Si le contexte a une fonction logout, l'appeler aussi
        if (logout) {
          logout()
        } else {
          // Forcer le rechargement pour reset l'état
          window.location.reload()
        }
      }
    }
  }, [location.pathname, logout])

  const isAdminRoute = location.pathname.startsWith('/admin')
  const isAuthRoute = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname)
  const hideFooter = isAdminRoute || isAuthRoute

  // Afficher un loader pendant le chargement
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700"></div>
      </div>
    )
  }

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

      {/* Bannière de profil incomplet */}
      {!isAdminRoute && !isAuthRoute && (
        <ProfileCompletionBanner onOpenModal={() => setShowPhoneModal(true)} />
      )}

      {/* Main */}
      <main className="flex-grow">
        <Outlet />
      </main>

      <ClientNotifications />

      {/* Modal pour compléter le profil */}
      <PhoneRequiredModal
        isOpen={showPhoneModal}
        onClose={() => {
          if (user?.id) localStorage.setItem(`phone_modal_dismissed_${user.id}`, '1')
          setShowPhoneModal(false)
        }}
        onSubmit={handlePhoneSubmit}
        user={user}
      />

      {/* Footer */}
      {!hideFooter && <Footer />}
    </div>
  )
}

export default App