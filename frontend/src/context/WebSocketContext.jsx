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
  const maxReconnectAttempts = 3;

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('🔌 WebSocket: Pas de token, connexion désactivée');
      return;
    }

    const connectWebSocket = () => {
      try {
        // Ne pas mettre le token dans l'URL
        const socketUrl = 'ws://localhost:5000';
        console.log('🔌 WebSocket: Connexion en cours...');
        const socket = new WebSocket(socketUrl);
        
        socket.onopen = () => {
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
            
            // Gérer la réponse d'authentification
            if (data.type === 'authenticated') {
              if (data.success) {
                console.log('✅ WebSocket: Authentifié avec succès');
              } else {
                console.error('❌ WebSocket: Échec authentification:', data.error);
              }
              return;
            }
            
            // Gérer les notifications
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
                
              default:
                console.log('📨 WebSocket: Message non traité:', data.type);
            }
          } catch (error) {
            console.error('❌ WebSocket: Erreur parsing message:', error);
          }
        };

        socket.onclose = (event) => {
          console.log('❌ WebSocket: Déconnecté, code:', event.code);
          setIsConnected(false);
          
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            console.log(`🔄 WebSocket: Reconnexion ${reconnectAttempts.current}/${maxReconnectAttempts} dans 3s...`);
            setTimeout(connectWebSocket, 3000);
          }
        };

        socket.onerror = (error) => {
          console.warn('⚠️ WebSocket: Erreur (non bloquante)', error.message);
        };

        socketRef.current = socket;
      } catch (error) {
        console.error('❌ WebSocket: Erreur création:', error);
        setIsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        console.log('🔌 WebSocket: Fermeture de la connexion');
        socketRef.current.close();
      }
    };
  }, []);

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