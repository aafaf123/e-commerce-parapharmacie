import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown, Gift, Layers,
  Sparkle, Droplet, Wind, Waves, Smile, CircleDot, Bath,
  Baby, Milk, Heart, Tablets, Activity, Zap, Moon, Bug,
  Umbrella, Footprints, Armchair, Hand, Bone, Gauge,
  Package, ShoppingBag, Star, Truck, Shield, Clock, Calendar,
  Users, Settings, Bell, Search, Home, Sun, Pill,
  Sparkles, Droplets, Stethoscope
} from 'lucide-react'
import api from '../api/axios'

// Map icon name (stored in DB) → Lucide component
const ICON_MAP = {
  Sparkle, Droplet, Wind, Waves, Smile, CircleDot, Bath,
  Baby, Milk, Heart, Tablets, Activity, Zap, Moon, Bug,
  Umbrella, Footprints, Armchair, Hand, Bone, Gauge,
  Package, ShoppingBag, Star, Truck, Shield, Clock, Calendar,
  Users, Settings, Bell, Search, Home, Sun, Pill,
  Sparkles, Droplets, Stethoscope,
  Layers // fallback
}

const getIcon = (name) => {
  if (!name) return Layers
  return ICON_MAP[name] || Layers
}

const CategoryBar = () => {
  const navigate = useNavigate()
  const [hoveredCategory, setHoveredCategory] = useState(null)
  const [activeCategory, setActiveCategory] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch categories from API
  useEffect(() => {
    fetchCategories()
    
    // Set up periodic refresh every 30 seconds to keep categories in sync with admin changes
    const intervalId = setInterval(fetchCategories, 30000)
    
    return () => clearInterval(intervalId)
  }, [])

  // Reload categories when component becomes visible again (e.g., after returning from product detail)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCategories()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Reload categories when navigating back to this component
  useEffect(() => {
    const handlePopState = () => {
      fetchCategories()
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories')
      // Filtrer la catégorie "Promotions"
      const filtered = Array.isArray(data) ? data.filter(cat => cat.name !== 'Promotions') : []
      setCategories(filtered)
    } catch (error) {
      console.error('Erreur chargement catégories:', error)
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryClick = (cat) => {
    if (cat.subcategories?.length > 0) {
      setActiveCategory(prev => prev === cat.id ? null : cat.id)
    } else {
      setActiveCategory(null)
      navigate(`/products?category=${encodeURIComponent(cat.name)}`)
    }
  }

  const handleItemClick = (categoryName, itemName) => {
    setHoveredCategory(null)
    setActiveCategory(null)
    navigate(`/products?category=${encodeURIComponent(categoryName)}&subcategory=${encodeURIComponent(itemName)}`)
  }

  const handleSubcategoryClick = (categoryName, subcategoryTitle) => {
    setHoveredCategory(null)
    setActiveCategory(null)
    navigate(`/products?category=${encodeURIComponent(categoryName)}&subcategory=${encodeURIComponent(subcategoryTitle)}`)
  }

  const isOpen = (catId) => hoveredCategory === catId || activeCategory === catId

  return (
    <div className="bg-white border-b border-gray-200 relative">
      <div className="w-full px-4 md:px-6">

        {/* Desktop */}
        <div className="hidden md:flex justify-center items-center py-3 gap-2 flex-wrap">
          {categories.map((cat) => {
            const Icon = getIcon(cat.icon)
            const hasSubs = cat.subcategories?.length > 0
            return (
              <div
                key={cat.id}
                className="relative"
                onMouseEnter={() => hasSubs && setHoveredCategory(cat.id)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <button
                  onClick={() => handleCategoryClick(cat)}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${
                    isOpen(cat.id)
                      ? 'bg-sky-700 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  {cat.name}
                  {hasSubs && <ChevronDown size={13} strokeWidth={2} />}
                </button>
              </div>
            )
          })}
        </div>

        {/* Mobile */}
        <div className="md:hidden flex flex-col gap-2 py-2">
          {categories.map((cat) => {
            const Icon = getIcon(cat.icon)
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all w-full justify-start ${
                  activeCategory === cat.id
                    ? 'bg-sky-700 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon size={16} strokeWidth={1.8} />
                {cat.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Mega menus — one per category */
      categories.map((cat) => {
        if (!isOpen(cat.id) || !cat.subcategories?.length) return null
        return (
          <div
            key={cat.id}
            className="absolute left-0 right-0 top-full bg-white shadow-2xl border-t border-gray-200 z-50"
            onMouseEnter={() => setHoveredCategory(cat.id)}
            onMouseLeave={() => {
              setHoveredCategory(null)
              setActiveCategory(null)
            }}
          >
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
              <div className={`grid gap-6 ${
                cat.subcategories.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' :
                cat.subcategories.length === 2 ? 'grid-cols-2 max-w-2xl mx-auto' :
                cat.subcategories.length === 3 ? 'grid-cols-3 max-w-4xl mx-auto' :
                cat.subcategories.length === 4 ? 'grid-cols-4' :
                'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
              }`}>
                {cat.subcategories.map((sub) => {
                  const SubIcon = getIcon(sub.icon)
                  return (
                    <div key={sub.id}>
                      <div className="flex items-center gap-2 mb-4 cursor-pointer group/sub"
                        onClick={() => handleSubcategoryClick(cat.name, sub.title)}>
                        <SubIcon size={18} className="text-sky-700" strokeWidth={2} />
                        <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wide group-hover/sub:text-sky-700 transition-colors">
                          {sub.title}
                        </h3>
                      </div>
                      <ul className="space-y-2">
                        {sub.items?.map((item) => (
                          <li key={item.id}>
                            <button
                              onClick={() => handleItemClick(cat.name, item.name)}
                              className="text-gray-600 hover:text-sky-700 hover:translate-x-1 transition-all text-sm block w-full text-left"
                            >
                              {item.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>

              {/* Promo banner */}
              <div className="mt-8 p-5 bg-gradient-to-r from-sky-50 to-blue-50 rounded-xl border border-sky-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sky-900 text-base mb-1 flex items-center gap-2">
                    <Gift size={18} className="text-sky-700" />
                    Offres spéciales — {cat.name}
                  </h4>
                  <p className="text-sky-700 text-sm">Découvrez toute notre sélection</p>
                </div>
                <button
                  onClick={() => {
                    setHoveredCategory(null)
                    setActiveCategory(null)
                    navigate(`/products?category=${encodeURIComponent(cat.name)}`)
                  }}
                  className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  Voir tout
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CategoryBar