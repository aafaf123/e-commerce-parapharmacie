import { useAdminWebSocket } from '../context/AdminWebSocketContext'
import { useEffect, useState } from 'react'
import { X, Bell, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const AdminNotifications = () => {
  const { notifications, removeNotification, isConnected } = useAdminWebSocket()
  const { i18n } = useTranslation()
  const isAr = i18n.language?.startsWith('ar')
  const [visibleNotifications, setVisibleNotifications] = useState([])

  useEffect(() => {
    // Garder que les 5 dernières notifications visibles
    setVisibleNotifications(notifications.slice(0, 5))
  }, [notifications])

  const getNotificationColor = (type) => {
    switch (type) {
      case 'NEW_ORDER':
        return 'bg-blue-50 border-blue-200 text-blue-900'
      case 'ORDER_CANCELLED':
        return 'bg-red-50 border-red-200 text-red-900'
      case 'ORDER_MODIFIED':
        return 'bg-orange-50 border-orange-200 text-orange-900'
      case 'ORDER_STATUS_CHANGED':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900'
      case 'USER_CREATED':
        return 'bg-purple-50 border-purple-200 text-purple-900'
      case 'USER_LOGIN':
        return 'bg-indigo-50 border-indigo-200 text-indigo-900'
      case 'LOW_STOCK':
        return 'bg-orange-50 border-orange-200 text-orange-900'
      case 'CLICKCOLLECT_PICKUP':
        return 'bg-green-50 border-green-200 text-green-900'
      case 'ORDER_CONFIRMED':
        return 'bg-teal-50 border-teal-200 text-teal-900'
      case 'CUSTOMER_ISSUE':
        return 'bg-red-50 border-red-200 text-red-900'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900'
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'NEW_ORDER':
        return <CheckCircle className="w-5 h-5" />
      case 'ORDER_CANCELLED':
        return <AlertCircle className="w-5 h-5" />
      case 'ORDER_MODIFIED':
        return <AlertCircle className="w-5 h-5" />
      case 'USER_LOGIN':
        return <Bell className="w-5 h-5" />
      case 'LOW_STOCK':
        return <AlertCircle className="w-5 h-5" />
      case 'ORDER_CONFIRMED':
        return <CheckCircle className="w-5 h-5" />
      case 'CUSTOMER_ISSUE':
        return <AlertCircle className="w-5 h-5" />
      default:
        return <Info className="w-5 h-5" />
    }
  }

  if (!isConnected) {
    return (
      <div className="fixed top-4 right-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
        <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
        Déconnecté du serveur
      </div>
    )
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {/* Notifications */}
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`border rounded-lg p-4 shadow-lg animate-in fade-in slide-in-from-right ${getNotificationColor(notification.type)}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getNotificationIcon(notification.type)}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">
                {notification.title}
              </h3>
              <p className="text-sm opacity-90 mt-1 break-words">
                {notification.message}
              </p>

              {/* Détails supplémentaires */}
              {notification.order && (
                <div className="text-xs opacity-75 mt-2 space-y-1">
                  <div>
                    {isAr ? <strong>العميل:</strong> : <strong>Client:</strong>} {notification.order.customerName}
                  </div>
                  <div>
                    {isAr ? <strong>المبلغ:</strong> : <strong>Montant:</strong>} <span class="ltr">{notification.order.total?.toFixed(2)} DH</span>
                  </div>
                  {notification.order.timeSlotDate && (
                    <div>
                      {isAr ? <strong>الاستلام:</strong> : <strong>Retrait:</strong>} {new Date(notification.order.timeSlotDate).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')} {isAr ? 'في' : 'à'} {notification.order.timeSlotStart}
                    </div>
                  )}
                </div>
              )}

              {notification.product && (
                <div className="text-xs opacity-75 mt-2">
                  <strong>Stock:</strong> {notification.product.currentStock} {isAr ? 'وحدة' : 'unités'}
                </div>
              )}

              {/* Time */}
              <div className="text-xs opacity-50 mt-2">
                {new Date(notification.timestamp).toLocaleTimeString(isAr ? 'ar-MA' : 'fr-FR')}
              </div>
            </div>

            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Indicateur de notifications supplémentaires */}
      {notifications.length > 5 && (
        <div className="text-center text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-200">
          +{notifications.length - 5} notifications supplémentaires
        </div>
      )}
    </div>
  )
}

export default AdminNotifications

