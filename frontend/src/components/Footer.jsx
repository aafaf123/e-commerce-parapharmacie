import { MapPin, Phone, Mail, Clock, Facebook, Instagram, Package, Truck, Shield, CreditCard, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const Footer = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-4">ParaClick</h3>
            <p className="text-sm mb-4">{t('footer.about_desc')}</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm"><MapPin size={16} className="text-sky-400" /><span>Lastah, Taroudant</span></div>
              <div className="flex items-center gap-2 text-sm"><Phone size={16} className="text-sky-400" /><span dir="ltr">+212 629539724</span></div>
              <div className="flex items-center gap-2 text-sm"><Mail size={16} className="text-sky-400" /><span dir="ltr">sanaepatrish@gmail.com</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-4">{t('footer.hours_title')}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Clock size={16} className="text-sky-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">{t('footer.hours_weekdays')}</p>
                  <p>{t('footer.hours_time')}</p>
                  <p className="text-xs text-gray-400">{t('footer.hours_break')}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock size={16} className="text-sky-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">{t('footer.hours_sunday')}</p>
                  <p className="text-red-400">{t('footer.hours_closed')}</p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-sky-900 rounded-lg">
                <p className="text-xs text-sky-200">{t('footer.collect_available')}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-4">{t('footer.useful_links')}</h3>
            <ul className="space-y-2 text-sm">
              <li><button onClick={() => navigate('/products')} className="hover:text-sky-400 transition-colors">{t('footer.our_products')}</button></li>
              <li><button onClick={() => navigate('/my-orders')} className="hover:text-sky-400 transition-colors">{t('footer.my_orders')}</button></li>
              <li><button className="hover:text-sky-400 transition-colors">{t('footer.about')}</button></li>
              <li><button className="hover:text-sky-400 transition-colors">{t('footer.terms')}</button></li>
              <li><button className="hover:text-sky-400 transition-colors">{t('footer.privacy')}</button></li>
              <li><button className="hover:text-sky-400 transition-colors">{t('footer.faq')}</button></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-4">{t('footer.follow_us')}</h3>
            <div className="flex gap-3 mb-6">
              <a href="https://web.facebook.com/sanae.patrish/" className="p-2 bg-gray-800 hover:bg-sky-700 rounded-lg transition-colors"><Facebook size={20} /></a>
              <a href="instagram.com" className="p-2 bg-gray-800 hover:bg-sky-700 rounded-lg transition-colors"><Instagram size={20} /></a>
              <a href="https://wa.me/212629539724" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 hover:bg-green-600 rounded-lg transition-colors"><MessageCircle size={20} /></a>
            </div>
            <h3 className="text-white font-bold text-lg mb-4">{t('footer.our_services')}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><Package size={16} className="text-green-400" /><span>{t('footer.free_collect')}</span></div>
              <div className="flex items-center gap-2"><Truck size={16} className="text-green-400" /><span>{t('footer.free_delivery')}</span></div>
              <div className="flex items-center gap-2"><Shield size={16} className="text-green-400" /><span>{t('footer.secure_payment')}</span></div>
              <div className="flex items-center gap-2"><CreditCard size={16} className="text-green-400" /><span>{t('footer.counter_payment')}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <p className="text-gray-400">{t('footer.copyright')}</p>
            <div className="flex gap-6 text-gray-400">
              <button className="hover:text-sky-400 transition-colors">{t('footer.legal')}</button>
              <button className="hover:text-sky-400 transition-colors">{t('footer.cgv')}</button>
              <button className="hover:text-sky-400 transition-colors">{t('footer.cookies')}</button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
