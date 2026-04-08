// frontend/src/pages/ProductDetail.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { ArrowLeft, Heart, ShoppingCart, Star, Package, CheckCircle, Truck, Shield, ZoomIn, X, ChevronLeft, ChevronRight, Facebook, Twitter, MessageCircle, Bell, Mail } from 'lucide-react'
import { calculateDiscountPercentage, formatDiscountPercentage } from '../lib/utils'
import axios from '../api/axios'

const ProductDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [showLightbox, setShowLightbox] = useState(false)
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', name: '' })
  const [reviews, setReviews] = useState([])
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [similarProducts, setSimilarProducts] = useState([])
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [showStockAlert, setShowStockAlert] = useState(false)
  const [stockAlertEmail, setStockAlertEmail] = useState('')
  const [stockAlertLoading, setStockAlertLoading] = useState(false)
  const [stockAlertSuccess, setStockAlertSuccess] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    fetchProduct()
    fetchReviews()
    // Check if user already subscribed to this product's stock alert
    const subscribedProducts = JSON.parse(localStorage.getItem('stockAlerts') || '[]')
    if (subscribedProducts.includes(id)) {
      setIsSubscribed(true)
    }
  }, [id])

  const fetchReviews = async () => {
    try {
      const response = await axios.get(`/reviews/${id}`)
      setReviews(response.data)
    } catch (error) {
      // fallback to localStorage
      const saved = JSON.parse(localStorage.getItem(`reviews_${id}`) || '[]')
      setReviews(saved)
    }
  }

  const fetchProduct = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.get(`/products/${id}`)
      setProduct(response.data)
      
      const favorites = JSON.parse(localStorage.getItem('favorites') || '[]')
      setIsFavorite(favorites.some(fav => fav.id === parseInt(id)))
      
      // Check if product is new (created within last 2 hours)
      if (response.data.createdAt) {
        const now = new Date()
        const createdAt = new Date(response.data.createdAt)
        const hoursDiff = (now - createdAt) / (1000 * 60 * 60)
        setIsNew(hoursDiff <= 2)
      }
      
      // Charger produits similaires
      fetchSimilarProducts(response.data.id)
      
    } catch (error) {
      console.error('Erreur chargement produit:', error)
      setError('Produit non trouvé')
    } finally {
      setLoading(false)
    }
  }

  const fetchSimilarProducts = async (productId) => {
    try {
      const { data } = await axios.get(`/products/${productId}/similar?limit=4`)
      setSimilarProducts(data)
    } catch (error) {
      console.error('Erreur chargement produits similaires:', error)
    }
  }

  const handleToggleFavorite = () => {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]')
    if (isFavorite) {
      const updated = favorites.filter(fav => fav.id !== product.id)
      localStorage.setItem('favorites', JSON.stringify(updated))
      setIsFavorite(false)
    } else {
      favorites.push(product)
      localStorage.setItem('favorites', JSON.stringify(favorites))
      setIsFavorite(true)
    }
  }

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      const success = addToCart(product);
      if (!success) return; // Admin blocked
    }
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 2000)
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    if (!newReview.name || !newReview.comment) return
    const token = localStorage.getItem('token')
    if (!token) {
      alert('Vous devez être connecté pour laisser un avis')
      return
    }
    try {
      await axios.post(`/reviews/${id}`, newReview, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setReviewSubmitted(true)
      setNewReview({ rating: 5, comment: '', name: '' })
    } catch (error) {
      alert('Erreur lors de la soumission de l\'avis')
    }
  }

  const handleShare = (platform) => {
    const url = window.location.href
    const text = `Découvrez ${product.name} sur ParaClick`
    
    const shareUrls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`
    }
    
    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400')
    }
  }

  const handleStockAlertSubmit = async (e) => {
    e.preventDefault()
    if (!stockAlertEmail || !stockAlertEmail.includes('@')) {
      alert('Veuillez entrer une adresse email valide')
      return
    }

    setStockAlertLoading(true)
    try {
      await axios.post(`/products/${id}/stock-notification`, {
        email: stockAlertEmail
      })
      
      setStockAlertSuccess(true)
      setIsSubscribed(true)
      
      // Save to localStorage
      const subscribedProducts = JSON.parse(localStorage.getItem('stockAlerts') || '[]')
      if (!subscribedProducts.includes(id)) {
        subscribedProducts.push(id)
        localStorage.setItem('stockAlerts', JSON.stringify(subscribedProducts))
      }
      
      setTimeout(() => {
        setStockAlertSuccess(false)
        setShowStockAlert(false)
        setStockAlertEmail('')
      }, 3000)
    } catch (error) {
      alert(error.response?.data?.message || 'Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setStockAlertLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700"></div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package size={64} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Produit non trouvé</h2>
          <p className="text-gray-600 mb-6">Le produit que vous recherchez n'existe pas ou a été supprimé.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-sky-700 hover:bg-sky-800 text-white rounded-lg"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  const images = product.images && product.images.length > 0 
    ? product.images 
    : [product.image || '/images/placeholder.jpg']

  const discount = calculateDiscountPercentage(product.oldPrice, product.price)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sky-700 font-semibold mb-6 hover:text-sky-800"
        >
          <ArrowLeft size={20} />
          Retour
        </button>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 md:p-8">
            {/* Galerie d'images */}
            <div>
              <div className="relative bg-gray-100 rounded-xl overflow-hidden aspect-square mb-4">
                <img
                  src={images[selectedImage]}
                  alt={product.name}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setShowLightbox(true)}
                  onError={(e) => { e.target.src = '/images/placeholder.jpg' }}
                />
                <button
                  onClick={() => setShowLightbox(true)}
                  className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                >
                  <ZoomIn size={20} />
                </button>
                {discount && (
                  <div className="absolute top-4 left-4 px-4 py-2 rounded-full text-lg font-bold bg-orange-500 text-white">
                    -{formatDiscountPercentage(discount)}%
                  </div>
                )}
              </div>
              
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 ${
                        selectedImage === index ? 'border-sky-700' : 'border-gray-200'
                      }`}
                    >
                      <img src={img} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Informations */}
            <div>
              <p className="text-sm text-gray-500 mb-2">{product.brand || 'Marque'}</p>
              <div className="flex items-center gap-3 mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
                {isNew && (
                  <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">
                    Nouveau
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={20}
                      className={i < (product.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                    />
                  ))}
                </div>
                <span className="text-gray-600">({reviews.length + (product.reviews || 0)} avis)</span>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl font-bold text-sky-700">{product.price.toFixed(2)} DH</span>
                {product.oldPrice && product.oldPrice > product.price && (
                  <span className="text-xl text-gray-500 line-through">{product.oldPrice.toFixed(2)} DH</span>
                )}
              </div>

              <div className="mb-6">
                {product.stock > 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle size={20} />
                    <span className="font-medium">En stock ({product.stock} disponibles)</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-red-600">
                      <Package size={20} />
                      <span className="font-medium">Rupture de stock</span>
                    </div>
                    
                    {/* Stock Alert Subscription */}
                    {!isSubscribed && !showStockAlert && (
                      <button
                        onClick={() => setShowStockAlert(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                      >
                        <Bell size={18} />
                        M'avertir du retour en stock
                      </button>
                    )}
                    
                    {showStockAlert && !isSubscribed && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Bell className="text-orange-500 mt-0.5" size={20} />
                          <div className="flex-1">
                            <h4 className="font-semibold text-orange-800 text-sm mb-2">
                              Soyez alerté quand ce produit sera de nouveau disponible
                            </h4>
                            <form onSubmit={handleStockAlertSubmit} className="flex gap-2">
                              <input
                                type="email"
                                value={stockAlertEmail}
                                onChange={(e) => setStockAlertEmail(e.target.value)}
                                placeholder="Votre adresse email"
                                className="flex-1 px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                                required
                              />
                              <button
                                type="submit"
                                disabled={stockAlertLoading}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
                              >
                                {stockAlertLoading ? '...' : 'S\'inscrire'}
                              </button>
                            </form>
                            {stockAlertSuccess && (
                              <p className="mt-2 text-sm text-green-600 font-medium flex items-center gap-1">
                                <CheckCircle size={14} />
                                Inscription réussie ! Vous serez alerté par email.
                              </p>
                            )}
                            <button
                              onClick={() => {
                                setShowStockAlert(false)
                                setStockAlertEmail('')
                              }}
                              className="mt-2 text-xs text-orange-600 hover:text-orange-800"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {isSubscribed && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-medium">
                        <CheckCircle size={18} />
                        Vous êtes inscrit pour être alerté du retour en stock
                      </div>
                    )}
                  </div>
                )}
              </div>

              {product.description && (
                <div className="mb-6">
                  <p className="text-gray-700 leading-relaxed">{product.description}</p>
                </div>
              )}

              {/* Variantes */}
              {product.productVariants && product.productVariants.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Choisir une variante
                  </label>
                  <div className="space-y-4">
                    {/* Group variants by type */}
                    {(() => {
                      const groupedVariants = {}
                      product.productVariants.forEach(v => {
                        if (!groupedVariants[v.type]) groupedVariants[v.type] = []
                        groupedVariants[v.type].push(v)
                      })
                      return Object.entries(groupedVariants).map(([type, variantList]) => (
                        <div key={type}>
                          <p className="text-xs text-gray-500 mb-2 capitalize">{type}</p>
                          <div className="flex flex-wrap gap-2">
                            {variantList.map((variant) => {
                              const variantPrice = product.price + (variant.priceAdjustment || 0)
                              const isSelected = selectedVariant?.id === variant.id
                              return (
                                <button
                                  key={variant.id}
                                  onClick={() => setSelectedVariant(variant)}
                                  className={`px-4 py-2 border rounded-lg text-sm transition-all ${
                                    isSelected
                                      ? 'border-sky-600 bg-sky-50 text-sky-700 font-semibold'
                                      : 'border-gray-300 hover:border-sky-400 hover:bg-gray-50'
                                  } ${variant.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  disabled={variant.stock === 0}
                                >
                                  <span>{variant.value}</span>
                                  {variant.priceAdjustment !== 0 && (
                                    <span className="block text-xs mt-0.5">
                                      {variant.priceAdjustment > 0 ? '+' : ''}{variant.priceAdjustment} DH
                                    </span>
                                  )}
                                  {variant.stock === 0 && (
                                    <span className="block text-xs text-red-500 mt-0.5">Rupture</span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                  {selectedVariant && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-3">
                        {selectedVariant.image && (
                          <img
                            src={selectedVariant.image}
                            alt={selectedVariant.value}
                            className="w-16 h-16 object-cover rounded-lg"
                            onError={(e) => { e.target.src = '/images/placeholder.jpg' }}
                          />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {selectedVariant.value}
                            {selectedVariant.priceAdjustment !== 0 && (
                              <span className="ml-2 text-sky-700">
                                ({selectedVariant.priceAdjustment > 0 ? '+' : ''}{selectedVariant.priceAdjustment} DH)
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Prix: <span className="font-bold text-sky-700">{(product.price + (selectedVariant.priceAdjustment || 0)).toFixed(2)} DH</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Stock: {selectedVariant.stock} disponibles
                          </p>
                          {selectedVariant.description && (
                            <p className="text-xs text-gray-600 mt-2">{selectedVariant.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Quantité</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-gray-700"
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-semibold text-lg">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock}
                    className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mb-6">
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock === 0}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${
                    isAdded
                      ? 'bg-green-500 text-white'
                      : product.stock === 0
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-sky-700 hover:bg-sky-800 text-white'
                  }`}
                >
                  <ShoppingCart size={20} />
                  {isAdded ? 'Ajouté au panier !' : 'Ajouter au panier'}
                </button>
                <button
                  onClick={handleToggleFavorite}
                  className="p-3 rounded-lg border-2 border-gray-300 hover:border-red-500 transition-colors"
                >
                  <Heart
                    size={24}
                    className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}
                  />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-900 mb-3">Partager :</p>
                <div className="flex gap-2">
                  <button onClick={() => handleShare('facebook')} className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
                    <Facebook size={20} />
                  </button>
                  <button onClick={() => handleShare('twitter')} className="p-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white">
                    <Twitter size={20} />
                  </button>
                  <button onClick={() => handleShare('whatsapp')} className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white">
                    <MessageCircle size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Truck size={20} className="text-sky-700" />
                  <span className="text-sm text-gray-700">Livraison gratuite</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={20} className="text-sky-700" />
                  <span className="text-sm text-gray-700">Paiement sécurisé</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package size={20} className="text-sky-700" />
                  <span className="text-sm text-gray-700">Click & Collect</span>
                </div>
              </div>
            </div>
          </div>

          {(product.usage || product.composition || product.benefits) && (
            <div className="border-t border-gray-200 p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {product.usage && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Mode d'utilisation</h2>
                    <p className="text-gray-700 leading-relaxed">{product.usage}</p>
                  </div>
                )}

                {product.benefits && product.benefits.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Bénéfices</h2>
                    <ul className="space-y-2">
                      {product.benefits.map((benefit, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle size={18} className="text-green-600 mt-0.5" />
                          <span className="text-gray-700">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {product.composition && (
                <div className="mt-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Composition</h2>
                  <p className="text-gray-700 leading-relaxed text-sm">{product.composition}</p>
                </div>
              )}
            </div>
          )}

          {/* Avis clients et produits similaires - reste identique */}
          <div className="border-t border-gray-200 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Avis clients</h2>
            
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Laisser un avis</h3>
              <form onSubmit={handleSubmitReview}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Votre nom</label>
                  <input
                    type="text"
                    value={newReview.name}
                    onChange={(e) => setNewReview({ ...newReview, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setNewReview({ ...newReview, rating })}
                        className="focus:outline-none"
                      >
                        <Star size={28} className={rating <= newReview.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Votre commentaire</label>
                  <textarea
                    value={newReview.comment}
                    onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                    rows="4"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                    required
                  />
                </div>
                <button type="submit" className="px-6 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg">
                  Publier l'avis
                </button>
              </form>
              {reviewSubmitted && (
                <p className="mt-3 text-sm text-green-600 font-medium">✓ Avis soumis, en attente de modération.</p>
              )}
            </div>

            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{review.name}</span>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                        ))}
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">{new Date(review.date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <p className="text-gray-700">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>

          {similarProducts.length > 0 && (
            <div className="border-t border-gray-200 p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Vous pourriez aussi aimer</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {similarProducts.map((similar) => (
                  <div
                    key={similar.id}
                    onClick={() => navigate(`/product/${similar.id}`)}
                    className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-lg"
                  >
                    <img
                      src={similar.image || '/images/placeholder.jpg'}
                      alt={similar.name}
                      className="w-full aspect-square object-cover rounded-lg mb-3"
                      onError={(e) => { e.target.src = '/images/placeholder.jpg' }}
                    />
                    <p className="text-xs text-gray-500 mb-1">{similar.brand || 'Marque'}</p>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">{similar.name}</h3>
                    <p className="text-lg font-bold text-sky-700">{similar.price.toFixed(2)} DH</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showLightbox && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <button onClick={() => setShowLightbox(false)} className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100">
            <X size={24} />
          </button>
          <button onClick={() => setSelectedImage((prev) => (prev - 1 + images.length) % images.length)} className="absolute left-4 p-2 bg-white rounded-full hover:bg-gray-100">
            <ChevronLeft size={24} />
          </button>
          <button onClick={() => setSelectedImage((prev) => (prev + 1) % images.length)} className="absolute right-4 p-2 bg-white rounded-full hover:bg-gray-100">
            <ChevronRight size={24} />
          </button>
          <img src={images[selectedImage]} alt={product.name} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  )
}

export default ProductDetail