import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Heart, ShoppingCart, Star, Package, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCart } from '../stores'
import { useFavorites } from '../stores'
import { calculateDiscountPercentage, formatPrice, formatDiscountPercentage } from '../lib/utils'
import axios from '../api/axios'


const PromotionsSection = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addToCart } = useCart()
  const { isFavorite, toggleFavorite, updating } = useFavorites()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)

  const category = searchParams.get('category')
  const subcategory = searchParams.get('subcategory')

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      let url = `/products?page=${currentPage}&limit=12`
      if (category)   url += `&category=${encodeURIComponent(category)}`
      if (subcategory) url += `&subcategory=${encodeURIComponent(subcategory)}`
      const response = await axios.get(url)
      if (response.data.products && Array.isArray(response.data.products)) {
        setProducts(response.data.products)
        setTotalPages(response.data.pagination?.totalPages || 1)
        setTotalProducts(response.data.pagination?.total || 0)
      } else if (Array.isArray(response.data)) {
        setProducts(response.data)
        setTotalPages(1)
        setTotalProducts(response.data.length)
      } else {
        setProducts([])
        setTotalPages(1)
        setTotalProducts(0)
      }
    } catch (err) {
      console.error('Erreur chargement produits:', err)
      setError('Impossible de charger les produits.')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [currentPage, category, subcategory])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [category, subcategory])

  // Fetch whenever page or filters change
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleToggleFavorite = async (product) => {
    await toggleFavorite(product)
  }

  const handleAddToCart = (product) => {
    addToCart(product)
  }

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Titre dynamique
  const getTitle = () => {
    if (subcategory) return subcategory
    if (category) return category
    return 'Notre Catalogue'
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={() => fetchProducts()}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Package size={28} className="text-sky-700" strokeWidth={2} />
            {getTitle()}
          </h2>
          <p className="text-gray-600">
            Découvrez notre sélection de produits
            {totalProducts > 0 && ` (${totalProducts} produits)`}
          </p>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun produit disponible dans cette catégorie.</p>
            <button 
              onClick={() => navigate('/')}
              className="mt-4 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              Voir tous les produits
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={isFavorite(product)}
                  updating={updating}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  <ChevronLeft size={20} />
                </button>
                
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-sky-700 text-white'
                          : 'border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Helper: Check if product is new (created within 48 hours)
function isProductNew(createdAt) {
  if (!createdAt) return false;
  const now = new Date();
  const created = new Date(createdAt);
  const hoursDiff = (now - created) / (1000 * 60 * 60);
  return hoursDiff <= 48;
}

// Composant ProductCard (identique)
const ProductCard = ({ product, onAddToCart, onToggleFavorite, isFavorite, updating }) => {
  const navigate = useNavigate()
  const [isAdded, setIsAdded] = useState(false)

  const handleAddToCart = () => {
    setIsAdded(true)
    onAddToCart(product)
    setTimeout(() => setIsAdded(false), 2000)
  }

  const handleProductClick = () => {
    navigate(`/product/${product.id}`)
  }

  const discount = calculateDiscountPercentage(product.oldPrice, product.price)
  const isNew = isProductNew(product.createdAt)

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group">
      <div 
        onClick={handleProductClick}
        className="relative bg-gray-100 h-48 md:h-56 overflow-hidden cursor-pointer"
      >
        <img
          src={product.image || '/images/placeholder.svg'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.target.src = '/images/placeholder.svg'
          }}
        />

        {/* Badge Nouveau - plus visible en haut à droite */}
        {isNew && (
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-sm md:text-base font-bold bg-green-500 text-white z-10 shadow-lg">
            Nouveau
          </div>
        )}

        {/* Badge promo si applicable (seulement si pas nouveau) */}
        {discount && discount > 0 && !isNew && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs md:text-sm font-bold bg-orange-500 text-white">
            -{product.discountType === 'fixed' 
              ? `${(product.oldPrice - product.price).toFixed(0)} DH` 
              : `${formatDiscountPercentage(discount)}%`}
          </div>
        )}

        {product.stock > 0 && product.stock <= (product.stockAlert || 10) && (
          <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded text-xs font-medium bg-yellow-500 text-white">
            Plus que {product.stock}
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(product)
          }}
          disabled={updating}
          className={`absolute top-3 left-3 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors z-10 ${
            updating ? 'opacity-50 cursor-wait' : ''
          }`}
        >
          <Heart
            size={18}
            className={`transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
            strokeWidth={1.8}
          />
        </button>
      </div>

      <div className="p-3 md:p-4">
        <p className="text-xs text-gray-500 mb-1">{product.brand || 'Marque'}</p>
        <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-2 line-clamp-2 h-10">
          {product.name}
        </h3>

        <div className="flex items-center gap-1 mb-2">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={14}
                className={i < (product.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                strokeWidth={1.5}
              />
            ))}
          </div>
          <span className="text-xs text-gray-600">({product.reviews || 0})</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg md:text-xl font-bold text-sky-700">
            {product.price.toFixed(2)} DH
          </span>
          {product.oldPrice && product.oldPrice > product.price && (
            <span className="text-sm text-gray-500 line-through">
              {product.oldPrice.toFixed(2)} DH
            </span>
          )}
        </div>

        <button
          onClick={handleAddToCart}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 mt-3 rounded-lg font-medium text-sm transition-all duration-200 ${
            isAdded
              ? 'bg-green-500 text-white'
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

export default PromotionsSection