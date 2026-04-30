import React from 'react'
import { AlertTriangle, Wifi } from 'lucide-react'
import offlineService from '../services/offlineService'

const OrderRestriction = ({ children, showMessage = true }) => {
  const canOrder = offlineService.canPlaceOrder()

  if (canOrder) {
    return children
  }

  if (!showMessage) {
    return null
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
      <div className="flex items-center justify-center gap-2 text-orange-600 mb-2">
        <AlertTriangle className="w-5 h-5" />
        <span className="font-medium">Mode hors ligne</span>
      </div>
      <p className="text-orange-700 text-sm mb-3">
        Les commandes ne sont pas disponibles en mode hors ligne.
      </p>
      <div className="flex items-center justify-center gap-2 text-orange-600 text-sm">
        <Wifi className="w-4 h-4" />
        <span>Reconnectez-vous pour passer commande</span>
      </div>
    </div>
  )
}

export default OrderRestriction