import { useWebSocket } from '../context/WebSocketContext'
import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Bell, CheckCircle, AlertCircle, ShoppingBag, Truck, Package, Clock, Tag } from 'lucide-react'

const NOTIFICATION_DURATION = 5000; // 5 seconds

const ClientNotifications = () => {
  const { notifications, removeNotification, isConnected } = useWebSocket()
  const { t, i18n } = useTranslation()
  const [dismissedIds, setDismissedIds] = useState(new Set()) // IDs of manually dismissed notifications
  const timersRef = useRef(new Map())

  // Filter out dismissed notifications
  const visibleNotifications = notifications.filter(n => !dismissedIds.has(n.id)).slice(0, 5)

  useEffect(() => {
    // Set up auto-dismiss timers for new notifications
    notifications.forEach(notification => {
      if (!timersRef.current.has(notification.id)) {
        const timer = setTimeout(() => {
          removeNotification(notification.id)
          timersRef.current.delete(notification.id)
        }, NOTIFICATION_DURATION)
        timersRef.current.set(notification.id, timer)
      }
    })
    
    // Clean up timers for notifications that are no longer in the list
    const currentIds = new Set(notifications.map(n => n.id))
    timersRef.current.forEach((timer, id) => {
      if (!currentIds.has(id)) {
        clearTimeout(timer)
        timersRef.current.delete(id)
      }
    })
    
    return () => {
      // Cleanup on unmount
      timersRef.current.forEach((timer) => clearTimeout(timer))
    }
  }, [notifications, removeNotification])

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'ORDER_CREATED':        return <ShoppingBag className="w-5 h-5 text-green-500" />
      case 'ORDER_STATUS_CHANGED': return <Truck className="w-5 h-5 text-blue-500" />
      case 'ORDER_CANCELLED':      return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'ORDER_URGENT':         return <Clock className="w-5 h-5 text-orange-600 animate-pulse" />
      case 'order_status_changed': return <Clock className="w-5 h-5 text-yellow-500" />
      case 'PROMO_CODE':           return <Tag className="w-5 h-5 text-purple-500" />
      case 'notification':         return <Bell className="w-5 h-5 text-gray-500" />
      default:                     return <Package className="w-5 h-5 text-sky-500" />
    }
  }

  const getNotificationColor = (type) => {
    switch (type) {
      case 'ORDER_CREATED':        return 'bg-green-50 border-green-200 text-green-800'
      case 'ORDER_STATUS_CHANGED': return 'bg-blue-50 border-blue-200 text-blue-800'
      case 'ORDER_URGENT':         return 'bg-orange-50 border-orange-300 text-orange-800 border-2 animate-pulse'
      case 'order_status_changed': return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'ORDER_CANCELLED':      return 'bg-red-50 border-red-200 text-red-800'
      case 'PROMO_CODE':           return 'bg-purple-50 border-purple-200 text-purple-800'
      default:                     return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  // Si pas connecté, afficher un indicateur discret
  if (!isConnected) {
    return (
      <div className="fixed bottom-4 left-4 bg-gray-100 border border-gray-300 text-gray-500 px-3 py-1.5 rounded-full text-xs flex items-center gap-2 shadow-md">
        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        {t('notifications.offline')}
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {visibleNotifications.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-md opacity-75">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Bell size={16} />
            <span>{t('nav.no_notifications')}</span>
          </div>
        </div>
      )}

      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`border rounded-lg p-4 shadow-lg animate-in fade-in slide-in-from-right transition-all duration-300 hover:shadow-xl ${getNotificationColor(notification.type)}`}
          style={{
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getNotificationIcon(notification.type)}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setDismissedIds(prev => new Set([...prev, notification.id]));
              }}
              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="Fermer"
            >
              <X size={14} />
            </button>

            <div className="flex-1 min-w-0 pr-6">
              <h3 className="font-semibold text-sm">
                {notification.title}
              </h3>
              <p className="text-sm opacity-90 mt-1 break-words">
                {notification.message}
              </p>

              {notification.orderId && (
                <button
                  onClick={() => {
                    window.location.href = `/my-orders`
                    removeNotification(notification.id)
                  }}
                  className="text-xs font-medium mt-2 text-blue-600 hover:text-blue-700 underline"
                >
                  {t('notifications.view_order')}
                </button>
              )}

              {notification.type === 'PROMO_CODE' && notification.code && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(notification.code)
                    alert(`${t('notifications.code_copied')} ${notification.code}`)
                  }}
                  className="text-xs font-medium mt-2 bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded transition-colors"
                >
                  📋 {t('notifications.copy_code')} : {notification.code}
                </button>
              )}

              <div className="text-xs opacity-50 mt-2">
                {new Date(notification.timestamp).toLocaleTimeString(i18n.language?.startsWith('ar') ? 'ar-MA' : 'fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>

          </div>
        </div>
      ))}

      {notifications.length > 5 && (
        <div className="text-center text-xs text-gray-500 bg-white p-2 rounded-lg border border-gray-200 shadow-md">
          +{notifications.length - 5} {t('notifications.more')}
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-in {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

export default ClientNotifications