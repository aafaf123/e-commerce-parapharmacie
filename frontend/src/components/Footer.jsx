import { MapPin, Phone, Mail, Clock, Facebook, Instagram, Package, Truck, Shield, CreditCard, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const Footer = () => {
  const navigate = useNavigate()

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Section principale */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* À propos */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">ParaClick</h3>
            <p className="text-sm mb-4">
              Votre parapharmacie en ligne au Maroc. Click & Collect rapide et sécurisé pour tous vos produits de santé et bien-être.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={16} className="text-sky-400" />
                <span>Lastah, Taroudant</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone size={16} className="text-sky-400" />
                <span>+212 629539724</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail size={16} className="text-sky-400" />
                <span>sanaepatrish@gmail.com</span>
              </div>
            </div>
          </div>

          {/* Horaires & Disponibilité */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Horaires d'ouverture</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Clock size={16} className="text-sky-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Lundi - Samedi</p>
                  <p>9h00 - 19h00</p>
                  <p className="text-xs text-gray-400">Pause: 12h30 - 14h00</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock size={16} className="text-sky-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Dimanche</p>
                  <p className="text-red-400">Fermé</p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-sky-900 rounded-lg">
                <p className="text-xs text-sky-200">
                   Click & Collect disponible sous 2h
                </p>
              </div>
            </div>
          </div>

          {/* Liens utiles */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Liens utiles</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button onClick={() => navigate('/products')} className="hover:text-sky-400 transition-colors">
                  Nos produits
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/my-orders')} className="hover:text-sky-400 transition-colors">
                  Mes commandes
                </button>
              </li>
              <li>
                <button className="hover:text-sky-400 transition-colors">
                  À propos
                </button>
              </li>
              <li>
                <button className="hover:text-sky-400 transition-colors">
                  Conditions générales
                </button>
              </li>
              <li>
                <button className="hover:text-sky-400 transition-colors">
                  Politique de confidentialité
                </button>
              </li>
              <li>
                <button className="hover:text-sky-400 transition-colors">
                  FAQ
                </button>
              </li>
            </ul>
          </div>

          {/* Réseaux sociaux & Infos */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Suivez-nous</h3>
            <div className="flex gap-3 mb-6">
              <a href="https://web.facebook.com/sanae.patrish/" className="p-2 bg-gray-800 hover:bg-sky-700 rounded-lg transition-colors">
                <Facebook size={20} />
              </a>
              <a href="instagram.com" className="p-2 bg-gray-800 hover:bg-sky-700 rounded-lg transition-colors">
                <Instagram size={20} />
              </a>
              <a href="https://wa.me/212629539724" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 hover:bg-green-600 rounded-lg transition-colors">
                <MessageCircle size={20} />
              </a>
            </div>

            <h3 className="text-white font-bold text-lg mb-4">Nos services</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-green-400" />
                <span>Click & Collect gratuit</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-green-400" />
                <span>Livraison gratuite dès 300 DH</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-green-400" />
                <span>Paiement sécurisé</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-green-400" />
                <span>Paiement au comptoir</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section inférieure */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <p className="text-gray-400">
              © 2026 ParaClick. Tous droits réservés.
            </p>
            <div className="flex gap-6 text-gray-400">
              <button className="hover:text-sky-400 transition-colors">
                Mentions légales
              </button>
              <button className="hover:text-sky-400 transition-colors">
                CGV
              </button>
              <button className="hover:text-sky-400 transition-colors">
                Cookies
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
