// frontend/src/components/ProductCardList.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Heart, ShoppingCart, Star } from 'lucide-react'
import { useFavorites } from '../context/FavoritesContext'
import { calculateDiscountPercentage, formatPrice, formatDiscountPercentage } from '../lib/utils'
import { useAutoTranslate, useAutoTranslateObject } from '../hooks/useAutoTranslate'

const TranslatedText = ({ text }) => {
  const translated = useAutoTranslate(text)
  return <>{translated}</>
}


const ProductCardList = ({ product, onAddToCart }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toggleFavorite, isFavorite, updating } = useFavorites()
  const [isAdded, setIsAdded] = useState(false)
  const translatedProduct = useAutoTranslateObject(product, ['brand', 'name', 'description'])
  const productName = translatedProduct?.name || product.name
  const productDescription = translatedProduct?.description || product.description

  const handleAddToCart = () => {
    setIsAdded(true)
    onAddToCart(product)
    setTimeout(() => setIsAdded(false), 2000)
  }

  const handleProductClick = () => {
    navigate(`/product/${product.id}`)
  }

  const handleToggleFavorite = async (e) => {
    e.stopPropagation()
    console.log('Toggle favorite (list view):', product.name)
    await toggleFavorite(product)
  }

    const discountPercentage = calculateDiscountPercentage(product.oldPrice, product.price)


  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden flex">
      <div 
        onClick={handleProductClick}
        className="relative bg-gray-100 w-48 flex-shrink-0 overflow-hidden cursor-pointer"
      >
        <img
          src={product.image}
          alt={productName}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          onError={(e) => { e.target.src = '/images/placeholder.svg' }}
        />

        {discountPercentage > 0 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500 text-white">
            -{product.discountType === 'fixed' 
              ? `${(product.oldPrice - product.price).toFixed(0)} DH` 
              : `${formatDiscountPercentage(discountPercentage)}%`}
          </div>
        )}

        <button
          onClick={handleToggleFavorite}
          disabled={updating}
          className={`absolute top-3 left-3 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors ${
            updating ? 'opacity-50 cursor-wait' : ''
          }`}
        >
          <Heart
            size={18}
            className={`transition-colors ${isFavorite(product) ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
            strokeWidth={1.8}
          />
        </button>
      </div>

      <div className="flex-1 p-4 flex flex-col justify-between">
        <div onClick={handleProductClick} className="cursor-pointer">
          <p className="text-xs text-gray-500 mb-1"><TranslatedText text={product.brand} /></p>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {productName}
          </h3>
          {productDescription && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {productDescription}
            </p>
          )}
          <div className="flex items-center gap-1 mb-3">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={16}
                  className={i < product.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                  strokeWidth={1.5}
                />
              ))}
            </div>
            <span className="text-sm text-gray-600">({product.reviews})</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-bold text-sky-700 ltr">{product.price.toFixed(2)} DH</span>
              {product.oldPrice > product.price && (
                <span className="text-sm text-gray-500 line-through ltr">{product.oldPrice.toFixed(2)} DH</span>
              )}
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg mt-3 font-medium text-sm transition-all duration-200 ${
              isAdded
                ? 'bg-green-500 text-white'
                : 'bg-sky-700 hover:bg-sky-800 text-white'
            }`}
          >
            <ShoppingCart size={18} strokeWidth={1.8} />
            {isAdded ? t('product.added_quick') : t('product.add_quick')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductCardList