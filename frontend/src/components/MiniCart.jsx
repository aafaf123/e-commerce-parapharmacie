import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { ShoppingBag, X, ArrowRight } from 'lucide-react'

const MiniCart = ({ onClose }) => {
  const navigate = useNavigate()
  const { cartItems, removeFromCart, getTotalPrice, updateQuantity } = useCart()

  const handleViewCart = () => {
    navigate('/cart')
    onClose()
  }

  if (cartItems.length === 0) {
    return (
      <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Mon Panier</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="text-center py-8">
          <ShoppingBag size={48} className="mx-auto text-gray-300 mb-3" strokeWidth={1.5} />
          <p className="text-gray-600">Votre panier est vide</p>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">Mon Panier ({cartItems.length})</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto p-4">
        <div className="space-y-3">
          {cartItems.map((item) => (
            <div key={`${item.id}-${item.variantId || ''}`} className="flex gap-3 p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <img
                src={item.image}
                alt={item.name}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">{item.brand}</p>
                    <h4 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h4>
                    {item.variantValue && (
                      <p className="text-xs text-sky-600 font-medium mt-0.5">{item.variantValue}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id, item.variantId)}
                    className="text-red-600 hover:text-red-700 ml-2 hover:bg-red-50 p-1 rounded transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-600">Qté: {item.quantity}</span>
                  <span className="text-sm font-bold text-sky-700">
                    {(item.price * item.quantity).toFixed(2)} DH
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-700 font-medium">Total</span>
          <span className="text-xl font-bold text-sky-700">{getTotalPrice().toFixed(2)} DH</span>
        </div>
        <button
          onClick={handleViewCart}
          className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          Voir le panier
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

export default MiniCart
