import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Search, Filter, X, Tag, DollarSign } from 'lucide-react'
import { searchSchema } from '../lib/validationSchemas'

const AdvancedSearchForm = ({ onSearch, onReset }) => {
  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: '',
      category: '',
      minPrice: '',
      maxPrice: '',
      brand: ''
    }
  })

  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // Charger les catégories et marques
    const loadFilters = async () => {
      try {
        const [categoriesRes, brandsRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/brands')
        ])
        
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json()
          setCategories(categoriesData)
        }
        
        if (brandsRes.ok) {
          const brandsData = await brandsRes.json()
          setBrands(brandsData)
        }
      } catch (error) {
        console.error('Erreur lors du chargement des filtres:', error)
      }
    }

    loadFilters()
  }, [])

  const onSubmit = (data) => {
    // Nettoyer les valeurs vides
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== '' && value !== undefined)
    )
    onSearch(cleanData)
  }

  const handleReset = () => {
    reset()
    setIsExpanded(false)
    onReset()
  }

  const watchedValues = watch()
  const hasFilters = Object.values(watchedValues).some(value => value !== '' && value !== undefined)

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Recherche principale */}
        <div className="relative">
          <Search size={20} className="absolute left-3 top-3.5 text-gray-400" />
          <input
            type="text"
            {...register('query')}
            placeholder="Rechercher un produit..."
            className={`w-full pl-10 pr-20 py-3 border-2 rounded-lg focus:outline-none transition-colors ${
              errors.query ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-sky-700'
            }`}
          />
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="absolute right-3 top-3 p-1 text-gray-400 hover:text-sky-700 transition-colors"
            title="Filtres avancés"
          >
            <Filter size={18} />
          </button>
        </div>
        {errors.query && <p className="text-xs text-red-600">{errors.query.message}</p>}

        {/* Filtres avancés */}
        {isExpanded && (
          <div className="border-t pt-4 space-y-4 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-sky-700" />
              <h3 className="font-semibold text-gray-900">Filtres avancés</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Catégorie */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag size={14} className="inline mr-1" />
                  Catégorie
                </label>
                <select
                  {...register('category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Marque */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Marque
                </label>
                <select
                  {...register('brand')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                >
                  <option value="">Toutes les marques</option>
                  {brands.map(brand => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prix minimum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign size={14} className="inline mr-1" />
                  Prix min (DH)
                </label>
                <input
                  type="number"
                  {...register('minPrice', { valueAsNumber: true })}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-sky-700 ${
                    errors.minPrice ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.minPrice && <p className="text-xs text-red-600 mt-1">{errors.minPrice.message}</p>}
              </div>

              {/* Prix maximum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prix max (DH)
                </label>
                <input
                  type="number"
                  {...register('maxPrice', { valueAsNumber: true })}
                  min="0"
                  step="0.01"
                  placeholder="1000"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-sky-700 ${
                    errors.maxPrice ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.maxPrice && <p className="text-xs text-red-600 mt-1">{errors.maxPrice.message}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Search size={18} />
            Rechercher
          </button>
          
          {hasFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <X size={18} />
              Effacer
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default AdvancedSearchForm