import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, ShoppingCart } from 'lucide-react'
import { useCart } from '../stores'

const SimilarProductCard = ({ product, onAddToCart }) => {
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const [isAdding, setIsAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const discount = product.oldPrice && product.oldPrice > (product.priceHT || product.price)
    ? Math.round(((product.oldPrice - (product.priceHT || product.price)) / product.oldPrice) * 100)
    : null

  const handleAddToCart = async (e) => {
    e.stopPropagation()
    
    if (product.stock <= 0 || isAdding) return
    
    setIsAdding(true)
    try {
      const success = addToCart(product, 1)
      if (success) {
        setJustAdded(true)
        if (onAddToCart) onAddToCart(product)
        
        setTimeout(() => {
          setJustAdded(false)
        }, 2000)
      }
    } catch (error) {
      console.error('Erreur ajout panier:', error)
    } finally {
      setIsAdding(false)
    }
  }

  const handleProductClick = () => {
    navigate(`/product/${product.id}`)
  }

  return (
    <div
      onClick={handleProductClick}
      className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:border-sky-300 transition-all duration-200 group relative"
    >
      {/* Badges */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {discount && (
          <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            -{discount}%
          </div>
        )}
        
        {product.stock <= (product.stockAlert || 10) && product.stock > 0 && (
          <div className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            Stock faible
          </div>
        )}
        
        {product.isNew && (
          <div className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            Nouveau
          </div>
        )}
      </div>
      
      {/* Image */}
      <div className="relative overflow-hidden rounded-lg mb-3 bg-gray-50">
        <img
          src={product.image || '/images/placeholder.svg'}
          alt={product.name}
          className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-200"
          onError={(e) => { e.target.src = '/images/placeholder.svg' }}
        />
      </div>
      
      {/* Contenu */}
      <div className="space-y-2">
        {/* Marque */}
        <p className="text-xs text-sky-600 font-medium uppercase tracking-wide">
          {product.brand || product.category?.name || 'Marque'}
        </p>
        
        {/* Nom */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-sky-700 transition-colors">
          {product.name}
        </h3>
        
        {/* Prix */}
        <div className="flex items-center gap-2">
          <p className="text-lg font-bold text-sky-700">
            {(product.priceHT || product.price || 0).toFixed(2)} DH
          </p>
          {product.oldPrice && product.oldPrice > (product.priceHT || product.price) && (
            <p className="text-sm text-gray-400 line-through">
              {product.oldPrice.toFixed(2)} DH
            </p>
          )}
        </div>
        
        {/* Note et stock */}
        <div className="flex items-center justify-between text-xs">
          {product.rating > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={12}
                    className={i < product.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                  />
                ))}
              </div>
              <span className="text-gray-600">({product.rating})</span>
            </div>
          )}
          
          <div className={`font-medium ${
            product.stock > (product.stockAlert || 10) 
              ? 'text-green-600' 
              : product.stock > 0 
              ? 'text-orange-600' 
              : 'text-red-600'
          }`}>
            {product.stock > 0 ? `Stock: ${product.stock}` : 'Rupture'}
          </div>
        </div>
        
        {/* Bouton d'ajout au panier */}
        <button
          onClick={handleAddToCart}
          disabled={product.stock <= 0 || isAdding}
          className={`w-full py-2 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1 ${
            justAdded
              ? 'bg-green-500 text-white'
              : product.stock <= 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-sky-600 hover:bg-sky-700 text-white hover:shadow-md'
          }`}
        >
          {isAdding ? (
            <>
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              Ajout...
            </>
          ) : justAdded ? (
            '✓ Ajouté !'
          ) : product.stock <= 0 ? (
            'Indisponible'
          ) : (
            <>
              <ShoppingCart size={12} />
              Ajouter
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default SimilarProductCard