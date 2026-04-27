// frontend/src/main.dev.jsx
// Version alternative SANS Google OAuth pour développement local
// Utiliser cette version si vous avez des problèmes avec Google OAuth

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import AppRoutes from './routes/index'
import './index.css'
import { WebSocketProvider } from './context/WebSocketContext'
import { AdminWebSocketProvider } from './context/AdminWebSocketContext'

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)