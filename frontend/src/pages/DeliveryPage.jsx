import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCart } from '../context/CartContext'
import {
  ArrowLeft,
  MapPin,
  Phone,
  Info,
  Truck,
  Calendar,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import api from '../api/axios'

const DeliveryPage = () => {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { cartItems, getTotalPrice, getShippingInfo } = useCart()
  const shippingInfo = getShippingInfo()
  const isAr = i18n.language?.startsWith('ar')

  const DAY_LABELS = isAr
    ? ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
    : ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const DAY_FULL = isAr
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const MONTH_LABELS = isAr
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  const [deliveryFee, setDeliveryFee] = useState(25)
  const [deliveryType, setDeliveryType] = useState('STANDARD')

  const [cities, setCities] = useState([])
  const [districts, setDistricts] = useState([])
  const [days, setDays] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)

  const [loadingZones, setLoadingZones] = useState(false)
  const [loadingDays, setLoadingDays] = useState(false)
  const [slotError, setSlotError] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const [address, setAddress] = useState({
    cityId: '',
    districtName: '',
    street: '',
    phone: '',
    instructions: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/login'); return }
    if (cartItems.length === 0) { navigate('/cart'); return }
    localStorage.setItem('orderMode', 'DELIVERY')
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.phone) setAddress(p => ({ ...p, phone: user.phone }))
    api.get('/settings').then(res => { if (res.data.DELIVERY_FEE) setDeliveryFee(parseFloat(res.data.DELIVERY_FEE)) }).catch(console.error)
    const load = async () => {
      setLoadingZones(true); setLoadingDays(true); setSlotError(null)
      try {
        const [citiesRes, daysRes] = await Promise.all([
          api.get('/delivery-zones/cities'),
          api.get('/delivery-days/available', { params: { days: 7 } }),
        ])
        setCities(citiesRes.data || [])
        const dayList = daysRes.data || []
        setDays(dayList)
        setSelectedDay(dayList.find(d => d.available) || null)
      } catch (e) {
        setSlotError(t('delivery.error'))
      } finally {
        setLoadingZones(false); setLoadingDays(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const loadDistricts = async () => {
      if (!address.cityId) {
        setDistricts([])
        return
      }
      setLoadingZones(true)
      try {
        const { data } = await api.get('/delivery-zones/districts', { params: { cityId: address.cityId } })
        setDistricts(data || [])
      } catch { setDistricts([]) } finally { setLoadingZones(false) }
    }
    loadDistricts()
  }, [address.cityId])

  const validateAddress = () => {
    const e = {}
    if (!address.cityId) e.cityId = 'Ville requise'
    if (!address.districtName.trim()) e.districtName = 'Quartier requis'
    if (!address.street.trim()) e.street = 'Numéro et rue requis'
    if (!address.phone.trim()) e.phone = 'Téléphone requis'
    else if (!/^[0-9+\s\-]{8,}$/.test(address.phone.trim())) e.phone = 'Numéro invalide'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const subtotal = getTotalPrice()
  const actualDeliveryFee = shippingInfo.isFree ? 0 : deliveryFee
  const remainingForFree = Math.max(0, Number(shippingInfo.remaining || 0))

  const handleConfirm = () => {
    if (!validateAddress() || !selectedDay?.available) return
    setConfirming(true)
    const cityName = cities.find(c => c.id === address.cityId)?.name || ''
    localStorage.setItem('deliveryCityId', address.cityId)
    localStorage.setItem('deliveryCityName', cityName)
    localStorage.setItem('deliveryDistrictName', address.districtName)
    localStorage.setItem('deliveryStreet', address.street)
    localStorage.setItem('deliveryPhone', address.phone)
    localStorage.setItem('deliveryInstructions', address.instructions || '')
    localStorage.setItem('selectedTimeSlot', JSON.stringify({
      date: selectedDay.date,
      slot: { time: selectedDay.startTime || '10:00', endTime: selectedDay.endTime || '18:00' },
    }))
    localStorage.setItem('deliveryType', deliveryType)
    localStorage.setItem('deliveryFee', shippingInfo.isFree ? 0 : deliveryFee)

    setTimeout(() => navigate('/checkout/confirmation'), 800)
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontSize: '1.08rem' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <button onClick={() => navigate('/checkout')} className="flex items-center gap-2 text-sky-700 font-semibold mb-7 hover:text-sky-900 text-base">
          <ArrowLeft size={20} /> {t('delivery.back')}
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-sky-700 rounded-xl"><Truck size={26} className="text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Livraison à domicile</h1>
            <p className="text-gray-500 text-sm">Choisissez le jour et renseignez votre adresse</p>
          </div>
        </div>

        {shippingInfo.isFree && (
          <div className="mb-8 bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-green-100 rounded-full"><Truck size={24} className="text-green-600" /></div>
            <div>
              <p className="text-green-800 font-bold text-lg">{t('delivery.free_delivery')}</p>
              <p className="text-green-700">{t('delivery.free_delivery_desc', { threshold: shippingInfo.threshold })}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            <div className="bg-white rounded-2xl shadow-sm p-7">
              <div className="flex items-center gap-2 mb-6">
                <MapPin size={20} className="text-sky-700" />
                <h2 className="text-lg font-bold text-gray-900">{t('delivery.address_title')}</h2>
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Ville <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={address.cityId}
                      onChange={(e) => {
                        setAddress(p => ({ ...p, cityId: e.target.value, districtName: '' }))
                        setErrors(p => ({ ...p, cityId: '' }))
                      }}
                      className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 ${errors.cityId ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                      disabled={loadingZones}
                    >
                      <option value="">Sélectionner une ville</option>
                      {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {errors.cityId && <p className="text-xs text-red-500 mt-1">{errors.cityId}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Quartier <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-3">
                      {districts.length > 0 && (
                        <>
                          <p className="text-xs text-gray-500 mb-2">Suggestions :</p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {districts.map(d => (
                              <button
                                key={d.id}
                                onClick={() => {
                                  setAddress(p => ({ ...p, districtName: d.name }))
                                  setErrors(p => ({ ...p, districtName: '' }))
                                }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                  address.districtName === d.name
                                    ? 'bg-sky-700 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {d.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <input
                        type="text"
                        value={address.districtName}
                        onChange={e => {
                          setAddress(p => ({ ...p, districtName: e.target.value }))
                          setErrors(p => ({ ...p, districtName: '' }))
                        }}
                        placeholder="Saisir le quartier..."
                        className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 ${
                          errors.districtName ? 'border-red-400 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                    </div>
                    {errors.districtName && <p className="text-xs text-red-500 mt-1">{errors.districtName}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('delivery.street')} <span className="text-red-500">*</span></label>
                  <input type="text" value={address.street} onChange={e => { setAddress(p => ({ ...p, street: e.target.value })); setErrors(p => ({ ...p, street: '' })) }}
                    placeholder={t('delivery.street_placeholder')}
                    className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:border-sky-600 ${errors.street ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                  {errors.street && <p className="text-xs text-red-500 mt-1">{errors.street}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><Phone size={14} /> {t('delivery.phone')} <span className="text-red-500">*</span></span>
                  </label>
                  <input type="tel" value={address.phone} onChange={e => { setAddress(p => ({ ...p, phone: e.target.value })); setErrors(p => ({ ...p, phone: '' })) }}
                    placeholder={t('delivery.phone_placeholder')}
                    className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:border-sky-600 ${errors.phone ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><Info size={14} /> {t('delivery.instructions')}</span>
                  </label>
                  <input type="text" value={address.instructions} onChange={e => setAddress(p => ({ ...p, instructions: e.target.value }))}
                    placeholder={t('delivery.instructions_placeholder')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:border-sky-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-2xl shadow-sm p-7">
              <div className="flex items-center gap-2 mb-5">
                <Calendar size={20} className="text-sky-700" />
                <h2 className="text-lg font-bold text-gray-900">{t('delivery.choose_day')}</h2>
              </div>

              {loadingDays ? (
                <div className="flex justify-center items-center py-10 text-gray-500">
                  <Loader2 size={22} className="animate-spin text-sky-700" />
                  <span className="ml-2">{t('delivery.loading')}</span>
                </div>
              ) : slotError ? (
                <div className="text-center py-8 bg-red-50 rounded-xl">
                  <p className="text-sm text-red-600">{slotError}</p>
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {days.map((d) => {
                    const jsDate = new Date(d.date + 'T00:00:00.000Z')
                    const isSel = selectedDay?.date === d.date
                    const disabled = !d.available
                    return (
                      <button key={d.date} onClick={() => !disabled && setSelectedDay(d)} disabled={disabled}
                        className={`flex-shrink-0 flex flex-col items-center px-3.5 py-3 rounded-2xl border-2 transition-all min-w-[78px] ${
                          disabled ? 'border-gray-100 bg-gray-100 text-gray-300 cursor-not-allowed opacity-60'
                            : isSel ? 'border-sky-700 bg-sky-700 text-white shadow-md'
                            : 'border-gray-200 hover:border-sky-400 hover:bg-sky-50 text-gray-700'
                        }`}
                        title={disabled ? t('delivery.complete') : t('delivery.available')}>
                        <span className={`text-[11px] font-bold uppercase ${disabled ? 'text-gray-300' : isSel ? 'text-sky-100' : 'text-gray-400'}`}>
                          {DAY_LABELS[jsDate.getUTCDay()]}
                        </span>
                        <span className="text-xl font-bold leading-tight mt-0.5">{jsDate.getUTCDate()}</span>
                        <span className={`text-[11px] ${disabled ? 'text-gray-300' : isSel ? 'text-sky-100' : 'text-gray-400'}`}>
                          {MONTH_LABELS[jsDate.getUTCMonth()]}
                        </span>
                        {!disabled && <span className={`text-[10px] font-bold mt-0.5 ${isSel ? 'text-white' : 'text-green-600'}`}>OK</span>}
                      </button>
                    )
                  })}
                </div>
              )}

              {selectedDay && (
                <div className="mt-4 bg-sky-50 border border-sky-200 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-sky-700 mb-1">{t('delivery.delivery_window')}</p>
                  <p className="font-bold text-sky-900">
                    {(() => {
                      const jsDate = new Date(selectedDay.date + 'T00:00:00.000Z')
                      return `${DAY_FULL[jsDate.getUTCDay()]} ${jsDate.getUTCDate()} ${MONTH_LABELS[jsDate.getUTCMonth()]}`
                    })()}
                    <span className="font-normal text-sky-700 ml-2 text-sm">
                      · {selectedDay.startTime || '10:00'} – {selectedDay.endTime || '18:00'}
                    </span>
                  </p>
                </div>
              )}

              <button onClick={handleConfirm} disabled={!selectedDay?.available || confirming || loadingDays}
                className={`mt-5 w-full py-4 font-bold rounded-2xl text-lg transition-all flex items-center justify-center gap-3 shadow-lg ${
                  confirming ? 'bg-green-500 text-white scale-105'
                    : !selectedDay?.available || loadingDays ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                    : 'bg-sky-700 hover:bg-sky-800 text-white'
                }`}>
                {confirming
                  ? <><CheckCircle size={22} className="animate-bounce" /> {t('delivery.confirmed')}</>
                  : <><Truck size={22} /> {t('delivery.confirm')}</>
                }
              </button>

              <div className="mt-4 bg-white rounded-2xl shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-3">{t('cart.summary')}</h3>
                <div className="border-t pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{t('delivery.subtotal')}</span><span class="ltr">{subtotal.toFixed(2)} DH</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{t('delivery.delivery_fee')}</span>
                    <span className={`ltr ${shippingInfo.isFree ? 'text-green-600 font-bold' : 'text-sky-600 font-medium'}`}>
                      {shippingInfo.isFree ? t('delivery.free') : `+${deliveryFee} DH`}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 border-t pt-2">
                    <span>{t('delivery.total')}</span>
                    <span className="text-sky-700 ltr">{(subtotal + actualDeliveryFee).toFixed(2)} DH</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeliveryPage
