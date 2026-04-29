import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Package, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, Calendar, X, ArrowLeft } from 'lucide-react'
import { useWebSocket } from '../context/WebSocketContext'
import { useCart } from '../context/CartContext'

const MyOrders = () => {
  const { setCartItems, setEditingOrder } = useCart()
  const { notifications } = useWebSocket()
  const { t, i18n } = useTranslation()
  const isAr = i18n.language?.startsWith('ar')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState(null)
  const [showTimeslotModal, setShowTimeslotModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [availableSlots, setAvailableSlots] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [savingTimeslot, setSavingTimeslot] = useState(false)
  const navigate = useNavigate()

  const statusSteps = [
    { key: 'RECEIVED', label: t('orders.status_received'), icon: Package },
    { key: 'PREPARING', label: t('orders.status_preparing'), icon: Clock },
    { key: 'READY', label: t('orders.status_ready'), icon: CheckCircle },
    { key: 'COMPLETED', label: t('orders.status_completed'), icon: CheckCircle }
  ]

  const isOrderUrgent = (order) => {
    if (!order.timeSlotDate || !order.timeSlotStart) return false
    const now = new Date()
    const pickupTime = new Date(order.timeSlotDate)
    const [hours, minutes] = order.timeSlotStart.split(':').map(Number)
    pickupTime.setHours(hours, minutes, 0, 0)
    const timeDiff = pickupTime - now
    return timeDiff > 0 && timeDiff <= 2 * 60 * 60 * 1000
  }

  useEffect(() => { fetchOrders() }, [])

  useEffect(() => {
    notifications.forEach(notification => {
      if (notification.type === 'ORDER_STATUS_CHANGED') {
        setOrders(prev => prev.map(o => o.id === notification.order?.id ? { ...o, status: notification.order.status } : o))
      } else if (notification.type === 'ORDER_CONFIRMED') {
        setOrders(prev => prev.map(o => o.id === notification.order?.id ? { ...o, status: 'RECEIVED' } : o))
      } else if (notification.type === 'ORDER_CANCELLED') {
        setOrders(prev => prev.map(o => o.id === notification.order?.id ? { ...o, status: 'CANCELLED' } : o))
      }
    })
  }, [notifications])

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) { navigate('/login'); return }
      const response = await fetch(`http://localhost:5000/api/orders/my-orders`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      })
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); return
      }
      if (response.ok) { const data = await response.json(); setOrders(data.orders || []) }
    } catch (error) {
      console.error('Erreur fetch:', error)
    } finally {
      setLoading(false)
    }
  }

  const cancelOrder = async (orderId) => {
    if (!confirm(t('orders.cancel_confirm'))) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      })
      if (response.ok) {
        fetchOrders()
      } else {
        const data = await response.json()
        alert(data.message || t('orders.cancel_error'))
      }
    } catch (error) {
      console.error('Error canceling order:', error)
      alert(t('orders.cancel_error'))
    }
  }

  const getStatusIndex = (status) => {
    const index = statusSteps.findIndex(s => s.key === status)
    return index === -1 ? 0 : index
  }

  const openTimeslotModal = (order) => {
    setSelectedOrder(order)
    setShowTimeslotModal(true)
    const today = new Date().toISOString().slice(0, 10)
    setSelectedDate(today)
    fetchAvailableSlots(today)
  }

  const fetchAvailableSlots = async (date) => {
    try {
      const response = await fetch(`http://localhost:5000/api/time-slots/available?date=${date}`)
      if (response.ok) { const data = await response.json(); setAvailableSlots(data) }
    } catch (error) { console.error('Error fetching slots:', error) }
  }

  const handleDateChange = (e) => {
    const date = e.target.value
    setSelectedDate(date)
    fetchAvailableSlots(date)
    setSelectedSlot(null)
  }

  const changeTimeslot = async () => {
    if (!selectedSlot || !selectedOrder) { alert(t('orders.slot_required')); return }
    setSavingTimeslot(true)
    try {
      const token = localStorage.getItem('token')
      const formattedDate = new Date(selectedDate).toISOString().slice(0, 10)
      const response = await fetch(`http://localhost:5000/api/orders/${selectedOrder.id}/change-timeslot`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSlotDate: formattedDate, timeSlotStart: selectedSlot.time, timeSlotEnd: selectedSlot.endTime })
      })
      const responseData = await response.json()
      if (response.ok) {
        setOrders(prev => prev.map(o => o.id === selectedOrder.id
          ? { ...o, timeSlotDate: formattedDate, timeSlotStart: selectedSlot.time, timeSlotEnd: selectedSlot.endTime }
          : o))
        setShowTimeslotModal(false)
        alert(t('orders.slot_success'))
      } else {
        alert(responseData.message || t('orders.slot_error'))
      }
    } catch (error) {
      console.error('Error changing timeslot:', error)
      alert(t('orders.slot_error') + ': ' + error.message)
    } finally {
      setSavingTimeslot(false)
    }
  }

  const handleEditOrderProducts = async (order) => {
    try {
      if (!confirm(t('orders.edit_items_confirm'))) return
      if (!order.items || !Array.isArray(order.items)) { alert(t('orders.edit_items_error')); return }
      const cartFormatItems = order.items.filter(item => item.product).map(item => ({
        ...item.product, id: item.productId, quantity: item.quantity, price: item.price
      }))
      if (cartFormatItems.length === 0) { alert(t('orders.edit_items_empty')); return }
      setCartItems(cartFormatItems)
      setEditingOrder(order)
      navigate('/cart')
    } catch (error) {
      console.error('Erreur:', error)
      alert(t('common.generic_retry_error'))
    }
  }

  const getMinDate = () => new Date().toISOString().slice(0, 10)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-600 hover:text-sky-700 transition-colors">
              <ArrowLeft size={20} />
              <span>{t('orders.back_home')}</span>
            </button>
          </div>
        </div>
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50">
      {/* Bouton retour */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-sky-700 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Retour à l'accueil</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">{t('orders.my_orders')}</h1>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">{t('orders.no_orders')}</p>
            <button onClick={() => navigate('/products')} className="mt-4 px-4 py-2 bg-sky-700 text-white rounded-lg hover:bg-sky-800">
              {t('orders.discover_products')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const currentStepIndex = getStatusIndex(order.status)
              const isExpanded = expandedOrder === order.id
              const canCancel = order.status === 'RECEIVED'

              return (
                <div key={order.id} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className={`p-6 ${isOrderUrgent(order) ? 'bg-orange-50' : ''}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold text-gray-800">{order.orderNumber}</h3>
                          {isOrderUrgent(order) && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full animate-pulse">
                              <Clock className="w-3 h-3" />
                              {t('orders.urgent')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(order.createdAt).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {order.timeSlotDate && (
                          <p className={`text-sm font-medium mt-1 ${isOrderUrgent(order) ? 'text-orange-700' : 'text-sky-700'}`}>
                            {t('orders.pickup')}: {new Date(order.timeSlotDate).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')} {t('orders.at')} {order.timeSlotStart}
                            {isOrderUrgent(order) && ` - ${t('orders.less_than_2h')}`}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-800 ltr">{order.total.toFixed(2)} DH</p>
                        {order.status === 'CANCELLED' && (
                          <span className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full">
                            {t('orders.status_cancelled')}
                          </span>
                        )}
                      </div>
                    </div>

                    {order.status !== 'CANCELLED' && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between">
                          {statusSteps.map((step, index) => {
                            const StepIcon = step.icon
                            const isActive = index <= currentStepIndex
                            const isCurrent = index === currentStepIndex
                            return (
                              <div key={step.key} className="flex items-center flex-1">
                                <div className="flex flex-col items-center">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isActive ? 'bg-sky-700 text-white' : 'bg-gray-200 text-gray-400'} ${isCurrent ? 'ring-4 ring-sky-200' : ''}`}>
                                    <StepIcon className="w-6 h-6" />
                                  </div>
                                  <p className={`text-xs mt-2 text-center ${isActive ? 'text-sky-700 font-semibold' : 'text-gray-400'}`}>
                                    {step.label}
                                  </p>
                                </div>
                                {index < statusSteps.length - 1 && (
                                  <div className={`flex-1 h-1 mx-2 ${index < currentStepIndex ? 'bg-sky-700' : 'bg-gray-200'}`} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => setExpandedOrder(isExpanded ? null : order.id)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {isExpanded ? t('orders.hide') : t('orders.see_details')}
                      </button>
                      {canCancel && (
                        <button onClick={() => cancelOrder(order.id)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                          <XCircle className="w-4 h-4" />
                          {t('orders.cancel')}
                        </button>
                      )}
                      {canCancel && (
                        <button onClick={() => openTimeslotModal(order)} className="flex items-center gap-2 px-4 py-2 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100">
                          <Calendar className="w-4 h-4" />
                          {t('orders.edit_slot')}
                        </button>
                      )}
                      {order.status === 'RECEIVED' && (
                        <button onClick={() => handleEditOrderProducts(order)} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
                          <Package className="w-4 h-4" />
                          {t('orders.edit_items')}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t bg-gray-50 p-6">
                      <h4 className="font-semibold text-gray-800 mb-4">{t('orders.ordered_items')}</h4>
                      <div className="space-y-3">
                        {order.items && order.items.map(item => (
                          <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded">
                            <div>
                              <p className="font-medium text-gray-800">{item.product?.name || t('orders.product')}</p>
                              <p className="text-sm text-gray-500">{t('orders.quantity')}: {item.quantity}</p>
                            </div>
                            <p className="font-semibold text-gray-800 ltr">{(item.price * item.quantity).toFixed(2)} DH</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showTimeslotModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">{t('orders.edit_slot_title')}</h3>
              <button onClick={() => setShowTimeslotModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                {t('orders.current_order')}: <span className="font-semibold">{selectedOrder.orderNumber}</span>
              </p>
              {selectedOrder.timeSlotDate && (
                <p className="text-sm text-gray-600 mt-1">
                  {t('orders.current_slot')}: <span className="font-semibold text-sky-700">
                    {new Date(selectedOrder.timeSlotDate).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')} {t('orders.at')} {selectedOrder.timeSlotStart}
                  </span>
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('orders.choose_date')}</label>
              <input type="date" value={selectedDate} onChange={handleDateChange} min={getMinDate()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-500" />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('orders.available_slots')}</label>
              {availableSlots.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">{t('orders.no_slots')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {availableSlots.filter(slot => slot.available).map((slot, index) => (
                    <button key={index} onClick={() => setSelectedSlot(slot)}
                      className={`px-3 py-2 border rounded-lg text-sm transition-all ${selectedSlot?.time === slot.time ? 'border-sky-600 bg-sky-50 text-sky-700 font-semibold' : 'border-gray-300 hover:border-sky-400 hover:bg-gray-50'}`}>
                      <div>{slot.time} - {slot.endTime}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{slot.capacity - slot.reservations} {t('orders.places')}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowTimeslotModal(false)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                {t('common.cancel')}
              </button>
              <button onClick={changeTimeslot} disabled={!selectedSlot || savingTimeslot} className="flex-1 py-2 bg-sky-700 text-white rounded-lg hover:bg-sky-800 disabled:opacity-50">
                {savingTimeslot ? t('orders.saving') : t('orders.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyOrders
