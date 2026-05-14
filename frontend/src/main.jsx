import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import StoreInitializerNew from './components/StoreInitializerNew'
import { AuthProviderNew } from './context/AuthProviderNew'
import AppRoutes from './routes/index'
import './index.css'
import { WebSocketProvider } from './context/WebSocketContext'
import { AdminWebSocketProvider } from './context/AdminWebSocketContext'

// Google Client ID
const GOOGLE_CLIENT_ID = '1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com'

// Pages à ne pas mémoriser (auth, pages transitoires)
const SKIP_SAVE = ['/login', '/signup', '/forgot-password', '/reset-password', '/checkout/confirmation', '/admin']

// Au démarrage : toujours commencer sur la page d'accueil
// Nettoyer lastVisitedPath pour ne jamais restaurer une session
localStorage.removeItem('lastVisitedPath')

// Si l'utilisateur stocké n'est pas admin/employé, nettoyer toute trace admin
try {
  const storedUser = JSON.parse(localStorage.getItem('user') || 'null')
  if (storedUser && !['ADMIN', 'EMPLOYE'].includes(storedUser.role)) {
    // Client normal — s'assurer qu'il ne peut pas accéder aux routes admin
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
  }
  // Si pas d'utilisateur stocké, nettoyer tout
  if (!storedUser) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
  }
} catch {}

// Sauvegarde la dernière page visitée à chaque changement de route
const LastPageTracker = () => {
  const location = useLocation()
  useEffect(() => {
    const path = location.pathname + location.search
    if (!SKIP_SAVE.includes(location.pathname) && !location.pathname.startsWith('/admin')) {
      localStorage.setItem('lastVisitedPath', path)
    }
  }, [location])
  return null
}

// Wrapper pour gérer les erreurs Google OAuth
const AppWrapper = () => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} onScriptTagError={() => {
      console.warn('⚠️ Google OAuth script failed to load. Google Sign-In will be unavailable.')
    }}>
      <BrowserRouter>
        <AuthProviderNew>
          <StoreInitializerNew>
            <AdminWebSocketProvider>
              <WebSocketProvider>
                <LastPageTracker />
                <AppRoutes />
              </WebSocketProvider>
            </AdminWebSocketProvider>
          </StoreInitializerNew>
        </AuthProviderNew>
      </BrowserRouter>
    </GoogleOAuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
)
