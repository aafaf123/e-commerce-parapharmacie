import { X, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAutoTranslateArray } from '../hooks/useAutoTranslate'

const MiniFavorites = ({ favorites, onRemove, onClose }) => {
  const { t } = useTranslation()
  const translatedFavorites = useAutoTranslateArray(favorites, ['name'])
  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{t('favorites.title')} ({favorites.length})</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          <X size={18} className="text-gray-600" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {favorites.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>{t('favorites.empty')}</p>
          </div>
        ) : (
          <div className="p-2">
            {translatedFavorites.map((product) => (
                <div key={product.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <img src={product.image} alt={product.name} className="w-16 h-16 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-sm font-bold text-sky-700 ltr">{product.price.toFixed(2)} DH</p>
                  </div>
                <button
                  onClick={() => onRemove(product.id)}
                  className="p-2 hover:bg-red-50 rounded-full transition-colors"
                >
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MiniFavorites
