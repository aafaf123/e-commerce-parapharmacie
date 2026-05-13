// frontend/src/context/WebSocketContext.jsx
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);
  const [isBackendAvailable, setIsBackendAvailable] = useState(true);
  const [token, setToken] = useState(null);

  // Watch for token changes in localStorage
  useEffect(() => {
    const updateToken = () => {
      const currentToken = localStorage.getItem('token');
      setToken(currentToken);
    };

    // Initial check
    updateToken();

    // Listen for storage events (for cross-tab sync)
    window.addEventListener('storage', updateToken);

    // Also check periodically for token changes within the same tab
    const interval = setInterval(updateToken, 1000);

    return () => {
      window.removeEventListener('storage', updateToken);
      clearInterval(interval);
    };
  }, []);

  // Vérifier d'abord si le backend est accessible
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('/api/health');
        setIsBackendAvailable(response.ok);
      } catch (error) {
        console.warn('⚠️ Impossible de contacter le backend:', error.message);
        setIsBackendAvailable(false);
      }
    };
    
    checkBackend();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Connect socket when token becomes available
  useEffect(() => {
    if (token && isBackendAvailable && !socketRef.current) {
      console.log('🔌 Socket.IO: Token détecté, tentative de connexion...');
      connectSocket();
    } else if (!token && socketRef.current) {
      // Disconnect if token is removed (logout)
      console.log('🔌 Socket.IO: Token supprimé, déconnexion...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, [token, isBackendAvailable]);

  const connectSocket = () => {
    if (!token) {
      console.log('🔌 Socket.IO: Pas de token, connexion désactivée');
      return;
    }
    
    if (!isBackendAvailable) {
      console.log('🔌 Socket.IO: Backend non disponible, Socket.IO désactivé');
      return;
    }

    try {
      console.log('🔌 Socket.IO: Connexion en cours...');
      const socket = io(window.location.origin, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });
      
      socket.on('connect', () => {
        console.log('✅ Socket.IO: Connecté avec succès');
        setIsConnected(true);
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Socket.IO: Déconnecté, raison:', reason);
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO: Erreur de connexion:', error.message);
        setIsConnected(false);
      });

      // Gérer les notifications
      socket.on('notification', (data) => {
        console.log('📨 Socket.IO: Notification reçue:', data);
        handleNotification(data);
      });

      socketRef.current = socket;
    } catch (error) {
      console.warn('⚠️ Socket.IO: Impossible de créer la connexion', error.message);
      setIsConnected(false);
    }
  };

  const handleNotification = (data) => {
    switch (data.type) {
      case 'notification':
        addNotification({
          title: data.title,
          message: data.message,
          type: data.type,
          data: data
        });
        break;
        
      case 'ORDER_CREATED':
        addNotification({
          title: '✅ Commande créée',
          message: `Votre commande ${data.orderNumber} a été créée avec succès`,
          type: 'ORDER_CREATED',
          orderId: data.orderId,
          data: data
        });
        break;
        
      case 'ORDER_STATUS_CHANGED':
        const statusMessages = {
          RECEIVED: 'reçue',
          PREPARING: 'en préparation',
          READY: 'prête à être retirée',
          COMPLETED: 'récupérée'
        };
        addNotification({
          title: '📦 Statut de commande',
          message: `Votre commande ${data.orderNumber} est maintenant ${statusMessages[data.status] || data.status}`,
          type: 'ORDER_STATUS_CHANGED',
          orderId: data.orderId,
          data: data
        });
        break;
        
      case 'ORDER_CANCELLED':
        addNotification({
          title: '❌ Commande annulée',
          message: `Votre commande ${data.orderNumber} a été annulée`,
          type: 'ORDER_CANCELLED',
          orderId: data.orderId,
          data: data
        });
        break;
        
      case 'ORDER_URGENT':
        addNotification({
          title: '⚡ Commande urgente',
          message: `Votre commande ${data.orderNumber} doit être retirée dans moins de 2 heures`,
          type: 'ORDER_URGENT',
          orderId: data.orderId,
          isUrgent: true,
          data: data
        });
        break;

      case 'PROMO_CODE':
        addNotification({
          title: data.title || '🎉 Nouveau code promo !',
          message: data.message,
          type: 'PROMO_CODE',
          code: data.code,
          data: data
        });
        break;
        
      default:
        console.log('📨 Socket.IO: Message non traité:', data.type);
    }
  };

  const addNotification = (notification) => {
    setNotifications(prev => [
      {
        ...notification,
        id: Date.now(),
        timestamp: new Date()
      },
      ...prev
    ].slice(0, 50));
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  const value = {
    isConnected,
    notifications,
    addNotification,
    removeNotification,
    requestNotificationPermission
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
