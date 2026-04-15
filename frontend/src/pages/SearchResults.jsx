import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { Heart, ShoppingCart, Star, ArrowLeft, Search, Grid3x3, List, Loader2 } from 'lucide-react'
import { calculateDiscountPercentage, formatPrice, formatDiscountPercentage } from '../lib/utils'  // ← IMPORT AJOUTÉ
import ProductCardList from '../components/ProductCardList'

const SearchResults = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const { addToCart } = useCart()
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('favorites')
    return saved ? JSON.parse(saved) : []
  })
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const observerTarget = useRef(null)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('viewMode') || 'grid'
  })

  useEffect(() => {
    const fetchProducts = async () => {
      if (!query) {
        setFilteredProducts([])
        setHasMore(false)
        return
      }

      setLoading(true)
      try {
        const params = new URLSearchParams({
          search: query,
          page: page,
          limit: 12
        })
        
        const response = await fetch(`http://localhost:5000/api/products?${params}`)
        if (response.ok) {
          const data = await response.json()
          
          if (page === 1) {
            setFilteredProducts(data.products)
          } else {
            setFilteredProducts(prev => [...prev, ...data.products])
          }
          
          setHasMore(data.pagination.hasMore)
        } else {
          console.error('Erreur lors de la récupération des produits')
          setFilteredProducts([])
          setHasMore(false)
        }
      } catch (error) {
        console.error('Erreur:', error)
        setFilteredProducts([])
        setHasMore(false)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [query, page])

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode)
  }, [viewMode])

  useEffect(() => {
    setPage(1)
    setFilteredProducts([])
    setHasMore(true)
  }, [query])

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage(prev => prev + 1)
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current)
      }
    }
  }, [hasMore, loading])

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sky-700 font-semibold mb-6 hover:text-sky-800"
        >
          <ArrowLeft size={20} />
          Retour à l'accueil
        </button>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Résultats pour "{query}"
            </h1>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-sky-700 text-white' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Vue grille"
              >
                <Grid3x3 size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-sky-700 text-white' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Vue liste"
              >
                <List size={20} />
              </button>
            </div>
          </div>
          <p className="text-gray-600">
            {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} trouvé{filteredProducts.length > 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Recherche en cours...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Search size={64} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun résultat trouvé</h2>
            <p className="text-gray-600 mb-6">
              Essayez avec d'autres mots-clés comme "crème", "gel", "sérum" ou une marque
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors"
            >
              Voir tous les produits
            </button>
          </div>
        ) : (
          <>
            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    onToggleFavorite={handleToggleFavorite}
                    isFavorite={isFavorite(product)}
                  />
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="flex flex-col gap-4">
                {filteredProducts.map((product) => (
                  <ProductCardList
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    onToggleFavorite={handleToggleFavorite}
                    isFavorite={isFavorite(product)}
                  />
                ))}
              </div>
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex justify-center items-center py-8">
                <Loader2 size={32} className="animate-spin text-sky-700" />
              </div>
            )}

            {/* Infinite Scroll Target */}
            {hasMore && <div ref={observerTarget} className="h-10" />}

            {/* End of List */}
            {!hasMore && filteredProducts.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                Vous avez vu tous les produits
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const ProductCard = ({ product, onAddToCart, onToggleFavorite, isFavorite }) => {
  const navigate = useNavigate()
  const [isAdded, setIsAdded] = useState(false)

  // Calcul automatique du pourcentage de réduction
  const discountPercentage = calculateDiscountPercentage(product.oldPrice, product.price)

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
      <div 
        onClick={handleProductClick}
        className="relative bg-gray-100 h-56 overflow-hidden cursor-pointer"
      >
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { e.target.src = '/images/placeholder.jpg' }}
        />

        {/* Badge de promotion - Calculé automatiquement */}
        {discountPercentage > 0 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-sm font-bold bg-orange-500 text-white">
            -{product.discountType === 'fixed' 
              ? `${(product.oldPrice - product.price).toFixed(0)} DH` 
              : `${formatDiscountPercentage(discountPercentage)}%`}
          </div>
        )}

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

      <div className="p-4">
        <p className="text-xs text-gray-500 mb-1">{product.brand || 'Marque'}</p>
        <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2 h-10">
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
          <span className="text-xl font-bold text-sky-700">{formatPrice(product.price)}</span>
          {product.oldPrice && product.oldPrice > product.price && (
            <span className="text-sm text-gray-500 line-through">{formatPrice(product.oldPrice)}</span>
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

export default SearchResults