// frontend/src/context/EmployeeDashboardContext.jsx
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import adminApi from '../api/adminAxios';

const EmployeeDashboardContext = createContext();

export const useEmployeeDashboard = () => {
  const context = useContext(EmployeeDashboardContext);
  if (!context) throw new Error('useEmployeeDashboard must be used within EmployeeDashboardProvider');
  return context;
};

export const EmployeeDashboardProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({ newOrders: 0, pendingOrders: 0, lowStock: 0, urgentOrders: 0 });

  // Données temps réel
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [urgentOrders, setUrgentOrders] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  const socketRef = useRef(null);

  const addNotification = useCallback((notification) => {
    const n = { ...notification, id: Date.now(), timestamp: new Date() };
    setNotifications(prev => [n, ...prev].slice(0, 50));
    setTimeout(() => setNotifications(prev => prev.filter(x => x.id !== n.id)), 6000);
  }, []);

  // ============ API CALLS ============

  const fetchUrgentOrders = async () => {
    try {
      const response = await adminApi.get('/urgent-orders?hours=2');
      setUrgentOrders(response.data || []);
    } catch (error) {
      console.error('Erreur fetch urgent orders:', error);
      setUrgentOrders([]);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      const response = await adminApi.get('/recent-orders?limit=10');
      setRecentOrders(response.data || []);
    } catch (error) {
      console.error('Erreur fetch recent orders:', error);
    }
  };

  const fetchLowStockProducts = async () => {
    try {
      const response = await adminApi.get('/low-stock-products?threshold=10');
      setLowStockProducts(response.data || []);
    } catch (error) {
      console.error('Erreur fetch low stock:', error);
    }
  };

  // ============ WEBSOCKET ============

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const s = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    s.on('connect', () => {
      console.log('EmployeeWebSocket - Connexion établie, authentification...');
      s.emit('admin_authenticate', token);
    });

    s.on('admin_authenticated', (data) => {
      if (data.success) {
        setIsConnected(true);
        console.log('EmployeeWebSocket - Authentifié comme:', data.role);
        // Charger les données initiales
        fetchUrgentOrders();
        fetchRecentOrders();
        fetchLowStockProducts();
        setLastUpdate(new Date());
      } else {
        setIsConnected(false);
        console.log('EmployeeWebSocket - Échec authentification:', data.error);
      }
    });

    s.on('disconnect', () => setIsConnected(false));

    // Écoute des événements (identiques au dashboard admin)
    s.on('admin_new_order', (data) => {
      setStats(prev => ({ ...prev, newOrders: prev.newOrders + 1, pendingOrders: prev.pendingOrders + 1 }));
      addNotification({
        title: '📦 Nouvelle commande',
        message: `Commande ${data.orderNumber} — ${data.customerName || 'Client'}`,
        type: 'order', data
      });
      // Ajouter la nouvelle commande à la liste (approximatif, sans les détails complets)
      // On préfère re-fetcher pour avoir tous les détails
      fetchRecentOrders();
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
      fetchRecentOrders();
      fetchUrgentOrders();
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
      fetchRecentOrders();
    });

    s.on('admin_stock_alert', (data) => {
      setStats(prev => ({ ...prev, lowStock: prev.lowStock + 1 }));
      addNotification({
        title: '⚠️ Alerte stock',
        message: `${data.productName} — ${data.stock} unité(s) restante(s)`,
        type: 'alert', data
      });
      // Rafraîchir immédiatement la liste des produits en stock faible
      fetchLowStockProducts();
    });

    s.on('admin_urgent_order', (data) => {
      setStats(prev => ({ ...prev, urgentOrders: prev.urgentOrders + 1 }));
      addNotification({
        title: '⚡ Commande urgente',
        message: `${data.orderNumber} — retrait dans moins de 2h`,
        type: 'urgent', data
      });
      fetchUrgentOrders();
    });

    socketRef.current = s;
    setSocket(s);

    return () => { s.disconnect(); };
  }, [addNotification]);

  // ============ POLLING COMPLÉMENTAIRE (toutes les 30s) ============
  useEffect(() => {
    // Rafraîchir les données périodiquement pour synchro complète
    const interval = setInterval(() => {
      fetchUrgentOrders();
      fetchRecentOrders();
      fetchLowStockProducts();
      // Mise à jour du timestamp
      setLastUpdate(new Date());
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, [fetchUrgentOrders, fetchRecentOrders, fetchLowStockProducts]);

  const value = {
    isConnected,
    socket,
    stats,
    notifications,
    addNotification,
    removeNotification: (id) => setNotifications(prev => prev.filter(n => n.id !== id)),
    clearNotifications: () => setNotifications([]),
    recentOrders,
    lowStockProducts,
    urgentOrders,
    lastUpdate,
    refreshAll: () => {
      fetchUrgentOrders();
      fetchRecentOrders();
      fetchLowStockProducts();
    }
  };

  return (
    <EmployeeDashboardContext.Provider value={value}>
      {children}
    </EmployeeDashboardContext.Provider>
  );
};
