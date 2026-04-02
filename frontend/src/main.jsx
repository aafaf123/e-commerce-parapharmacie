// frontend/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import AppRoutes from './routes/index'
import './index.css'

// CORRECTION: Importer directement les providers (pas de lazy loading)
import { WebSocketProvider } from './context/WebSocketContext'
import { AdminWebSocketProvider } from './context/AdminWebSocketContext'

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