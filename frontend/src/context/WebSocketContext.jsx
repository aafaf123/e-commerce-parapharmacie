// frontend/src/context/WebSocketContext.jsx
import { createContext, useContext, useEffect, useState, useRef } from 'react';

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
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const [isBackendAvailable, setIsBackendAvailable] = useState(true);

  // Vérifier d'abord si le backend est accessible
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/health');
        setIsBackendAvailable(response.ok);
        if (response.ok) {
          console.log('✅ Backend accessible, tentative de connexion WebSocket...');
          connectWebSocket();
        } else {
          console.warn('⚠️ Backend non accessible, WebSocket désactivé');
        }
      } catch (error) {
        console.warn('⚠️ Impossible de contacter le backend:', error.message);
        setIsBackendAvailable(false);
      }
    };
    
    checkBackend();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('🔌 WebSocket: Pas de token, connexion désactivée');
      return;
    }
    
    if (!isBackendAvailable) {
      console.log('🔌 WebSocket: Backend non disponible, WebSocket désactivé');
      return;
    }

    try {
      const socketUrl = 'ws://localhost:5000';
      console.log('🔌 WebSocket: Connexion en cours...');
      const socket = new WebSocket(socketUrl);
      
      // Timeout pour la connexion
      const connectionTimeout = setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          console.warn('⚠️ WebSocket: Délai de connexion dépassé');
          socket.close();
          setIsConnected(false);
        }
      }, 5000);
      
      socket.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket: Connecté');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        
        // Envoyer le token après connexion
        socket.send(JSON.stringify({
          type: 'authenticate',
          token: token
        }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'authenticated') {
            if (data.success) {
              console.log('✅ WebSocket: Authentifié avec succès');
            } else {
              console.error('❌ WebSocket: Échec authentification:', data.error);
            }
            return;
          }

          // Socket.IO wraps events as arrays: [eventName, data]
          if (Array.isArray(data) && data[0] === 'promo_code_created') {
            handleNotification({ ...data[1], type: 'PROMO_CODE' });
            return;
          }
          
          // Gérer les notifications
          handleNotification(data);
        } catch (error) {
          console.error('❌ WebSocket: Erreur parsing message:', error);
        }
      };

      socket.onclose = (event) => {
        console.log('❌ WebSocket: Déconnecté, code:', event.code);
        setIsConnected(false);
        
        // Ne pas tenter de reconnexion si le serveur a fermé proprement
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`🔄 WebSocket: Reconnexion ${reconnectAttempts.current}/${maxReconnectAttempts} dans 5s...`);
          setTimeout(connectWebSocket, 5000);
        }
      };

      socket.onerror = (error) => {
        console.warn('⚠️ WebSocket: Erreur (non bloquante)', error);
        // Ne pas définir isConnected à false ici pour éviter les reconnexions intempestives
      };

      socketRef.current = socket;
    } catch (error) {
      console.warn('⚠️ WebSocket: Impossible de créer la connexion', error.message);
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
        console.log('📨 WebSocket: Message non traité:', data.type);
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