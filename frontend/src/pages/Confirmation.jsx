import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { CheckCircle, Calendar, Clock, MapPin, Package, Download, Mail, MessageSquare, QrCode } from 'lucide-react'
import QRCode from 'qrcode'

const Confirmation = () => {
  const navigate = useNavigate()
  const { cartItems, getTotalPrice, clearCart } = useCart()
  const [orderNumber, setOrderNumber] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [timeSlot, setTimeSlot] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderConfirmed, setOrderConfirmed] = useState(false)
  const [orderMode, setOrderMode] = useState('CLICK_COLLECT')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [slotError, setSlotError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const qrRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      alert('Vous devez être connecté pour accéder à cette page')
      navigate('/login')
      return
    }
    
    const slotData = localStorage.getItem('selectedTimeSlot')
    if (!slotData || cartItems.length === 0) {
      navigate('/cart')
      return
    }

    const slot = JSON.parse(slotData)
    setTimeSlot(slot)

    const mode = localStorage.getItem('orderMode') || 'CLICK_COLLECT'
    setOrderMode(mode)
    if (mode === 'DELIVERY') {
      const addr         = localStorage.getItem('deliveryAddress') || ''
      const phone        = localStorage.getItem('deliveryPhone') || ''
      const instructions = localStorage.getItem('deliveryInstructions') || ''
      setDeliveryAddress([addr, phone, instructions].filter(Boolean).join(' · '))
    }
    
    // Générer numéro de commande
    const orderNum = `CC${Date.now().toString().slice(-8)}`
    setOrderNumber(orderNum)

    // Générer QR Code
    generateQRCode(orderNum)
  }, [cartItems, navigate])

  const generateQRCode = async (orderNum) => {
    try {
      const qrData = JSON.stringify({
        orderNumber: orderNum,
        timestamp: new Date().toISOString(),
        type: orderMode
      })
      const url = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0369a1',
          light: '#ffffff'
        }
      })
      setQrCodeUrl(url)
    } catch (error) {
      console.error('QR Code generation error:', error)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const handleConfirmOrder = async () => {
    setIsSubmitting(true)
    setSlotError('')
    setConfirmError('')

    try {
      const token = localStorage.getItem('token')
      const orderData = {
        items: cartItems,
        total: getTotalPrice(),
        timeSlot: timeSlot,
        orderNumber: orderNumber,
        type: orderMode,
        deliveryAddress: orderMode === 'DELIVERY' ? deliveryAddress : null
      }

      const response = await fetch('http://localhost:5000/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify(orderData)
      })

      if (response.status === 409) {
        setSlotError('Ce créneau vient d\'être complet. Veuillez choisir un autre créneau.')
        setIsSubmitting(false)
        return
      }

      if (response.status === 400) {
        const data = await response.json()
        if (data.code === 'INSUFFICIENT_STOCK') {
          setConfirmError(`Stock insuffisant pour "${data.productName}". Il ne reste que ${data.available} unité(s) disponible(s). Veuillez modifier votre panier.`)
        } else {
          setConfirmError(data.message || 'Erreur lors de la commande.')
        }
        setIsSubmitting(false)
        return
      }

      if (response.ok) {
        // Envoyer email de confirmation
        await sendConfirmationEmail()

        // Nettoyer le panier et localStorage
        clearCart()
        localStorage.removeItem('selectedTimeSlot')
        localStorage.removeItem('orderMode')
        localStorage.removeItem('deliveryAddress')
        localStorage.removeItem('deliveryPhone')
        localStorage.removeItem('deliveryInstructions')

        // Afficher l'écran de succès
        setOrderConfirmed(true)

        // Rediriger après 5 secondes
        setTimeout(() => navigate('/'), 5000)
      }
    } catch (error) {
      console.error('Order creation error:', error)
      setConfirmError('Erreur réseau. Vérifiez votre connexion et réessayez.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const sendConfirmationEmail = async () => {
    try {
      const token = localStorage.getItem('token')
      await fetch('http://localhost:5000/api/orders/send-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({
          orderNumber,
          timeSlot,
          qrCode: qrCodeUrl
        })
      })
    } catch (error) {
      console.error('Email sending error:', error)
    }
  }

  const downloadQRCode = () => {
    const link = document.createElement('a')
    link.download = `qrcode-${orderNumber}.png`
    link.href = qrCodeUrl
    link.click()
  }

  if (!timeSlot) return null

  // ── Écran de succès après confirmation ──
  if (orderConfirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-sky-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6 animate-bounce">
            <CheckCircle size={56} className="text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Commande confirmée !</h1>
          <p className="text-gray-500 mb-6">Votre commande a bien été enregistrée.</p>

          <div className="bg-sky-50 rounded-2xl p-5 mb-6 text-left space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Numéro de commande</span>
              <span className="font-mono font-bold text-sky-700">{orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Date de retrait</span>
              <span className="font-medium text-gray-800">{formatDate(timeSlot.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Créneau</span>
              <span className="font-medium text-gray-800">{timeSlot.slot.time} – {timeSlot.slot.endTime}</span>
            </div>
          </div>

          {qrCodeUrl && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-3">Présentez ce QR code en pharmacie</p>
              <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40 mx-auto rounded-xl border border-gray-200" />
              <button onClick={downloadQRCode}
                className="mt-3 flex items-center justify-center gap-2 mx-auto text-sm text-sky-700 hover:underline">
                <Download size={14} /> Télécharger le QR code
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 mb-4">Redirection automatique dans 5 secondes…</p>

          <button onClick={() => navigate('/')}
            className="w-full py-3 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-xl transition-colors">
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Commande confirmée !</h1>
          <p className="text-gray-600">
            {orderMode === 'DELIVERY' ? 'Votre commande sera livrée à domicile' : 'Votre commande Click & Collect est prête à être retirée'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Détails de la commande */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informations de retrait */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {orderMode === 'DELIVERY' ? 'Informations de livraison' : 'Informations de retrait'}
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar size={20} className="text-sky-700 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Date</p>
                    <p className="text-gray-600">{formatDate(timeSlot.date)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock size={20} className="text-sky-700 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Créneau horaire</p>
                    <p className="text-gray-600">{timeSlot.slot.time} - {timeSlot.slot.endTime}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin size={20} className="text-sky-700 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {orderMode === 'DELIVERY' ? 'Adresse de livraison' : 'Pharmacie'}
                    </p>
                    {orderMode === 'DELIVERY' ? (
                      <p className="text-gray-600">{deliveryAddress}</p>
                    ) : (
                      <>
                        <p className="text-gray-600">Pharmacie ParaClick</p>
                        <p className="text-gray-600">123 Avenue de la République, Alger</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Package size={20} className="text-sky-700 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Numéro de commande</p>
                    <p className="text-sky-700 font-mono font-bold text-lg">{orderNumber}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Articles commandés */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Articles ({cartItems.length})</h2>
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">Quantité: {item.quantity}</p>
                    </div>
                    <p className="font-bold text-sky-700">{(item.price * item.quantity).toFixed(2)} DH</p>
                  </div>
                ))}
              </div>
              <div className="border-t mt-4 pt-4 flex justify-between items-center">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-sky-700">{getTotalPrice().toFixed(2)} DH</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {orderMode === 'DELIVERY' ? 'Paiement à la livraison' : 'Paiement au comptoir lors du retrait'}
              </p>
            </div>

            {/* Rappels */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3">📬 Rappels automatiques</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <Mail size={16} />
                  <p>Email de confirmation envoyé</p>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} />
                  <p>SMS de rappel 2h avant le créneau</p>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  <p>Notification push si activée</p>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-4">
              <div className="flex items-center gap-2 mb-4">
                <QrCode size={24} className="text-sky-700" />
                <h2 className="text-xl font-bold text-gray-900">QR Code</h2>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                {qrCodeUrl && (
                  <img ref={qrRef} src={qrCodeUrl} alt="QR Code" className="w-full" />
                )}
              </div>

              <p className="text-sm text-gray-600 mb-4 text-center">
                Présentez ce QR code lors du retrait en pharmacie
              </p>

              <button
                onClick={downloadQRCode}
                className="w-full flex items-center justify-center gap-2 py-2 border border-sky-700 text-sky-700 font-semibold rounded-lg hover:bg-sky-50 transition-colors mb-3"
              >
                <Download size={18} />
                Télécharger
              </button>

              <button
                onClick={handleConfirmOrder}
                disabled={isSubmitting}
                className="w-full py-3 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Confirmation en cours…
                  </span>
                ) : 'Confirmer la commande'}
              </button>

              {confirmError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 text-center">{confirmError}</p>
                </div>
              )}

              {slotError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 text-center">{slotError}</p>
                  <button
                    onClick={() => navigate('/checkout/time-slot' + (orderMode === 'DELIVERY' ? '?mode=delivery' : ''))}
                    className="w-full mt-2 py-2 text-sm text-sky-700 border border-sky-300 rounded-lg hover:bg-sky-50"
                  >
                    Choisir un autre créneau
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Confirmation
