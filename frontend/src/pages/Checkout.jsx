import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { ArrowLeft, Store, Truck, CheckCircle } from 'lucide-react'

const Checkout = () => {
  const navigate = useNavigate()
  const { cartItems } = useCart()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/login'); return }
    if (cartItems.length === 0) navigate('/cart')
  }, [cartItems, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">

        <button onClick={() => navigate('/cart')}
          className="flex items-center gap-2 text-sky-700 font-semibold mb-8 hover:text-sky-900 text-lg">
          <ArrowLeft size={22} /> Retour au panier
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
          Comment souhaitez-vous recevoir votre commande ?
        </h1>
        <p className="text-gray-500 text-center mb-10 text-base">
          Choisissez votre mode de retrait ou de livraison
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Click & Collect */}
          <button
            onClick={() => navigate('/checkout/time-slot')}
            className="group bg-white rounded-3xl shadow-md hover:shadow-xl border-2 border-transparent hover:border-sky-600 transition-all duration-300 p-8 text-left"
          >
            <div className="flex items-center justify-center w-16 h-16 bg-sky-100 group-hover:bg-sky-700 rounded-2xl mb-5 transition-colors duration-300">
              <Store size={32} className="text-sky-700 group-hover:text-white transition-colors duration-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Click & Collect</h2>
            <p className="text-gray-500 text-sm mb-5">
              Retirez votre commande directement en pharmacie au créneau de votre choix.
            </p>
            <ul className="space-y-2">
              {['Gratuit', 'Disponible sous 2h', 'Paiement au comptoir'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-green-700 font-medium">
                  <CheckCircle size={15} className="text-green-500 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 w-full py-3 bg-sky-700 group-hover:bg-sky-800 text-white font-semibold rounded-xl text-center transition-colors duration-300">
              Choisir un créneau →
            </div>
          </button>

          {/* Livraison à domicile */}
          <button
            onClick={() => navigate('/checkout/delivery')}
            className="group bg-white rounded-3xl shadow-md hover:shadow-xl border-2 border-transparent hover:border-sky-600 transition-all duration-300 p-8 text-left"
          >
            <div className="flex items-center justify-center w-16 h-16 bg-orange-100 group-hover:bg-sky-700 rounded-2xl mb-5 transition-colors duration-300">
              <Truck size={32} className="text-orange-600 group-hover:text-white transition-colors duration-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Livraison à domicile</h2>
            <p className="text-gray-500 text-sm mb-5">
              Recevez votre commande directement chez vous au créneau de votre choix.
            </p>
            <ul className="space-y-2">
              {['Livraison rapide 24h–48h', 'Créneau horaire au choix', 'Paiement à la livraison'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-green-700 font-medium">
                  <CheckCircle size={15} className="text-green-500 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 w-full py-3 bg-sky-700 group-hover:bg-sky-800 text-white font-semibold rounded-xl text-center transition-colors duration-300">
              Saisir mon adresse →
            </div>
          </button>

        </div>
      </div>
    </div>
  )
}

export default Checkout
