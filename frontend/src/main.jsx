import './i18n/index.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import AppRoutes from './routes/index'
import './index.css'
import { WebSocketProvider } from './context/WebSocketContext'
import { AdminWebSocketProvider } from './context/AdminWebSocketContext'
import { PermissionsProvider } from './context/PermissionsContext'

// Google Client ID
const GOOGLE_CLIENT_ID = '1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com'

// Pages à ne pas mémoriser (auth, pages transitoires)
const SKIP_SAVE = ['/login', '/signup', '/forgot-password', '/reset-password', '/checkout/confirmation', '/admin']

// Nettoyer lastVisitedPath au démarrage pour always ouvrir sur l'accueil
localStorage.removeItem('lastVisitedPath')

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
        <AuthProvider>
          <PermissionsProvider>
          <CartProvider>
            <FavoritesProvider>
              <AdminWebSocketProvider>
                <WebSocketProvider>
                  <LastPageTracker />
                  <AppRoutes />
                </WebSocketProvider>
              </AdminWebSocketProvider>
            </FavoritesProvider>
          </CartProvider>
          </PermissionsProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
)