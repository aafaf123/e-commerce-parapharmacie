import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Heart, ShoppingCart, Star, Package } from 'lucide-react'
import { useCart } from '../context/CartContext'
import axios from '../api/axios'
import { useAutoTranslate } from '../hooks/useAutoTranslate'

const TranslatedText = ({ text }) => {
  const translated = useAutoTranslate(text)
  return <>{translated}</>
}

const CatalogueSection = ({ onFavoritesChange }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { addToCart } = useCart()
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('favorites')
    return saved ? JSON.parse(saved) : []
  })
  const [catalogueProducts, setCatalogueProducts] = useState([])
  const [productsWithNew, setProductsWithNew] = useState({})

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites))
    if (onFavoritesChange) {
      onFavoritesChange(favorites)
    }
  }, [favorites, onFavoritesChange])

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data } = await axios.get('/products?limit=12&active=true')
      const products = data.products || []
      setCatalogueProducts(products)
      const newStatus = {}
      const now = new Date()
      products.forEach(product => {
        if (product.createdAt) {
          const createdAt = new Date(product.createdAt)
          const hoursDiff = (now - createdAt) / (1000 * 60 * 60)
          newStatus[product.id] = hoursDiff <= 48  // 48 hours for "New" badge
        }
      })
      setProductsWithNew(newStatus)
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const handleAddToCart = (product) => {
    addToCart(product)
  }

  const handleToggleFavorite = (product) => {
    setFavorites(prev => {
      const isFavorited = prev.some(fav => fav.id === product.id)
      if (isFavorited) {
        return prev.filter(fav => fav.id !== product.id)
      }
      return [...prev, product]
    })
  }

  const isFavorite = (productId) => {
    return favorites.some(fav => fav.id === productId)
  }

  return (
    <div className="bg-gray-50 py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Package size={28} className="text-sky-700" strokeWidth={2} />
            {t('catalogue.title')}
          </h2>
          <p className="text-gray-600">{t('catalogue.subtitle')}</p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {catalogueProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isNew={productsWithNew[product.id]}
              onAddToCart={handleAddToCart}
              onToggleFavorite={handleToggleFavorite}
              isFavorite={isFavorite(product)}
            />
          ))}
        </div>

        {/* Voir tout */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/products')}
            className="px-8 py-3 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors"
          >
            {t('product.see_all')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Composant ProductCard
const ProductCard = ({ product, isNew, onAddToCart, onToggleFavorite, isFavorite }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [isAdded, setIsAdded] = useState(false)

  const handleAddToCart = () => {
    setIsAdded(true)
    onAddToCart(product)
    setTimeout(() => setIsAdded(false), 2000)
  }

  const handleProductClick = () => {
    navigate(`/product/${product.id}`)
  }

  const translatedProduct = useAutoTranslateObject(product, ['brand', 'name', 'description'])
  const productName = translatedProduct?.name || product.name
  const productDescription = translatedProduct?.description || product.description

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group">
      {/* Image Container */}
      <div 
        onClick={handleProductClick}
        className="relative bg-gray-100 h-48 md:h-56 overflow-hidden cursor-pointer"
      >
        <img
          src={product.image}
          alt={productName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Badge Nouveau - plus visible en haut à droite */}
        {isNew && (
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-sm md:text-base font-bold bg-green-500 text-white z-10 shadow-lg">
            {t('product.new_badge')}
          </div>
        )}

        {/* Badge promo si applicable (décalé si badge Nouveau présent) */}
        {product.oldPrice > product.price && !isNew && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs md:text-sm font-bold bg-orange-500 text-white">
            -{product.discountType === 'fixed' 
              ? `${(product.oldPrice - product.price).toFixed(0)} DH` 
              : `${Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%`}
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(product)
          }}
          className="absolute top-3 left-3 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
        >
          <Heart
            size={18}
            className={`transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
            strokeWidth={1.8}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 md:p-4">
        <p className="text-xs text-gray-500 mb-1"><TranslatedText text={product.brand} /></p>

        {/* Product Name */}
        <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-2 line-clamp-2 h-10">
          {productName}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={14}
                className={i < product.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                strokeWidth={1.5}
              />
            ))}
          </div>
          <span className="text-xs text-gray-600">({product.reviews})</span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg md:text-xl font-bold text-sky-700 ltr">{product.price.toFixed(2)} DH</span>
          {product.oldPrice > product.price && (
            <span className="text-sm text-gray-500 line-through ltr">{product.oldPrice.toFixed(2)} DH</span>
          )}
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 mt-3 rounded-lg font-medium text-sm transition-all duration-200 ${
            isAdded
              ? 'bg-green-500 text-white'
              : 'bg-sky-700 hover:bg-sky-800 text-white'
          }`}
        >
          <ShoppingCart size={16} strokeWidth={1.8} />
          {isAdded ? t('product.added_quick') : t('product.add_quick')}
        </button>
      </div>
    </div>
  )
}

export default CatalogueSection
