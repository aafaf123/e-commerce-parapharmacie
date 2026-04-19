// frontend/src/components/Navbar.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ShoppingCart, User, UserPlus, Settings, Heart, Bell, X, LogOut, Package, Moon, Sun, Tag, History, Layers, Layers2, Zap } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import { useFavorites } from '../context/FavoritesContext'
import axios from '../api/axios'
import MiniCart from './MiniCart'
import MiniFavorites from './MiniFavorites'

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
      <mark className="bg-yellow-100 text-yellow-800 rounded-sm px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

const Navbar = () => {
  const navigate = useNavigate()
  const { getTotalItems } = useCart()
  const { user, logout, isAuthenticated } = useAuth()
  const { notifications, removeNotification, requestNotificationPermission } = useWebSocket()
  const { favorites, removeFavorite, refreshFavorites } = useFavorites()

  const [searchFocused, setSearchFocused] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [searchHistory, setSearchHistory] = useState([])
  const [searchSuggestion, setSearchSuggestion] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showMiniCart, setShowMiniCart] = useState(false)
  const [showMiniFavorites, setShowMiniFavorites] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [isDarkTheme, setIsDarkTheme] = useState(() => localStorage.getItem('theme') === 'dark')
  const [loading, setLoading] = useState(true)

  const favoritesLoaded = useRef(false)
  const notificationsRef = useRef(null)
  const cartRef = useRef(null)
  const favoritesRef = useRef(null)
  const menuRef = useRef(null)
  const suggestionsRef = useRef(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) setShowNotifications(false)
      if (cartRef.current && !cartRef.current.contains(e.target)) setShowMiniCart(false)
      if (favoritesRef.current && !favoritesRef.current.contains(e.target)) setShowMiniFavorites(false)
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Theme
  useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkTheme])

  // Load favorites once after login
  useEffect(() => {
    if (isAuthenticated && !favoritesLoaded.current) {
      favoritesLoaded.current = true
      refreshFavorites()
      requestNotificationPermission()
    }
    setLoading(false)
  }, [isAuthenticated])

  const fetchSearchHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setSearchHistory([])
      return
    }

    try {
      const { data } = await axios.get('/user/search-history')
      setSearchHistory(Array.isArray(data?.searches) ? data.searches.slice(0, 5) : [])
    } catch {
      setSearchHistory([])
    }
  }, [isAuthenticated])

  const saveSearchHistory = useCallback(async (query) => {
    if (!isAuthenticated) return null

    try {
      const { data } = await axios.post('/user/search-history', { query })
      const latestSearch = data?.search

      if (latestSearch) {
        setSearchHistory((prev) => [latestSearch, ...prev.filter(item => item.query !== latestSearch.query)].slice(0, 5))
      }

      return latestSearch || null
    } catch {
      return null
    }
  }, [isAuthenticated])

  // Fetch suggestions - instant for first letter, debounced for others
  const fetchSuggestions = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchSuggestions([])
      setSearchSuggestion(null)
      setShowSuggestions(false)
      return
    }
    try {
      const { data } = await axios.get(`/products/search?q=${encodeURIComponent(query)}&limit=10`)
      // data is now { results, suggestion }
      setSearchSuggestions(data.results || [])
      setSearchSuggestion(data.suggestion)
      setShowSuggestions((data.results?.length > 0) || !!data.suggestion)
      setActiveIndex(-1)
    } catch {
      setSearchSuggestions([])
      setSearchSuggestion(null)
    }
  }, [isAuthenticated, searchHistory.length])

  useEffect(() => {
    // No debounce for first letter, faster response for later letters
    const debounceDelay = searchValue.length === 1 ? 0 : 100
    const timer = setTimeout(() => fetchSuggestions(searchValue), debounceDelay)
    return () => clearTimeout(timer)
  }, [searchValue, fetchSuggestions])

  useEffect(() => {
    fetchSearchHistory()
  }, [fetchSearchHistory])

  const handleSearch = (value) => {
    const q = (value ?? searchValue).trim()
    if (!q) return
    saveSearchHistory(q)
    navigate(`/search?q=${encodeURIComponent(q)}`)
    setSearchValue('')
    setShowSuggestions(false)
    setActiveIndex(-1)
    setShowMobileSearch(false)
  }

  const handleSuggestionClick = (result) => {
    // Handle different result types using the new resultType field
    if (result.resultType === 'product') {
      navigate(`/product/${result.id}`)
    } else if (result.resultType === 'category') {
      navigate(`/?category=${encodeURIComponent(result.name)}`)
    } else if (result.resultType === 'subcategory') {
      navigate(`/?subcategory=${encodeURIComponent(result.name)}`)
    } else if (result.resultType === 'brand') {
      navigate(`/?brand=${encodeURIComponent(result.name)}`)
    } else {
      // Fallback to old logic for compatibility
      if (result.id && result.price !== undefined) {
        navigate(`/product/${result.id}`)
      } else if (result.id && !result.price && result.categoryId === undefined) {
        navigate(`/?category=${encodeURIComponent(result.name)}`)
      } else if (result.id && result.categoryId) {
        navigate(`/?subcategory=${encodeURIComponent(result.name)}`)
      } else if (result.name && !result.id && !result.price) {
        navigate(`/?brand=${encodeURIComponent(result.name)}`)
      }
    }
    
    setSearchValue('')
    setShowSuggestions(false)
    setActiveIndex(-1)
    setShowMobileSearch(false)
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') handleSearch()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, searchSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && searchSuggestions[activeIndex]) {
        handleSuggestionClick(searchSuggestions[activeIndex])
      } else {
        handleSearch()
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveIndex(-1)
    }
  }

  const handleAdminNav = () => {
    if (isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'EMPLOYE' || user?.role === 'PREPARATEUR' || user?.role === 'CAISSIER')) {
      navigate('/admin/admindashboard')
    } else {
      navigate('/login?redirect=/admin/admindashboard')
    }
    setShowMenu(false)
  }

  const handleLogout = async () => {
    await logout()
    setShowMenu(false)
    navigate('/')
  }

  // Suggestions dropdown (shared between desktop and mobile)
  const SuggestionsDropdown = ({ mobile = false }) => {
    const showHistory = isAuthenticated && !searchValue.trim() && searchHistory.length > 0
    const hasSuggestions = searchSuggestions.length > 0 || !!searchSuggestion

    return (
      <div className={`${mobile ? '' : 'absolute top-full left-0 right-0 mt-2'} bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden`}>
        {showHistory && (
          <div className={hasSuggestions ? 'border-b border-gray-100' : ''}>
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Historique de recherche</span>
              <History size={12} className="text-gray-400" />
            </div>

            {searchHistory.map((item) => (
              <button
                key={item.id}
                onMouseDown={() => handleSearch(item.query)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-b-0 hover:bg-gray-50"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <History size={16} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.query}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {searchValue.trim() && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">
                {searchSuggestions.length} suggestion{searchSuggestions.length > 1 ? 's' : ''} pour "{searchValue}"
              </span>
              <Search size={12} className="text-gray-400" />
            </div>

            {searchSuggestion && (
              <div className="mt-1 p-2 bg-sky-50 rounded-lg border border-sky-100">
                <p className="text-xs text-sky-800">
                  Vouliez-vous dire : <button
                    onMouseDown={() => {
                      setSearchValue(searchSuggestion)
                      handleSearch(searchSuggestion)
                    }}
                    className="font-bold underline hover:text-sky-600 transition-colors"
                  >
                    {searchSuggestion}
                  </button> ?
                </p>
              </div>
            )}
          </div>
        )}

        {searchSuggestions.map((result, idx) => {
          // Determine result type and icon - simplified using resultType field
          const resultType = result.resultType
          const isProduct = resultType === 'product' || (result.id && result.price !== undefined)
          const isCategory = resultType === 'category' || (result.id && !result.price && result.categoryId === undefined)
          const isSubcategory = resultType === 'subcategory' || (result.id && result.categoryId)
          const isBrand = resultType === 'brand' || (result.name && !result.id && !result.price)

          let icon = <Package size={18} className="text-gray-400" />
          let typeLabel = ''
          let typeColor = ''
          
          if (isCategory) {
            icon = <Layers2 size={18} className="text-blue-500" />
            typeLabel = 'Catégorie'
            typeColor = 'bg-blue-50'
          } else if (isSubcategory) {
            icon = <Layers size={18} className="text-purple-500" />
            typeLabel = 'Sous-cat'
            typeColor = 'bg-purple-50'
          } else if (isBrand) {
            icon = <Tag size={18} className="text-orange-500" />
            typeLabel = 'Marque'
            typeColor = 'bg-orange-50'
          }

          return (
            <button
              key={`${result.id || result.name}-${idx}`}
              onMouseDown={() => handleSuggestionClick(result)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-b-0 ${
                idx === activeIndex ? 'bg-sky-50' : 'hover:bg-gray-50'
              }`}
            >
              {/* Icon/Image */}
              {isProduct ? (
                <div className="flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-gray-100">
                  {result.image ? (
                    <img src={result.image} alt={result.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={18} className="text-gray-400" />
                    </div>
                  )}
                </div>
              ) : (
                <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${typeColor}`}>
                  {icon}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  <Highlight text={result.name} query={searchValue} />
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {isProduct && result.brand && (
                    <span className="text-xs text-gray-400">
                      <Highlight text={result.brand} query={searchValue} />
                    </span>
                  )}
                  {(isCategory || isSubcategory || isBrand) && (
                    <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${typeColor}`}>
                      {typeLabel}
                    </span>
                  )}
                  {isProduct && result.category?.name && (
                    <span className="flex items-center gap-0.5 text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full">
                      <Tag size={9} />
                      <Highlight text={result.category.name} query={searchValue} />
                    </span>
                  )}
                </div>
              </div>

              {/* Price + stock (only for products) */}
              {isProduct && (
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-sky-700">{result.price?.toFixed(2)} DH</p>
                  {result.oldPrice && result.oldPrice > result.price && (
                    <p className="text-[10px] text-green-600 font-medium">
                      {result.discountType === 'fixed'
                        ? `-${(result.oldPrice - result.price).toFixed(0)} DH`
                        : `-${Math.round(((result.oldPrice - result.price) / result.oldPrice) * 100)}%`}
                    </p>
                  )}
                </div>
              )}
            </button>
          )
        })}

        {searchValue.trim() && (
          <button
            onMouseDown={() => handleSearch(searchValue)}
            className="w-full px-4 py-2.5 text-sm text-sky-700 font-medium bg-sky-50 hover:bg-sky-100 transition-colors flex items-center justify-center gap-2"
          >
            <Search size={14} />
            Voir tous les résultats pour "{searchValue}"
          </button>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <nav className="bg-white border-b border-gray-200 py-3 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="h-10 w-32 bg-gray-200 animate-pulse rounded" />
          <div className="hidden md:block h-12 w-96 bg-gray-200 animate-pulse rounded-full" />
          <div className="flex gap-2">
            {[1,2,3].map(i => <div key={i} className="h-10 w-10 bg-gray-200 animate-pulse rounded-full" />)}
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="bg-white border-b border-gray-200 py-3 px-4 md:px-6 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto">

        {/* Mobile full-screen search */}
        {showMobileSearch && (
          <div className="md:hidden fixed inset-0 bg-white z-50 flex flex-col">
            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
              <button onClick={() => { setShowMobileSearch(false); setSearchValue(''); setShowSuggestions(false) }}
                className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={24} className="text-gray-600" />
              </button>
              <div className="flex-1">
                <div className="flex items-center rounded-full border-2 border-sky-700 bg-white">
                  <input
                    type="text"
                    value={searchValue}
                    onChange={e => setSearchValue(e.target.value)}
                    onFocus={() => {
                      if (!searchValue.trim() && isAuthenticated && searchHistory.length > 0) {
                        setShowSuggestions(true)
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Rechercher un produit, une marque..."
                    autoFocus
                    className="flex-1 px-4 py-3 bg-transparent outline-none text-gray-700 placeholder-gray-400 text-sm"
                  />
                  {searchValue && (
                    <button onClick={() => { setSearchValue(''); setShowSuggestions(false) }} className="pr-3 text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  )}
                  <button onClick={() => handleSearch()} className="m-1.5 w-10 h-10 bg-sky-700 hover:bg-sky-800 text-white rounded-full flex items-center justify-center">
                    <Search size={18} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            </div>
            {showSuggestions && (searchSuggestions.length > 0 || (isAuthenticated && !searchValue.trim() && searchHistory.length > 0)) && (
              <div className="flex-1 overflow-y-auto">
                <SuggestionsDropdown mobile />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">

          {/* Logo - Always catalogue home */}
          <div className="flex-shrink-0 cursor-pointer" onClick={() => {
            localStorage.removeItem('lastVisitedPath')
            navigate('/')
          }}>
            <img src="/logo.jpeg" alt="ParaClick" className="h-8 md:h-10 lg:h-12 w-auto object-contain hover:scale-105 transition-transform duration-200" />
          </div>

          {/* Desktop search */}
          <div className="hidden md:flex flex-1 max-w-md mx-auto relative" ref={suggestionsRef}>
            <div className={`flex items-center rounded-full border-2 transition-all duration-300 bg-white w-full ${
              searchFocused ? 'border-sky-700 shadow-lg' : 'border-gray-300 hover:border-gray-400'
            }`}>
              <input
                type="text"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onFocus={() => {
                  setSearchFocused(true)
                  if (searchSuggestions.length > 0 || (isAuthenticated && searchHistory.length > 0 && !searchValue.trim())) {
                    setShowSuggestions(true)
                  }
                }}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher un produit, une marque..."
                className="flex-1 px-4 md:px-5 py-2.5 md:py-3 bg-transparent outline-none text-gray-700 placeholder-gray-400 text-sm"
              />
              {searchValue && (
                <button onClick={() => { setSearchValue(''); setShowSuggestions(false) }} className="pr-2 md:pr-3 text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={16} />
                </button>
              )}
              <button onClick={() => handleSearch()}
                className="m-1.5 w-9 h-9 md:w-10 md:h-10 bg-sky-700 hover:bg-sky-800 text-white rounded-full transition-colors flex items-center justify-center flex-shrink-0">
                <Search size={16} strokeWidth={2.2} />
              </button>
            </div>

            {/* Desktop suggestions dropdown */}
            {showSuggestions && (searchSuggestions.length > 0 || (isAuthenticated && !searchValue.trim() && searchHistory.length > 0)) && (
              <SuggestionsDropdown />
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3 flex-shrink-0">

            {/* Mobile search trigger */}
            <button onClick={() => setShowMobileSearch(true)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Search size={20} className="text-gray-600" strokeWidth={1.8} />
            </button>

            {/* Notifications */}
            <div className="relative hidden sm:block" ref={notificationsRef}>
              <button onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 md:p-2.5 rounded-lg hover:bg-gray-100 transition-colors group">
                <Bell size={20} className="text-gray-600 group-hover:text-sky-700 transition-colors" strokeWidth={1.8} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Bell size={32} className="mx-auto mb-2 text-gray-300" />
                      <p>Aucune notification</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {notifications.map((notif, index) => (
                        <div key={index} className="p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-semibold text-sm text-gray-900">{notif.title}</p>
                            <button onClick={() => removeNotification(index)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{notif.message}</p>
                          <p className="text-xs text-gray-400">{new Date(notif.timestamp).toLocaleString('fr-FR')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Favorites */}
            <div className="relative" ref={favoritesRef}>
              <button onClick={() => setShowMiniFavorites(!showMiniFavorites)}
                className="relative p-2 md:p-2.5 rounded-lg hover:bg-gray-100 transition-colors group">
                <Heart size={20} className="text-gray-600 group-hover:text-red-500 transition-colors" strokeWidth={1.8} />
                {favorites.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-sky-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {favorites.length}
                  </span>
                )}
              </button>
              {showMiniFavorites && (
                <MiniFavorites favorites={favorites} onRemove={removeFavorite} onClose={() => setShowMiniFavorites(false)} />
              )}
            </div>

            {/* Cart */}
            <div className="relative" ref={cartRef}>
              <button onClick={() => setShowMiniCart(!showMiniCart)}
                className="relative p-2 md:p-2.5 rounded-lg hover:bg-gray-100 transition-colors group">
                <ShoppingCart size={20} className="text-gray-600 group-hover:text-sky-700 transition-colors" strokeWidth={1.8} />
{isAuthenticated && getTotalItems() > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {getTotalItems()}
                  </span>
                )}
              </button>
              {showMiniCart && <MiniCart onClose={() => setShowMiniCart(false)} />}
            </div>

            {/* Theme toggle */}
            <button onClick={() => setIsDarkTheme(!isDarkTheme)} className="p-2 md:p-2.5 rounded-lg hover:bg-gray-100 transition-colors group">
              {isDarkTheme
                ? <Sun size={20} className="text-gray-600 group-hover:text-yellow-500 transition-colors" strokeWidth={1.8} />
                : <Moon size={20} className="text-gray-600 group-hover:text-gray-900 transition-colors" strokeWidth={1.8} />
              }
            </button>

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowMenu(!showMenu)} className="p-2 md:p-2.5 rounded-lg hover:bg-gray-100 transition-colors group">
                <Settings size={20} className="text-gray-600 group-hover:text-gray-900 transition-colors" strokeWidth={1.8} />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                  {isAuthenticated && user ? (
                    <>
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <p className="font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        {user.role !== 'CLIENT' && (
                          <span onClick={handleAdminNav}
                            className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-sky-100 text-sky-700 cursor-pointer hover:bg-sky-200">
                            {user.role === 'ADMIN' ? 'Administrateur' : user.role === 'EMPLOYE' ? 'Employé' : user.role === 'PREPARATEUR' ? 'Préparateur' : 'Caissier'}
                          </span>
                        )}
                      </div>
                      <button onClick={() => { navigate('/my-orders'); setShowMenu(false) }}
                        className="w-full text-left px-4 py-2.5 text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                        <Package size={16} className="text-gray-500" /><span>Mes commandes</span>
                      </button>
                      <button onClick={() => { navigate('/edit-profile'); setShowMenu(false) }}
                        className="w-full text-left px-4 py-2.5 text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                        <User size={16} className="text-gray-500" /><span>Modifier le profil</span>
                      </button>
                      {(user.role === 'ADMIN' || user.role === 'EMPLOYE' || user.role === 'PREPARATEUR' || user.role === 'CAISSIER') && (
                        <button onClick={handleAdminNav}
                          className="w-full text-left px-4 py-2.5 text-sky-600 hover:bg-sky-50 flex items-center gap-3 transition-colors border-t border-gray-200 mt-1">
                          <Settings size={16} /><span>Administration</span>
                        </button>
                      )}
                      <button onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors border-t border-gray-200">
                        <LogOut size={16} /><span>Déconnexion</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { navigate('/login'); setShowMenu(false) }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                        <User size={16} className="text-gray-500" /><span>Se connecter</span>
                      </button>
                      <button onClick={() => { navigate('/signup'); setShowMenu(false) }}
                        className="w-full text-left px-4 py-3 text-sky-600 hover:bg-sky-50 flex items-center gap-3 transition-colors border-t border-gray-200">
                        <UserPlus size={16} /><span>Créer un compte</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Avatar */}
            {isAuthenticated && user && (
              <button onClick={() => navigate('/edit-profile')}
                className="hidden sm:flex items-center gap-2 px-2 md:px-3 py-2 md:py-2.5 rounded-lg hover:bg-gray-100 transition-all duration-200">
                {user.profileImage ? (
                  <img src={user.profileImage} alt="Profil" className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border-2 border-sky-700" />
                ) : (
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-sky-700 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm md:text-base">
                      {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                    </span>
                  </div>
                )}
              </button>
            )}

            {/* Login / Signup buttons */}
            {!isAuthenticated && (
              <>
                <button onClick={() => navigate('/login')}
                  className="hidden lg:flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium text-xs md:text-sm hover:border-gray-400 hover:bg-gray-50 transition-all duration-200">
                  <User size={14} strokeWidth={1.8} /><span>Connexion</span>
                </button>
                <button onClick={() => navigate('/signup')}
                  className="flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-medium text-xs md:text-sm transition-all duration-200">
                  <UserPlus size={14} strokeWidth={1.8} />
                  <span className="hidden sm:inline">S'inscrire</span>
                  <span className="sm:hidden">+</span>
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar