import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import StoreInitializerNew from './components/StoreInitializerNew'
import { AuthProviderNew } from './context/AuthProviderNew'
import { useAuthNew } from './context/AuthContextNew'
import AppRoutes from './routes/index'
import './index.css'
import { WebSocketProvider } from './context/WebSocketContext'
import { AdminWebSocketProvider } from './context/AdminWebSocketContext'

// Bloque tout rendu jusqu'à ce que l'auth soit initialisée
const AuthGate = ({ children }) => {
  const { initializing } = useAuthNew()
  if (initializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #0369a1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }
  return children
}

// Google Client ID
const GOOGLE_CLIENT_ID = '1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com'

// Pages à ne pas mémoriser (auth, pages transitoires)
const SKIP_SAVE = ['/login', '/signup', '/forgot-password', '/reset-password', '/checkout/confirmation', '/admin']

// Nettoyer lastVisitedPath au démarrage
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
        <AuthProviderNew>
          <AuthGate>
            <StoreInitializerNew>
              <AdminWebSocketProvider>
                <WebSocketProvider>
                  <LastPageTracker />
                  <AppRoutes />
                </WebSocketProvider>
              </AdminWebSocketProvider>
            </StoreInitializerNew>
          </AuthGate>
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
