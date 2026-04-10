// frontend/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import AppRoutes from './routes/index'
import './index.css'
import { WebSocketProvider } from './context/WebSocketContext'
import { AdminWebSocketProvider } from './context/AdminWebSocketContext'

// Pages à ne pas mémoriser (auth, pages transitoires)
const SKIP_SAVE = ['/login', '/signup', '/forgot-password', '/reset-password', '/checkout/confirmation']

// Sauvegarde la dernière page visitée à chaque changement de route
const LastPageTracker = () => {
  const location = useLocation()
  useEffect(() => {
    const path = location.pathname + location.search
    if (!SKIP_SAVE.includes(location.pathname)) {
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
                <AppRoutes />
              </WebSocketProvider>
            </AdminWebSocketProvider>
          </FavoritesProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
