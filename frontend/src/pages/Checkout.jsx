import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCart } from '../context/CartContext'
import { ArrowLeft, Store, Truck, CheckCircle } from 'lucide-react'

const Checkout = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { cartItems } = useCart()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/login'); return }
    if (cartItems.length === 0) navigate('/cart')
  }, [cartItems, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <button onClick={() => navigate('/cart')} className="flex items-center gap-2 text-sky-700 font-semibold mb-8 hover:text-sky-900 text-lg">
          <ArrowLeft size={22} /> {t('checkout.back_to_cart')}
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{t('checkout.how_receive')}</h1>
        <p className="text-gray-500 text-center mb-10 text-base">{t('checkout.choose_mode')}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button onClick={() => navigate('/checkout/time-slot')}
            className="group bg-white rounded-3xl shadow-md hover:shadow-xl border-2 border-transparent hover:border-sky-600 transition-all duration-300 p-8 text-left">
            <div className="flex items-center justify-center w-16 h-16 bg-sky-100 group-hover:bg-sky-700 rounded-2xl mb-5 transition-colors duration-300">
              <Store size={32} className="text-sky-700 group-hover:text-white transition-colors duration-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('product.click_collect')}</h2>
            <p className="text-gray-500 text-sm mb-5">{t('checkout.click_collect_desc')}</p>
            <ul className="space-y-2">
              {[t('checkout.free'), t('checkout.available_2h'), t('checkout.pay_counter')].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-green-700 font-medium">
                  <CheckCircle size={15} className="text-green-500 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 w-full py-3 bg-sky-700 group-hover:bg-sky-800 text-white font-semibold rounded-xl text-center transition-colors duration-300">
              {t('checkout.choose_slot')}
            </div>
          </button>

          <button onClick={() => navigate('/checkout/delivery')}
            className="group bg-white rounded-3xl shadow-md hover:shadow-xl border-2 border-transparent hover:border-sky-600 transition-all duration-300 p-8 text-left">
            <div className="flex items-center justify-center w-16 h-16 bg-orange-100 group-hover:bg-sky-700 rounded-2xl mb-5 transition-colors duration-300">
              <Truck size={32} className="text-orange-600 group-hover:text-white transition-colors duration-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('checkout.delivery_home')}</h2>
            <p className="text-gray-500 text-sm mb-5">{t('checkout.delivery_desc')}</p>
            <ul className="space-y-2">
              {[t('checkout.delivery_24h'), t('checkout.choose_time'), t('checkout.pay_on_delivery')].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-green-700 font-medium">
                  <CheckCircle size={15} className="text-green-500 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 w-full py-3 bg-sky-700 group-hover:bg-sky-800 text-white font-semibold rounded-xl text-center transition-colors duration-300">
              {t('checkout.enter_address')}
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Checkout
