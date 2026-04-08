// frontend/src/pages/Cart.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Tag, X, Truck, Loader2 } from 'lucide-react'

const Cart = () => {
  const navigate = useNavigate()
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    clearCart,
    getSubtotal,
    getDiscount,
    getSubtotalAfterDiscount,
    getTVA,
    getTotalPrice,
    getShippingInfo,
    applyPromoCode,
    removePromoCode,
    promoCode,
    promoError,
    stockError,
    validating,
    TVA_RATE,
  } = useCart()

  const [promoInput, setPromoInput] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const shippingInfo = getShippingInfo()

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
    navigate('/checkout')
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
              onClick={() => navigate('/')}
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

        {/* Indicateur de livraison gratuite */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3 mb-2">
            <Truck size={24} className={shippingInfo.isFree ? 'text-green-600' : 'text-sky-700'} />
            <div className="flex-1">
              {shippingInfo.isFree ? (
                <p className="text-green-600 font-semibold">🎉 Vous bénéficiez de la livraison gratuite !</p>
              ) : (
                <p className="text-gray-700">
                  Plus que <span className="font-bold text-sky-700">{shippingInfo.remaining.toFixed(2)} DH</span> pour la livraison gratuite
                </p>
              )}
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                shippingInfo.isFree ? 'bg-green-500' : 'bg-sky-700'
              }`}
              style={{ width: `${shippingInfo.percentage}%` }}
            ></div>
          </div>
        </div>

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

              {/* Message d'erreur stock */}
              {stockError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <span className="text-red-500 text-lg leading-none">⚠️</span>
                  <p className="text-sm text-red-700 font-medium">{stockError}</p>
                </div>
              )}

              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-24 h-24 object-cover rounded-lg"
                    />

                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-xs text-gray-500">{item.brand}</p>
                          <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.stock}
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
                <div className="flex justify-between text-gray-600">
                  <span>Sous-total</span>
                  <span>{getSubtotal().toFixed(2)} DH</span>
                </div>

                {getDiscount() > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Remise</span>
                    <span>-{getDiscount().toFixed(2)} DH</span>
                  </div>
                )}

                <div className="flex justify-between text-gray-600">
                  <span>TVA ({(TVA_RATE * 100).toFixed(0)}%)</span>
                  <span>{getTVA().toFixed(2)} DH</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Livraison</span>
                  <span className="text-green-600 font-medium">Gratuite</span>
                </div>

                <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
                  <span>Total TTC</span>
                  <span className="text-sky-700">{getTotalPrice().toFixed(2)} DH</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-3 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors mb-3"
              >
                Passer la commande
              </button>

              <button
                onClick={() => navigate('/')}
                className="w-full py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Continuer mes achats
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Cart