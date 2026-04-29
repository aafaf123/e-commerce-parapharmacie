import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCart } from '../context/CartContext'
import { 
  Heart, ShoppingCart, Star, ArrowLeft, Search, Grid3x3, List, Loader2, 
  Filter, X, ChevronDown, SlidersHorizontal, TrendingUp, Clock, DollarSign,
  Package, Tag, Layers
} from 'lucide-react'
import { calculateDiscountPercentage, formatPrice, formatDiscountPercentage } from '../lib/utils'
import ProductCardList from '../components/ProductCardList'
import axios from '../api/axios'

// Normalize accents for comparison
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Highlight matching substring in text (accent-insensitive)
const Highlight = ({ text, query }) => {
  if (!text || !query) return <>{text}</>
  const normText = norm(text)
  const normQuery = norm(query)
  const idx = normText.indexOf(normQuery)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

const SearchResults = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const { addToCart } = useCart()
  
  // États pour les produits et pagination
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalResults, setTotalResults] = useState(0)
  const observerTarget = useRef(null)
  
  // États pour les filtres
  const [showFilters, setShowFilters] = useState(false)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    brand: searchParams.get('brand') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    inStock: searchParams.get('inStock') === 'true',
    minRating: searchParams.get('minRating') || '',
    sortBy: searchParams.get('sortBy') || 'relevance'
  })
  
  // États pour l'interface
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('viewMode') || 'grid'
  })
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('favorites')
    return saved ? JSON.parse(saved) : []
  })
  
  // États pour la recherche avec debounce
  const [searchValue, setSearchValue] = useState(query)
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchSuggestion, setSearchSuggestion] = useState(null)
  const searchTimeoutRef = useRef(null)

  // Charger les catégories et marques pour les filtres
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [categoriesRes, brandsRes] = await Promise.all([
          axios.get('/categories'),
          axios.get('/products/brands')
        ])
        setCategories(categoriesRes.data || [])
        setBrands(brandsRes.data || [])
      } catch (error) {
        console.error('Erreur lors du chargement des filtres:', error)
      }
    }
    fetchFilterData()
  }, [])

  // Recherche avec debounce (300ms)
  const fetchSuggestions = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setSearchSuggestions([])
      setSearchSuggestion(null)
      setShowSuggestions(false)
      return
    }
    try {
      const { data } = await axios.get(`/products/search?q=${encodeURIComponent(searchQuery)}&limit=8`)
      setSearchSuggestions(data.results || [])
      setSearchSuggestion(data.suggestion)
      setShowSuggestions((data.results?.length > 0) || !!data.suggestion)
    } catch (error) {
      console.error('Erreur suggestions:', error)
      setSearchSuggestions([])
      setSearchSuggestion(null)
    }
  }, [])

  // Debounce pour la recherche
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(searchValue)
    }, 300)
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchValue, fetchSuggestions])
  // Fonction pour récupérer les produits avec filtres
  const fetchProducts = async (resetPage = false) => {
    const currentQuery = searchParams.get('q') || ''
    if (!currentQuery && !filters.category && !filters.brand) {
      setFilteredProducts([])
      setHasMore(false)
      setTotalResults(0)
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: resetPage ? 1 : page,
        limit: 12
      })
      
      // Ajouter les paramètres de recherche et filtres
      if (currentQuery) params.append('search', currentQuery)
      if (filters.category) params.append('categoryId', filters.category)
      if (filters.brand) params.append('brandId', filters.brand)
      if (filters.minPrice) params.append('minPrice', filters.minPrice)
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice)
      if (filters.inStock) params.append('inStock', 'true')
      if (filters.minRating) params.append('minRating', filters.minRating)
      
      // Tri
      switch (filters.sortBy) {
        case 'price_asc':
          params.append('sortBy', 'price')
          params.append('sortOrder', 'asc')
          break
        case 'price_desc':
          params.append('sortBy', 'price')
          params.append('sortOrder', 'desc')
          break
        case 'newest':
          params.append('sortBy', 'createdAt')
          params.append('sortOrder', 'desc')
          break
        case 'rating':
          params.append('sortBy', 'rating')
          params.append('sortOrder', 'desc')
          break
        case 'sales':
          params.append('sortBy', 'sales')
          params.append('sortOrder', 'desc')
          break
        default: // relevance
          if (currentQuery) {
            params.append('sortBy', 'relevance')
          }
          break
      }
      
      const response = await fetch(`http://localhost:5000/api/products?${params}`)
      if (response.ok) {
        const data = await response.json()
        
        if (resetPage || page === 1) {
          setFilteredProducts(data.products)
        } else {
          setFilteredProducts(prev => [...prev, ...data.products])
        }
        
        setHasMore(data.pagination.hasMore)
        setTotalResults(data.pagination.total)
      } else {
        console.error('Erreur lors de la récupération des produits')
        setFilteredProducts([])
        setHasMore(false)
        setTotalResults(0)
      }
    } catch (error) {
      console.error('Erreur:', error)
      setFilteredProducts([])
      setHasMore(false)
      setTotalResults(0)
    } finally {
      setLoading(false)
    }
  }

  // Effet pour charger les produits
  useEffect(() => {
    fetchProducts()
  }, [query, page, filters])

  // Gestion des filtres
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    
    // Mettre à jour l'URL
    const newSearchParams = new URLSearchParams(searchParams)
    if (value) {
      newSearchParams.set(key, value)
    } else {
      newSearchParams.delete(key)
    }
    setSearchParams(newSearchParams)
    
    // Reset pagination
    setPage(1)
    setFilteredProducts([])
    setHasMore(true)
  }

  const clearFilters = () => {
    const newFilters = {
      category: '',
      brand: '',
      minPrice: '',
      maxPrice: '',
      inStock: false,
      minRating: '',
      sortBy: 'relevance'
    }
    setFilters(newFilters)
    
    // Nettoyer l'URL
    const newSearchParams = new URLSearchParams()
    if (query) newSearchParams.set('q', query)
    setSearchParams(newSearchParams)
    
    setPage(1)
    setFilteredProducts([])
    setHasMore(true)
  }

  // Gestion de la recherche
  const handleSearch = (searchQuery) => {
    const newSearchParams = new URLSearchParams(searchParams)
    if (searchQuery) {
      newSearchParams.set('q', searchQuery)
    } else {
      newSearchParams.delete('q')
    }
    setSearchParams(newSearchParams)
    setSearchValue(searchQuery)
    setShowSuggestions(false)
    setPage(1)
    setFilteredProducts([])
    setHasMore(true)
  }

  const handleSuggestionClick = (result) => {
    if (result.resultType === 'product') {
      navigate(`/product/${result.id}`)
    } else if (result.resultType === 'category') {
      handleFilterChange('category', result.id)
    } else if (result.resultType === 'brand') {
      handleFilterChange('brand', result.id)
    }
    setShowSuggestions(false)
  }

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
    setSearchValue(query)
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
          {t('product.back_to_home')}
        </button>

        {/* Barre de recherche avancée */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="relative">
            <div className="flex items-center rounded-lg border-2 border-gray-300 focus-within:border-sky-700 bg-white">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(searchValue)
                  }
                }}
                placeholder="Rechercher par nom, marque, catégorie..."
                className="flex-1 px-4 py-3 bg-transparent outline-none text-gray-700 placeholder-gray-400"
              />
              {searchValue && (
                <button 
                  onClick={() => {
                    setSearchValue('')
                    setShowSuggestions(false)
                  }} 
                  className="pr-3 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
              <button 
                onClick={() => handleSearch(searchValue)}
                className="m-1.5 w-10 h-10 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center justify-center"
              >
                <Search size={18} />
              </button>
            </div>

            {/* Suggestions de recherche */}
            {showSuggestions && (searchSuggestions.length > 0 || searchSuggestion) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                {searchSuggestion && (
                  <div className="p-3 bg-sky-50 border-b border-sky-100">
                    <p className="text-sm text-sky-800">
                      Vouliez-vous dire : 
                      <button
                        onClick={() => {
                          setSearchValue(searchSuggestion)
                          handleSearch(searchSuggestion)
                        }}
                        className="font-bold underline hover:text-sky-600 ml-1"
                      >
                        {searchSuggestion}
                      </button> ?
                    </p>
                  </div>
                )}
                {searchSuggestions.map((result, idx) => {
                  const isProduct = result.resultType === 'product'
                  const isCategory = result.resultType === 'category'
                  const isBrand = result.resultType === 'brand'
                  
                  let icon = <Package size={16} className="text-gray-400" />
                  let typeLabel = 'Produit'
                  
                  if (isCategory) {
                    icon = <Layers size={16} className="text-blue-500" />
                    typeLabel = 'Catégorie'
                  } else if (isBrand) {
                    icon = <Tag size={16} className="text-orange-500" />
                    typeLabel = 'Marque'
                  }
                  
                  return (
                    <button
                      key={`${result.id || result.name}-${idx}`}
                      onClick={() => handleSuggestionClick(result)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      {isProduct && result.image ? (
                        <img src={result.image} alt={result.name} className="w-10 h-10 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                          {icon}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          <Highlight text={result.name} query={searchValue} />
                        </p>
                        <p className="text-xs text-gray-500">{typeLabel}</p>
                      </div>
                      {isProduct && (
                        <span className="text-sm font-bold text-sky-700">
                          {formatPrice(result.price)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* En-tête avec filtres et tri */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filtres latéraux */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <SlidersHorizontal size={20} />
                  Filtres
                </h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-sky-700 hover:text-sky-800 font-medium"
                >
                  Effacer tout
                </button>
              </div>

              {/* Filtre par catégorie */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Filtre par marque */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Marque
                </label>
                <select
                  value={filters.brand}
                  onChange={(e) => handleFilterChange('brand', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Toutes les marques</option>
                  {brands.map(brand => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>

              {/* Fourchette de prix */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fourchette de prix (DH)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minPrice}
                    onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxPrice}
                    onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Disponibilité */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.inStock}
                    onChange={(e) => handleFilterChange('inStock', e.target.checked)}
                    className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Produits en stock uniquement
                  </span>
                </label>
              </div>

              {/* Note minimale */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note minimale
                </label>
                <select
                  value={filters.minRating}
                  onChange={(e) => handleFilterChange('minRating', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Toutes les notes</option>
                  <option value="4">4 étoiles et plus</option>
                  <option value="3">3 étoiles et plus</option>
                  <option value="2">2 étoiles et plus</option>
                  <option value="1">1 étoile et plus</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="flex-1">
            {/* Barre de résultats et tri */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h1 className="text-xl font-bold text-gray-900">
                    {query ? (
                      <>
                        Résultats pour "<Highlight text={query} query={query} />"
                      </>
                    ) : (
                      'Tous les produits'
                    )}
                  </h1>
                  <span className="text-sm text-gray-600">
                    ({totalResults} produit{totalResults > 1 ? 's' : ''})
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Tri */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Trier par :</label>
                    <select
                      value={filters.sortBy}
                      onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                    >
                      <option value="relevance">Pertinence</option>
                      <option value="price_asc">Prix croissant</option>
                      <option value="price_desc">Prix décroissant</option>
                      <option value="newest">Nouveautés</option>
                      <option value="rating">Meilleures notes</option>
                      <option value="sales">Meilleures ventes</option>
                    </select>
                  </div>
                  
                  {/* Mode d'affichage */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded transition-colors ${
                        viewMode === 'grid' 
                          ? 'bg-white text-sky-700 shadow-sm' 
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Vue grille"
                    >
                      <Grid3x3 size={18} />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded transition-colors ${
                        viewMode === 'list' 
                          ? 'bg-white text-sky-700 shadow-sm' 
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Vue liste"
                    >
                      <List size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Résultats */}
            {loading && page === 1 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <Loader2 size={32} className="animate-spin text-sky-700 mx-auto mb-4" />
                <p className="text-gray-600">Recherche en cours...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <Search size={64} className="mx-auto text-gray-300 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun résultat trouvé</h2>
                <p className="text-gray-600 mb-6">
                  {query ? (
                    <>Essayez avec d'autres mots-clés ou ajustez vos filtres</>
                  ) : (
                    <>Utilisez la barre de recherche ou sélectionnez des filtres</>
                  )}
                </p>
                <button
                  onClick={() => {
                    clearFilters()
                    navigate('/')
                  }}
                  className="px-6 py-3 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors"
                >
                  Voir tous les produits
                </button>
              </div>
            ) : (
              <>
                {/* Vue grille */}
                {viewMode === 'grid' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAddToCart={addToCart}
                        onToggleFavorite={handleToggleFavorite}
                        isFavorite={isFavorite(product.id)}
                        searchQuery={query}
                      />
                    ))}
                  </div>
                )}

                {/* Vue liste */}
                {viewMode === 'list' && (
                  <div className="space-y-4">
                    {filteredProducts.map((product) => (
                      <ProductCardList
                        key={product.id}
                        product={product}
                        onAddToCart={addToCart}
                        onToggleFavorite={handleToggleFavorite}
                        isFavorite={isFavorite(product.id)}
                        searchQuery={query}
                      />
                    ))}
                  </div>
                )}

                {/* Indicateur de chargement pour pagination */}
                {loading && page > 1 && (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 size={32} className="animate-spin text-sky-700" />
                  </div>
                )}

                {/* Cible pour le scroll infini */}
                {hasMore && <div ref={observerTarget} className="h-10" />}

                {/* Fin de liste */}
                {!hasMore && filteredProducts.length > 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Vous avez vu tous les produits
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const ProductCard = ({ product, onAddToCart, onToggleFavorite, isFavorite, searchQuery }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
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

  const translatedProduct = useAutoTranslateObject(product, ['brand', 'name'])
  const productName = translatedProduct?.name || product.name

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group">
      <div 
        onClick={handleProductClick}
        className="relative bg-gray-100 h-56 overflow-hidden cursor-pointer"
      >
        <img
          src={product.image}
          alt={productName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { e.target.src = '/images/placeholder.svg' }}
        />

        {/* Badge de promotion - Calculé automatiquement */}
        {discountPercentage > 0 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-sm font-bold bg-orange-500 text-white">
            -{product.discountType === 'fixed' 
              ? `${(product.oldPrice - product.price).toFixed(0)} DH` 
              : `${formatDiscountPercentage(discountPercentage)}%`}
          </div>
        )}

        {/* Badge "Nouveau" pour les produits récents */}
        {product.isNew && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-bold bg-green-500 text-white">
            Nouveau
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(product)
          }}
          className={`absolute ${product.isNew ? 'top-12 left-3' : 'top-3 left-3'} p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors`}
        >
          <Heart
            size={18}
            className={`transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
            strokeWidth={1.8}
          />
        </button>
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-500 mb-1">
          <Highlight text={product.brand || 'Marque'} query={searchQuery} />
        </p>
        <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2 h-10">
          <Highlight text={product.name} query={searchQuery} />
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
          <span className="text-xl font-bold text-sky-700 ltr">{formatPrice(product.price)}</span>
          {product.oldPrice && product.oldPrice > product.price && (
            <span className="text-sm text-gray-500 line-through">{formatPrice(product.oldPrice)}</span>
          )}
        </div>

        {/* Indicateur de stock */}
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs px-2 py-1 rounded-full ${
            product.stock > 10 
              ? 'bg-green-100 text-green-800' 
              : product.stock > 0 
              ? 'bg-orange-100 text-orange-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {product.stock > 0 ? `${product.stock} en stock` : 'Rupture de stock'}
          </span>
          {product.category && (
            <span className="text-xs text-gray-500">
              <Highlight text={product.category.name} query={searchQuery} />
            </span>
          )}
        </div>

        <button
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 mt-3 rounded-lg font-medium text-sm transition-all duration-200 ${
            product.stock === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : isAdded
              ? 'bg-green-500 text-white'
              : 'bg-sky-700 hover:bg-sky-800 text-white'
          }`}
        >
          <ShoppingCart size={16} strokeWidth={1.8} />
          {product.stock === 0 ? 'Rupture de stock' : isAdded ? 'Ajouté !' : 'Ajouter au panier'}
        </button>
      </div>
    </div>
  )
}

export default SearchResults