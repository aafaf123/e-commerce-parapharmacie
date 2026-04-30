// frontend/src/pages/Cart.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../stores'
import { useOffline } from '../hooks/useOffline'
import OrderRestriction from '../components/OrderRestriction'
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Tag, X, Truck, Loader2, Phone } from 'lucide-react'
import PhoneRequiredModal from '../components/PhoneRequiredModal'
import api from '../api/axios'

const Cart = () => {
  const navigate = useNavigate()
  const { user, updateProfile } = useAuth()
  const { canPlaceOrder } = useOffline()
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    clearCart,
    getDiscount,
    getTotalPrice,
    applyPromoCode,
    removePromoCode,
    promoCode,
    promoError,
    validating,
    editingOrder,
    setEditingOrder,
  } = useCart()

  const [promoInput, setPromoInput] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [phoneError, setPhoneError] = useState('')


  useEffect(() => {
    const token = localStorage.getItem('token')
    setIsLoggedIn(!!token)
  }, [])

  const handleCheckout = () => {
    if (!isLoggedIn) {
      alert('Vous devez être connecté pour passer une commande')
      navigate('/login')
      return
    }
    
    // Vérifier si l'utilisateur a un téléphone
    if (!user?.phone || user.phone.trim() === '') {
      setPhoneError('Veuillez compléter votre profil avec un numéro de téléphone avant de passer commande')
      setShowPhoneModal(true)
      return
    }
    
    if (editingOrder) {
      handleUpdateOrder()
    } else {
      navigate('/checkout')
    }
  }

  // Gérer la soumission du modal téléphone
  const handlePhoneSubmit = async (formData) => {
    try {
      await updateProfile({
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        notificationEmail: formData.notificationEmail,
        notificationSMS: formData.notificationSMS,
        notificationWhatsApp: formData.notificationWhatsApp,
        notificationPush: formData.notificationPush
      })
      setShowPhoneModal(false)
      setPhoneError('')
      // Procéder au checkout après mise à jour
      if (editingOrder) {
        handleUpdateOrder()
      } else {
        navigate('/checkout')
      }
    } catch (error) {
      throw error
    }
  }

  const handleUpdateOrder = async () => {
    if (isUpdating) return
    
    setIsUpdating(true)
    try {
      const response = await api.patch(`/orders/${editingOrder.id}/items`, {
        items: cartItems,
        total: getTotalPrice()
      })
      
      if (response.data) {
        alert('Commande mise à jour avec succès !')
        clearCart()
        setEditingOrder(null)
        navigate('/my-orders')
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la commande:', error)
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleApplyPromo = async () => {
    if (validating) return
    const success = await applyPromoCode(promoInput)
    if (success) {
      setPromoInput('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !validating) {
      handleApplyPromo()
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sky-700 font-semibold mb-6 hover:text-sky-800"
          >
            <ArrowLeft size={20} />
            Retour
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
            <ShoppingBag size={64} className="mx-auto text-gray-300 mb-4" strokeWidth={1.5} />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Votre panier est vide</h2>
            <p className="text-gray-600 mb-6">Ajoutez des produits pour commencer vos achats</p>
            <button
              onClick={() => navigate('/products')}
              className="px-6 py-3 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors"
            >
              Découvrir nos produits
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sky-700 font-semibold mb-6 hover:text-sky-800"
        >
          <ArrowLeft size={20} />
          Continuer mes achats
        </button>



        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liste des produits */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Mon Panier ({cartItems.length})</h1>
                <button
                  onClick={clearCart}
                  className="text-red-600 hover:text-red-700 font-medium text-sm"
                >
                  Vider le panier
                </button>
              </div>

              {/* Stock error removed */}

              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={`${item.id}-${item.variantId || ''}`} className="flex gap-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-24 h-24 object-cover rounded-lg"
                    />

                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          {item.variantType && (
                            <p className="text-xs text-sky-600 font-semibold uppercase tracking-wide">{item.variantType}</p>
                          )}
                          <h3 className="font-semibold text-gray-900">{item.name}</h3>
                          {item.variantValue && (
                            <p className="text-sm text-gray-700 mt-0.5">
                              <span className="font-medium">{item.variantValue}</span>
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id, item.variantId)}
                          className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1, item.variantId)}
                            className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1, item.variantId)}
                            className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-bold text-sky-700">
                            {(item.price * item.quantity).toFixed(2)} DH
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.price.toFixed(2)} DH / unité
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Résumé de la commande */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Résumé</h2>

              {/* Code promo - Synchronisé avec la base de données */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Code promo</label>
                {promoCode ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-green-600" />
                      <div>
                        <p className="text-sm font-semibold text-green-900">{promoCode.code}</p>
                        <p className="text-xs text-green-700">{promoCode.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={removePromoCode}
                      className="text-green-600 hover:text-green-700"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Entrez votre code"
                        disabled={validating}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700 disabled:bg-gray-100"
                      />
                      <button
                        onClick={handleApplyPromo}
                        disabled={validating}
                        className="px-4 py-2 bg-sky-700 hover:bg-sky-800 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        {validating ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Vérification...</span>
                          </>
                        ) : (
                          'Appliquer'
                        )}
                      </button>
                    </div>
                    {promoError && (
                      <p className="text-xs text-red-600 mt-1">{promoError}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Entrez un code promo valide pour bénéficier d'une réduction
                    </p>
                  </div>
                )}
              </div>

              {/* Détails du prix */}
              <div className="space-y-3 mb-6">
                {getDiscount() > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Remise</span>
                    <span>-{getDiscount().toFixed(2)} DH</span>
                  </div>
                )}

                <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
                  <span>Total TTC</span>
                  <span className="text-sky-700">{getTotalPrice().toFixed(2)} DH</span>
                </div>
              </div>


              <OrderRestriction>
                <button
                  onClick={handleCheckout}
                  disabled={isUpdating || !canPlaceOrder}
                  className={`w-full py-3 font-semibold rounded-lg transition-colors mb-3 flex items-center justify-center gap-2 ${
                    !canPlaceOrder 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-sky-700 hover:bg-sky-800 text-white'
                  }`}
                >
                  {isUpdating && <Loader2 size={18} className="animate-spin" />}
                  {editingOrder 
                    ? (isUpdating ? 'Mise à jour...' : `Mettre à jour la commande ${editingOrder.orderNumber}`)
                    : 'Passer la commande'}
                </button>
              </OrderRestriction>

              {phoneError && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Phone className="w-4 h-4" />
                    <p className="text-sm font-medium">{phoneError}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate('/')}
                className="w-full py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Continuer mes achats
              </button>
            </div>
          </div>
        </div>

        {/* Modal pour compléter le profil */}
        <PhoneRequiredModal
          isOpen={showPhoneModal}
          onClose={() => {
            setShowPhoneModal(false)
            setPhoneError('')
          }}
          onSubmit={handlePhoneSubmit}
          user={user}
        />
      </div>
    </div>
  )
}

export default Cart