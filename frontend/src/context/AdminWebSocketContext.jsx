// frontend/src/context/AdminWebSocketContext.jsx
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const AdminWebSocketContext = createContext();

export const useAdminWebSocket = () => {
  const context = useContext(AdminWebSocketContext);
  if (!context) throw new Error('useAdminWebSocket must be used within AdminWebSocketProvider');
  return context;
};

export const AdminWebSocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({ newOrders: 0, pendingOrders: 0, lowStock: 0 });
  const socketRef = useRef(null);

  const addNotification = useCallback((notification) => {
    const n = { ...notification, id: Date.now(), timestamp: new Date() };
    setNotifications(prev => [n, ...prev].slice(0, 50));
    setTimeout(() => setNotifications(prev => prev.filter(x => x.id !== n.id)), 6000);
  }, []);

  useEffect(() => {
    // Utiliser le token utilisateur (admin connecté via /login normal)
    const token = localStorage.getItem('token');
    if (!token) return;

    const s = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    s.on('connect', () => {
      // Authentifier comme admin via Socket.IO
      s.emit('admin_authenticate', token);
    });

    s.on('admin_authenticated', (data) => {
      if (data.success) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    });

    s.on('disconnect', () => setIsConnected(false));

    s.on('admin_new_order', (data) => {
      setStats(prev => ({ ...prev, newOrders: prev.newOrders + 1, pendingOrders: prev.pendingOrders + 1 }));
      addNotification({
        title: '📦 Nouvelle commande',
        message: `Commande ${data.orderNumber} — ${data.customerName || 'Client'}`,
        type: 'order', data
      });
    });

    s.on('admin_order_status_changed', (data) => {
      if (data.status !== 'RECEIVED') {
        setStats(prev => ({ ...prev, pendingOrders: Math.max(0, prev.pendingOrders - 1) }));
      }
      addNotification({
        title: '🔄 Statut mis à jour',
        message: `Commande ${data.orderNumber} → ${data.status}`,
        type: 'status', data
      });
    });

    s.on('admin_order_confirmed', (data) => {
      addNotification({
        title: '✅ Commande confirmée',
        message: `${data.orderNumber} — ${data.customerName}`,
        type: 'order', data
      });
    });

    s.on('admin_order_cancelled', (data) => {
      addNotification({
        title: '❌ Commande annulée',
        message: `Commande ${data.orderNumber}`,
        type: 'cancel', data
      });
    });

    s.on('admin_stock_alert', (data) => {
      setStats(prev => ({ ...prev, lowStock: prev.lowStock + 1 }));
      addNotification({
        title: '⚠️ Alerte stock',
        message: `${data.productName} — ${data.stock} unité(s) restante(s)`,
        type: 'alert', data
      });
    });

    s.on('admin_urgent_order', (data) => {
      addNotification({
        title: '⚡ Commande urgente',
        message: `${data.orderNumber} — retrait dans moins de 2h`,
        type: 'urgent', data
      });
    });

    socketRef.current = s;
    setSocket(s);

    return () => { s.disconnect(); };
  }, [addNotification]);

  return (
    <AdminWebSocketContext.Provider value={{
      isConnected,
      socket,
      stats,
      notifications,
      addNotification,
      removeNotification: (id) => setNotifications(prev => prev.filter(n => n.id !== id)),
      clearNotifications: () => setNotifications([]),
    }}>
      {children}
    </AdminWebSocketContext.Provider>
  );
};
