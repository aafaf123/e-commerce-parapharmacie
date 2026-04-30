import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import {
  ArrowLeft, Store, Truck, CheckCircle, ShoppingCart,
  Tag, Clock, AlertCircle, Loader2, Star
} from 'lucide-react'
import api from '../api/axios'

const PromotionCheckout = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart } = useCart()

  const [promo, setPromo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState(null) // 'collect' | 'delivery'

  useEffect(() => {
    fetchPromo()
  }, [id])

  const fetchPromo = async () => {
    try {
      const { data } = await api.get(`/promotions/${id}`)
      setPromo(data)
    } catch {
      setError('Promotion introuvable ou expirée.')
    } finally {
      setLoading(false)
    }
  }

  const handleOrder = async (selectedMode) => {
    if (!promo) return
    setAdding(true)

    try {
      // Récupérer ou créer le vrai produit en base
      const { data } = await api.post(`/promotions/${promo.id}/get-or-create-product`)
      const realProductId = data.productId

      // Vider les anciens items promo avec faux ID du localStorage
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}')
        const cartKey = u?.id ? `cart_${u.id}` : 'cart_guest'
        const saved = JSON.parse(localStorage.getItem(cartKey) || '[]')
        const cleaned = saved.filter(i => !String(i.id).startsWith('promo-'))
        localStorage.setItem(cartKey, JSON.stringify(cleaned))
      } catch {}

      // Construire l'article avec le vrai ID produit et la quantité choisie
      const cartItem = {
        id: realProductId,
        name: promo.productName || promo.title,
        price: promo.price || promo.discountValue || 0,
        image: promo.productImage || promo.bannerImage || null,
        stock: promo.stock || 999,
        quantity: 1,
        isPromo: true,
        promoId: promo.id,
        promoTitle: promo.title,
      }

      // Ajouter au panier (quantity fois via addToCart qui incrémente)
      for (let i = 0; i < quantity; i++) {
        addToCart(cartItem)
      }

      // Mémoriser le mode choisi pour le checkout
      localStorage.setItem('orderMode', selectedMode === 'collect' ? 'CLICK_COLLECT' : 'DELIVERY')

      // Passer par le checkout standard
      navigate('/checkout')
    } catch (err) {
      console.error('Erreur ajout au panier:', err)
      alert('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-sky-700" />
    </div>
  )

  if (error || !promo) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
        <p className="text-gray-600 mb-4">{error || 'Promotion introuvable.'}</p>
        <button onClick={() => navigate('/')}
          className="px-6 py-2 bg-sky-700 text-white rounded-xl hover:bg-sky-800">
          Retour à l'accueil
        </button>
      </div>
    </div>
  )

  const isExpired = new Date(promo.endDate) < new Date()
  const discount = promo.oldPrice && promo.price
    ? Math.round((1 - promo.price / promo.oldPrice) * 100)
    : promo.discountValue || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Back */}
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sky-700 font-semibold mb-6 hover:text-sky-900">
          <ArrowLeft size={20} /> Retour
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── LEFT : Promo card ── */}
          <div className="space-y-4">
            {/* Image */}
            <div
              className="rounded-2xl overflow-hidden shadow-lg relative"
              style={{ backgroundColor: promo.bgColor || '#dc2626' }}
            >
              {promo.bannerImage || promo.productImage ? (
                <img
                  src={promo.bannerImage || promo.productImage}
                  alt={promo.title}
                  className="w-full h-64 object-cover"
                  onError={e => { e.target.style.display = 'none' }}
                />
              ) : (
                <div className="w-full h-64 flex items-center justify-center">
                  <Tag size={64} className="text-white/40" />
                </div>
              )}
              {/* Badge réduction */}
              {discount > 0 && (
                <div
                  className="absolute top-4 right-4 w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: promo.badgeColor || '#ef4444' }}
                >
                  <span className="text-white font-bold text-lg">
                    {promo.discountType === 'fixed' 
                      ? `-${promo.discountValue} DH` 
                      : `-${discount}%`}
                  </span>
                </div>
              )}
              {promo.badge && (
                <div className="absolute top-4 left-4 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                  <span className="text-white text-xs font-bold uppercase">{promo.badge}</span>
                </div>
              )}
            </div>

            {/* Infos promo */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{promo.title}</h1>
              {promo.subtitle && <p className="text-gray-500 mb-3">{promo.subtitle}</p>}

              {/* Prix */}
              <div className="flex items-center gap-3 mb-4">
                {promo.price && (
                  <span className="text-3xl font-bold text-sky-700">{promo.price} DH</span>
                )}
                {promo.oldPrice && (
                  <span className="text-lg text-gray-400 line-through">{promo.oldPrice} DH</span>
                )}
                {discount > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-sm font-bold rounded-full">
                    -{discount}%
                  </span>
                )}
              </div>

              {/* Description */}
              {promo.description && (
                <p className="text-gray-600 text-sm mb-4">{promo.description}</p>
              )}

              {/* Features */}
              {promo.features && promo.features.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {promo.features.map((f, i) => (
                    <span key={i} className="px-3 py-1 bg-sky-50 text-sky-700 text-xs rounded-full border border-sky-200">
                      ✓ {f}
                    </span>
                  ))}
                </div>
              )}

              {/* Validité */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={14} />
                <span>
                  Valable jusqu'au {new Date(promo.endDate).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </span>
              </div>

              {isExpired && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-500" />
                  <span className="text-red-700 text-sm font-medium">Cette promotion est expirée.</span>
                </div>
              )}
            </div>

            {/* Quantité */}
            {!isExpired && (
              <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Quantité :</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 font-bold text-lg"
                  >−</button>
                  <span className="text-lg font-bold w-6 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(10, q + 1))}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 font-bold text-lg"
                  >+</button>
                </div>
                {promo.price && (
                  <span className="ml-auto text-lg font-bold text-sky-700">
                    Total : {(promo.price * quantity).toFixed(2)} DH
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT : Mode de livraison ── */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Comment souhaitez-vous recevoir votre commande ?
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                Choisissez votre mode de livraison pour finaliser la commande au prix promotionnel.
              </p>

              {isExpired ? (
                <div className="text-center py-8 text-gray-400">
                  <AlertCircle size={40} className="mx-auto mb-2" />
                  <p>Promotion expirée — commande impossible.</p>
                </div>
              ) : (
                <div className="space-y-4">

                  {/* Click & Collect */}
                  <button
                    onClick={() => handleOrder('collect')}
                    disabled={adding}
                    className="w-full group bg-white rounded-2xl border-2 border-gray-200 hover:border-sky-600 hover:shadow-md transition-all p-5 text-left disabled:opacity-60"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-sky-100 group-hover:bg-sky-700 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                        <Store size={24} className="text-sky-700 group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">Click & Collect</h3>
                        <p className="text-sm text-gray-500 mb-3">
                          Retirez votre commande en pharmacie au créneau de votre choix.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {['Gratuit', 'Disponible sous 2h', 'Paiement au comptoir'].map(f => (
                            <span key={f} className="flex items-center gap-1 text-xs text-green-700 font-medium">
                              <CheckCircle size={11} className="text-green-500" /> {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 w-full py-2.5 bg-sky-700 group-hover:bg-sky-800 text-white font-semibold rounded-xl text-center text-sm transition-colors">
                      {adding ? <Loader2 size={16} className="animate-spin inline" /> : 'Choisir un créneau →'}
                    </div>
                  </button>

                  {/* Livraison */}
                  <button
                    onClick={() => handleOrder('delivery')}
                    disabled={adding}
                    className="w-full group bg-white rounded-2xl border-2 border-gray-200 hover:border-sky-600 hover:shadow-md transition-all p-5 text-left disabled:opacity-60"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-orange-100 group-hover:bg-sky-700 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                        <Truck size={24} className="text-orange-600 group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">Livraison à domicile</h3>
                        <p className="text-sm text-gray-500 mb-3">
                          Recevez votre commande directement chez vous.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {['Livraison 24h–48h', 'Créneau au choix', 'Paiement à la livraison'].map(f => (
                            <span key={f} className="flex items-center gap-1 text-xs text-green-700 font-medium">
                              <CheckCircle size={11} className="text-green-500" /> {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 w-full py-2.5 bg-sky-700 group-hover:bg-sky-800 text-white font-semibold rounded-xl text-center text-sm transition-colors">
                      {adding ? <Loader2 size={16} className="animate-spin inline" /> : 'Saisir mon adresse →'}
                    </div>
                  </button>

                </div>
              )}
            </div>

            {/* Récap commande */}
            {promo.price && !isExpired && (
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5">
                <h3 className="font-semibold text-sky-900 mb-3 flex items-center gap-2">
                  <ShoppingCart size={16} /> Récapitulatif
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-700">
                    <span>{promo.productName || promo.title} × {quantity}</span>
                    <span>{(promo.price * quantity).toFixed(2)} DH</span>
                  </div>
                  {promo.oldPrice && (
                    <div className="flex justify-between text-green-700 font-medium">
                      <span>Économie</span>
                      <span>-{((promo.oldPrice - promo.price) * quantity).toFixed(2)} DH</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sky-900 border-t border-sky-200 pt-2 mt-2">
                    <span>Total</span>
                    <span>{(promo.price * quantity).toFixed(2)} DH</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PromotionCheckout
