import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, ShoppingCart, Star, Lock, WifiOff } from 'lucide-react'
import { useAuth } from '../stores'
import { useAuthNew } from '../context/AuthContextNew'
import { useOffline } from '../hooks/useOffline'
import { calculateDiscountPercentage, formatPrice, formatDiscountPercentage } from '../lib/utils'
import Button from './ui/Button'

const ProductCard = ({ product, onAddToCart, onAddToFavorites }) => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { user } = useAuthNew()
  const { canPlaceOrder } = useOffline()
  const [isFavorite, setIsFavorite] = useState(false)
  const [isAdded, setIsAdded] = useState(false)

  const isAdminOrEmployee = ['ADMIN', 'EMPLOYE', 'PREPARATEUR', 'CAISSIER'].includes(user?.role)
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
            -{product.discountType === 'fixed' 
              ? `${(product.oldPrice - product.price).toFixed(0)} DH` 
              : `${formatDiscountPercentage(discountPercentage)}%`}
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

        {/* Price Section */}
        <div className="flex flex-col mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-sky-800 tracking-tight">
              {product.price.toFixed(2)} <span className="text-xs font-bold ml-0.5">DH</span>
            </span>
            {product.oldPrice > product.price && (
              <span className="text-sm text-gray-400 line-through font-medium">
                {product.oldPrice.toFixed(2)} DH
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Prix TTC</p>
          {/* Stock visible uniquement pour admin/employé */}
          {isAdminOrEmployee && (
            <div className={`mt-1 text-xs font-semibold ${
              product.stock <= 0 ? 'text-red-600' :
              product.stock <= (product.stockAlert || 10) ? 'text-orange-500' :
              'text-green-600'
            }`}>
              {product.stock <= 0 ? `⚠️ Rupture (stock: ${product.stock})` :
               product.stock <= (product.stockAlert || 10) ? `⚠️ Stock faible: ${product.stock}` :
               `✅ Stock: ${product.stock}`}
            </div>
          )}
        </div>

        {/* Add to Cart — toujours actif pour les clients connectés */}
        {isAuthenticated && canPlaceOrder ? (
          <Button
            onClick={handleAddToCart}
            variant={isAdded ? 'success' : 'primary'}
            className="w-full mt-3"
          >
            <ShoppingCart size={16} strokeWidth={1.8} />
            {isAdded ? 'Ajouté !' : 'Ajouter au panier'}
          </Button>
        ) : !isAuthenticated ? (
          <Button variant="muted" size="md" disabled className="w-full mt-3">
            <Lock size={14} />
            Connectez-vous pour commander
          </Button>
        ) : (
          <Button variant="muted" size="md" disabled className="w-full mt-3 !text-orange-600 !bg-orange-100 !border-orange-200">
            <WifiOff size={14} />
            Mode hors ligne
          </Button>
        )}
      </div>
    </div>
  )
}

export default ProductCard
