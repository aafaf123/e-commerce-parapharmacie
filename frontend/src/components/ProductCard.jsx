import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, ShoppingCart, Star } from 'lucide-react'
import { calculateDiscountPercentage, formatPrice, formatDiscountPercentage } from '../lib/utils'  // ← AJOUTER


const ProductCard = ({ product, onAddToCart, onAddToFavorites }) => {
  const navigate = useNavigate()
  const [isFavorite, setIsFavorite] = useState(false)
  const [isAdded, setIsAdded] = useState(false)

  const discountPercentage = calculateDiscountPercentage(product.oldPrice, product.price)

  const handleAddToFavorites = () => {
    setIsFavorite(!isFavorite)
    onAddToFavorites(product)
  }

  const handleAddToCart = () => {
    setIsAdded(true)
    onAddToCart(product)
    setTimeout(() => setIsAdded(false), 2000)
  }

  const handleProductClick = () => {
    navigate(`/product/${product.id}`)
  }

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group">
      {/* Image Container */}
      <div 
        onClick={handleProductClick}
        className="relative bg-gray-100 h-48 md:h-56 overflow-hidden cursor-pointer"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          style={{
            aspectRatio: '4/3',
            objectPosition: 'center'
          }}
        />

        {/* New Badge */}
        {product.isNew && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs md:text-sm font-bold bg-green-500 text-white">
            Nouveau
          </div>
        )}

        {/* Discount Badge */}
        {discountPercentage > 0 && !product.isNew && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs md:text-sm font-bold bg-orange-500 text-white">
            -{formatDiscountPercentage(discountPercentage)}%
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={handleAddToFavorites}
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
        {/* Brand */}
        <p className="text-xs text-gray-500 mb-1">{product.brand}</p>

        {/* Product Name */}
        <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-2 line-clamp-2 h-10">
          {product.name}
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
          <span className="text-lg md:text-xl font-bold text-sky-700">{product.price.toFixed(2)} DH</span>
          {product.oldPrice > product.price && (
            <span className="text-sm text-gray-500 line-through">{product.oldPrice.toFixed(2)} DH</span>
          )}
        </div>

        {/* Stock Status */}
        <div className="mb-3">
          {product.stock > 0 ? (
            <p className="text-xs text-green-600 font-medium">En stock ({product.stock})</p>
          ) : (
            <p className="text-xs text-red-600 font-medium">Rupture de stock</p>
          )}
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
            isAdded
              ? 'bg-green-500 text-white'
              : product.stock === 0
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-sky-700 hover:bg-sky-800 text-white'
          }`}
        >
          <ShoppingCart size={16} strokeWidth={1.8} />
          {isAdded ? 'Ajouté !' : 'Ajouter au panier'}
        </button>
      </div>
    </div>
  )
}

export default ProductCard
