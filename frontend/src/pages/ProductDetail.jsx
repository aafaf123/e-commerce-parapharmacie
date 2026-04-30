// frontend/src/pages/ProductDetail.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Heart, ShoppingCart, Star, Package, CheckCircle, Truck, Shield, ZoomIn, X, ChevronLeft, ChevronRight, Facebook, Twitter, MessageCircle, Bell, Mail, Lock } from 'lucide-react'
import { calculateDiscountPercentage, formatDiscountPercentage } from '../lib/utils'
import SimilarProductCard from '../components/SimilarProductCard'
import axios from '../api/axios'

const ProductDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cartItems, addToCart, updateQuantity } = useCart()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { isAuthenticated } = useAuth()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState(1)
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

  // Sync local quantity with cart ONLY on initial load or when switching variants
  useEffect(() => {
    if (product) {
      const effectiveId = selectedVariant ? selectedVariant.id : product.id
      const cartItem = cartItems.find(item => item.id === effectiveId)
      if (cartItem) {
        setQuantity(cartItem.quantity)
      } else {
        setQuantity(1) // Reset to 1 if not in cart
      }
    }
  }, [product, selectedVariant, cartItems])

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
      
      // Favorites state now managed by useFavorites context
      
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

  const handleToggleFavorite = async () => {
    const effectiveProduct = selectedVariant ? { ...product, ...selectedVariant } : product
    await toggleFavorite(effectiveProduct)
  }

  const handleAddToCart = () => {
    // Check if product requires variant selection
    if (product.productVariants && product.productVariants.length > 0 && !selectedVariant) {
      alert('⚠️ Veuillez sélectionner une variante du produit')
      return
    }

    const effectiveId = selectedVariant ? selectedVariant.id : product.id
    const cartItem = cartItems.find(item => item.id === effectiveId)
    
    // If already in cart, don't add again - user should use +/- buttons
    if (cartItem) {
      alert('ℹ️ Ce produit est déjà dans votre panier. Utilisez les boutons +/- pour modifier la quantité.')
      return
    }

    // Check stock availability
    const stock = selectedVariant?.stock ?? product.stock ?? 0
    if (quantity > stock) {
      const itemName = selectedVariant 
        ? `${product.name} (${selectedVariant.value})`
        : product.name
      alert(`❌ Stock insuffisant pour "${itemName}". Disponible: ${stock} unité(s)`)
      return
    }

    const variantPrice = selectedVariant?.price != null ? selectedVariant.price : null
    const basePrice = product.priceHT || product.price || 0
    const finalPrice = variantPrice !== null ? variantPrice : basePrice
    
    const effectiveProduct = selectedVariant 
      ? { 
          ...product, 
          ...selectedVariant,
          price: finalPrice,
          variantId: selectedVariant.id,
          variantType: selectedVariant.type,
          variantValue: selectedVariant.value,
          image: selectedVariant.image || product.image
        } 
      : { ...product, price: basePrice }
    
    const success = addToCart(effectiveProduct, quantity)
    if (success) {
      setIsAdded(true)
      setTimeout(() => setIsAdded(false), 2000)
    }
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
    : [product.image || '/images/placeholder.svg']

  const discount = calculateDiscountPercentage(product.oldPrice, product.price)

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
                  onError={(e) => { e.target.src = '/images/placeholder.svg' }}
                />
                <button
                  onClick={() => setShowLightbox(true)}
                  className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                >
                  <ZoomIn size={20} />
                </button>
                {discount && (
                  <div className="absolute top-4 left-4 px-4 py-2 rounded-full text-lg font-bold bg-orange-500 text-white">
                    -{product.discountType === 'fixed' 
                      ? `${(product.oldPrice - product.price).toFixed(0)} DH` 
                      : `${formatDiscountPercentage(discount)}%`}
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

              <div className="bg-sky-50 p-6 rounded-2xl border border-sky-100 mb-8 shadow-sm">
                <div className="flex items-baseline gap-4 mb-1">
                  <span className="text-5xl font-black text-sky-800 tracking-tighter">
                    {(() => {
                      const variantPrice = selectedVariant?.price != null ? selectedVariant.price : null
                      const basePrice = product.priceHT || product.price || 0
                      const displayPrice = variantPrice !== null ? variantPrice : basePrice
                      return displayPrice.toFixed(2)
                    })()}
                    <span className="text-lg font-bold ml-1">DH</span>
                  </span>
                  {product.oldPrice && product.oldPrice > (() => {
                    const variantPrice = selectedVariant?.price != null ? selectedVariant.price : null
                    const basePrice = product.priceHT || product.price || 0
                    return variantPrice !== null ? variantPrice : basePrice
                  })() && (
                    <span className="text-xl text-gray-400 line-through font-medium">
                      {product.oldPrice.toFixed(2)} DH
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-sky-600 uppercase tracking-widest">Taxes Incluses (TTC)</p>
                  <div className="h-1 w-1 bg-sky-300 rounded-full" />
                  <div className="flex items-center gap-1.5 text-green-600">
                    <CheckCircle size={14} className="fill-green-100" />
                    <span className="text-xs font-bold uppercase tracking-wider">En Stock</span>
                  </div>
                </div>
              </div>


              {product.description && (
                <div className="mb-6">
                  <p className="text-gray-700 leading-relaxed">{product.description}</p>
                </div>
              )}

              {/* Variantes */}
              {product.productVariants && product.productVariants.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="block text-sm font-bold text-gray-900 mb-4">
                    ✨ Sélectionner une variante
                  </label>
                  <div className="space-y-5">
                    {/* Group variants by type */}
                    {(() => {
                      const groupedVariants = {}
                      product.productVariants.forEach(v => {
                        // Use variantType.label if available, otherwise use type
                        const groupKey = v.variantType?.label || v.type || 'Variante'
                        if (!groupedVariants[groupKey]) groupedVariants[groupKey] = []
                        groupedVariants[groupKey].push(v)
                      })
                      return Object.entries(groupedVariants).map(([type, variantList]) => (
                        <div key={type} className="space-y-2">
                          <p className="text-xs font-bold text-sky-700 uppercase tracking-wide px-1">{type}</p>
                          <div className="flex flex-wrap gap-2">
                            {variantList.map((variant) => {
                              const isSelected = selectedVariant?.id === variant.id
                              const hasPrice = variant.price != null
                              const displayPrice = hasPrice ? variant.price : product.price + (variant.priceAdjustment || 0)
                              const inStock = (variant.stock !== undefined) ? variant.stock > 0 : product.stock > 0

                              return (
                                <button
                                  key={variant.id}
                                  onClick={() => setSelectedVariant(variant)}
                                  disabled={!inStock}
                                  className={`w-full px-4 py-3 border rounded-lg text-sm font-medium transition-all ${
                                    !inStock
                                      ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                                      : isSelected
                                      ? 'border-sky-600 bg-sky-100 text-sky-900 shadow-md'
                                      : 'border-gray-300 hover:border-sky-400 hover:bg-sky-50 text-gray-700'
                                  }`}
                                >
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="font-semibold">{variant.value}</span>
                                    {(variant.price != null || variant.priceAdjustment !== 0) && (
                                      <span className="text-xs opacity-75">
                                        {displayPrice.toFixed(2)} DH
                                      </span>
                                    )}
                                  </div>
                                  {!inStock && (
                                    <span className="absolute bottom-2 left-4 text-xs font-bold text-red-600">
                                      ⚠️ Rupture
                                    </span>
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
                    <div className="mt-4 p-4 bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg border border-sky-300 shadow-md">
                      <div className="flex items-start gap-4 justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {selectedVariant.image && (
                            <img
                              src={selectedVariant.image}
                              alt={selectedVariant.value}
                              className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                              onError={(e) => { e.target.src = '/images/placeholder.svg' }}
                            />
                          )}
                          <div className="flex-1">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">
                              ✓ {selectedVariant.value} sélectionné
                            </h3>
                            <p className="text-xs text-gray-600 mb-2">
                              Prix: <span className="font-bold text-lg text-sky-700">
                                {(selectedVariant.price != null ? selectedVariant.price : product.price + (selectedVariant.priceAdjustment || 0)).toFixed(2)} DH
                              </span>
                            </p>
                             {selectedVariant.stock !== undefined && (
                               <p className={`text-xs font-semibold ${selectedVariant.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                 {selectedVariant.stock > 0 ? `✓ En stock (${selectedVariant.stock})` : '✗ Rupture de stock'}
                               </p>
                             )}
                             {selectedVariant.barcode && (
                               <p className="text-xs text-gray-600 mt-1">
                                 <span className="font-medium">Code-barres:</span> {selectedVariant.barcode}
                               </p>
                             )}
                             {selectedVariant.expiryDate && (
                               <p className="text-xs text-gray-600 mt-1">
                                 <span className="font-medium">Expiration:</span> {new Date(selectedVariant.expiryDate).toLocaleDateString('fr-FR')}
                               </p>
                             )}
                             {selectedVariant.description && (
                               <p className="text-xs text-gray-600 mt-2">{selectedVariant.description}</p>
                             )}
                          </div>
                        </div>

                        {/* Quick Add Button for Selected Variant */}
                        <button
                          onClick={() => {
                            const effectiveId = selectedVariant.id
                            const cartItem = cartItems.find(item => item.id === effectiveId)
                            
                            if (cartItem) {
                              // If already in cart, just show feedback
                              setIsAdded(true)
                              setTimeout(() => setIsAdded(false), 1000)
                              return
                            }
                            
                            const variantPrice = selectedVariant.price != null ? selectedVariant.price : null
                            const basePrice = product.priceHT || product.price || 0
                            const finalPrice = variantPrice !== null ? variantPrice : basePrice

                            const effectiveProduct = {
                              ...product,
                              ...selectedVariant,
                              price: finalPrice,
                              variantId: selectedVariant.id,
                              variantType: selectedVariant.type,
                              variantValue: selectedVariant.value,
                              image: selectedVariant.image || product.image
                            }

                            const success = addToCart(effectiveProduct, 1)
                            if (success) {
                              setIsAdded(true)
                              setTimeout(() => setIsAdded(false), 2000)
                            }
                          }}
                          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                            (() => {
                              const cartItem = cartItems.find(item => item.id === selectedVariant.id)
                              return cartItem
                                ? 'bg-green-500 text-white'
                                : isAdded
                                ? 'bg-green-500 text-white'
                                : 'bg-sky-700 hover:bg-sky-800 text-white hover:shadow-lg'
                            })()
                          }`}
                        >
                          <ShoppingCart size={18} />
                          <span className="text-sm">
                            {(() => {
                              const cartItem = cartItems.find(item => item.id === selectedVariant.id)
                              return cartItem
                                ? `Dans panier (${cartItem.quantity})`
                                : isAdded
                                ? '✓ Ajouté!'
                                : 'Ajouter'
                            })()
                            }
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Quantité</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const effectiveId = selectedVariant ? selectedVariant.id : product.id
                      const cartItem = cartItems.find(item => item.id === effectiveId)
                      
                      if (cartItem) {
                        // If in cart, update cart quantity
                        updateQuantity(effectiveId, Math.max(1, cartItem.quantity - 1))
                      } else {
                        // If not in cart, just update local quantity
                        setQuantity(Math.max(1, quantity - 1))
                      }
                    }}
                    className="w-12 h-12 rounded-xl bg-sky-100 hover:bg-sky-200 font-bold text-sky-700 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-semibold text-lg">{quantity}</span>
                  <button
                    onClick={() => {
                      const effectiveId = selectedVariant ? selectedVariant.id : product.id
                      const cartItem = cartItems.find(item => item.id === effectiveId)
                      
                      if (cartItem) {
                        // If in cart, update cart quantity
                        updateQuantity(effectiveId, cartItem.quantity + 1)
                      } else {
                        // If not in cart, just update local quantity
                        setQuantity(quantity + 1)
                      }
                    }}
                    className="w-12 h-12 rounded-xl bg-sky-100 hover:bg-sky-200 font-bold text-sky-700 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mb-6">
                {isAuthenticated ? (
                  (() => {
                    const effectiveId = selectedVariant ? selectedVariant.id : product.id
                    const cartItem = cartItems.find(item => item.id === effectiveId)
                    
                    return cartItem ? (
                      // Product is in cart - show "In Cart" button
                      <button
                        onClick={() => navigate('/cart')}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold shadow-lg transition-all bg-green-500 hover:bg-green-600 text-white"
                      >
                        <ShoppingCart size={20} />
                        Dans le panier ({cartItem.quantity})
                      </button>
                    ) : (
                      // Product not in cart - show "Add to Cart" button
                      <button
                        onClick={handleAddToCart}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold shadow-lg transition-all ${
                          isAdded
                            ? 'bg-green-500 text-white'
                            : 'bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white hover:shadow-xl'
                        }`}
                      >
                        <ShoppingCart size={20} />
                        {isAdded ? 'Ajouté au panier !' : 'Ajouter au panier'}
                      </button>
                    )
                  })()
                ) : (
                  <button
                    onClick={() => navigate('/login')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-gray-200 transition-all hover:shadow-md"
                  >
                    <Lock size={18} />
                    Connectez-vous pour commander
                  </button>
                )}
                <button
                  onClick={handleToggleFavorite}
                  className="w-14 h-14 rounded-2xl border-3 bg-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center border-gray-300 hover:border-red-500"
                >
                  <Heart
                    size={26}
                    className={`${isFavorite(product) ? 'fill-red-500 text-red-500' : 'stroke-gray-600 text-gray-600 fill-none'}`}
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

                {product.benefits && Array.isArray(product.benefits) && product.benefits.length > 0 && (
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
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Vous pourriez aussi aimer</h2>
                <p className="text-sm text-gray-500">{similarProducts.length} produit{similarProducts.length > 1 ? 's' : ''} similaire{similarProducts.length > 1 ? 's' : ''}</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {similarProducts.map((similar) => (
                  <SimilarProductCard
                    key={similar.id}
                    product={similar}
                    onAddToCart={(product) => {
                      // Feedback optionnel quand un produit similaire est ajouté
                      console.log('Produit similaire ajouté:', product.name)
                    }}
                  />
                ))}
              </div>
              
              {/* Lien vers plus de produits similaires */}
              <div className="text-center">
                <button
                  onClick={() => navigate(`/products?category=${product.category?.name}`)}
                  className="inline-flex items-center gap-2 px-6 py-3 border border-sky-600 text-sky-600 font-medium rounded-lg hover:bg-sky-50 transition-colors"
                >
                  Voir plus de produits similaires
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </button>
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