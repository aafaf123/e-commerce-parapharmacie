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

// Au démarrage : nettoyer la session seulement si c'est un nouveau lancement
// (pas un refresh de page) — utilise sessionStorage comme flag
localStorage.removeItem('lastVisitedPath')
if (!sessionStorage.getItem('app_started')) {
  sessionStorage.setItem('app_started', '1')
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('adminToken')
  localStorage.removeItem('adminUser')
}

// Bloquer l'accès admin si pas de session active
const _storedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null } })()
if (_storedUser && ['ADMIN', 'EMPLOYE'].includes(_storedUser.role) && !sessionStorage.getItem('admin_session')) {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

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
