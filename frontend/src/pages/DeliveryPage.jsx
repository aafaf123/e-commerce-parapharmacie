import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import {
  ArrowLeft, MapPin, Phone, Info, Truck, Clock,
  Calendar, Users, CheckCircle, Loader2, RefreshCw, Package
} from 'lucide-react'
import api from '../api/axios'

const DELIVERY_FEE = 25
const DAY_LABELS   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const DAY_FULL     = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

// Retourne la date au format YYYY-MM-DD en heure Maroc (UTC+1)
// Évite le décalage UTC qui peut donner la veille après 23h
const toMoroccoDateStr = (date) => {
  const moroccoMs = date.getTime() + 60 * 60 * 1000 // UTC+1
  return new Date(moroccoMs).toISOString().slice(0, 10)
}

const build15Days = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: 15 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d
  })
}

const OccupancyBar = ({ reservations, capacity }) => {
  const pct = capacity > 0 ? Math.min(100, Math.round((reservations / capacity) * 100)) : 100
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-green-500'
  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

const DeliveryPage = () => {
  const navigate = useNavigate()
  const { cartItems, getTotalPrice } = useCart()

  // Address form
  const [address, setAddress] = useState({ street: '', district: '', city: '', phone: '', instructions: '' })
  const [errors, setErrors] = useState({})

  // Calendar & slots
  const [days]         = useState(build15Days)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [timeSlots,    setTimeSlots]    = useState([])
  const [loading,      setLoading]      = useState(false)
  const [refreshing,   setRefreshing]   = useState(false)
  const [slotError,    setSlotError]    = useState(null)
  const [lastRefresh,  setLastRefresh]  = useState(null)
  const [confirming,   setConfirming]   = useState(false)

  const refreshTimer   = useRef(null)
  const currentDateRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/login'); return }
    if (cartItems.length === 0) { navigate('/cart'); return }

    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.address) setAddress(p => ({ ...p, street: user.address }))
    if (user.phone)   setAddress(p => ({ ...p, phone: user.phone }))

    setSelectedDate(days[0])
    localStorage.setItem('orderMode', 'DELIVERY')
  }, [])

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate) return
    currentDateRef.current = selectedDate
    fetchSlots(selectedDate, false)
    clearInterval(refreshTimer.current)
    refreshTimer.current = setInterval(() => {
      if (currentDateRef.current) silentRefresh(currentDateRef.current)
    }, 30000)
    return () => clearInterval(refreshTimer.current)
  }, [selectedDate])

  const fetchSlots = async (date, silent = false) => {
    if (!silent) { setLoading(true); setSlotError(null); setSelectedSlot(null) }
    try {
      const dateStr = toMoroccoDateStr(date) // date en heure Maroc
      const { data } = await api.get('/time-slots/available', { params: { date: dateStr } })
      const mapped = data.map(s => ({
        id:           `${dateStr}-${s.time}`,
        time:         s.time,
        endTime:      s.endTime,
        available:    s.available,
        remaining:    s.capacity - s.reservations,
        reservations: s.reservations,
        capacity:     s.capacity,
        status:       !s.available ? 'full'
                      : s.reservations / s.capacity >= 0.8 ? 'almost-full'
                      : 'available'
      }))
      setTimeSlots(mapped)
      setLastRefresh(new Date())
      if (selectedSlot) {
        const upd = mapped.find(s => s.id === selectedSlot.id)
        if (upd && !upd.available) setSelectedSlot(null)
      }
    } catch {
      if (!silent) setSlotError('Impossible de charger les créneaux.')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const silentRefresh = async (date) => {
    setRefreshing(true)
    await fetchSlots(date, true)
    setRefreshing(false)
  }

  const validateAddress = () => {
    const e = {}
    if (!address.street.trim())  e.street = 'Numéro et rue requis'
    if (!address.city.trim())    e.city   = 'Ville requise'
    if (!address.phone.trim())   e.phone  = 'Téléphone requis'
    else if (!/^[0-9+\s\-]{8,}$/.test(address.phone.trim())) e.phone = 'Numéro invalide'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleConfirm = () => {
    if (!validateAddress()) return
    if (!selectedDate || !selectedSlot) {
      alert('Veuillez sélectionner un créneau de livraison.')
      return
    }
    setConfirming(true)
    const full = [address.street, address.district, address.city].filter(Boolean).join(', ')
    localStorage.setItem('deliveryAddress', full)
    localStorage.setItem('deliveryPhone', address.phone)
    localStorage.setItem('deliveryInstructions', address.instructions)
    localStorage.setItem('selectedTimeSlot', JSON.stringify({
      date: selectedDate.toISOString(),
      slot: selectedSlot
    }))
    setTimeout(() => navigate('/checkout/confirmation'), 800)
  }

  const availableCount = timeSlots.filter(s => s.available).length
  const subtotal = getTotalPrice()

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontSize: '1.08rem' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Back */}
        <button onClick={() => navigate('/checkout')}
          className="flex items-center gap-2 text-sky-700 font-semibold mb-7 hover:text-sky-900 text-base">
          <ArrowLeft size={20} /> Retour
        </button>

        {/* Page title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-sky-700 rounded-xl">
            <Truck size={26} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Livraison à domicile</h1>
            <p className="text-gray-500 text-sm">Remplissez votre adresse et choisissez un créneau</p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── LEFT: Address form ── */}
          <div className="space-y-5">

            <div className="bg-white rounded-2xl shadow-sm p-7">
              <div className="flex items-center gap-2 mb-6">
                <MapPin size={20} className="text-sky-700" />
                <h2 className="text-lg font-bold text-gray-900">Adresse de livraison</h2>
              </div>

              <div className="space-y-5">
                {/* Street */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Numéro et rue <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={address.street}
                    onChange={e => { setAddress(p => ({ ...p, street: e.target.value })); setErrors(p => ({ ...p, street: '' })) }}
                    placeholder="Ex : 12, Rue Mohammed V"
                    className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 ${errors.street ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  />
                  {errors.street && <p className="text-xs text-red-500 mt-1">{errors.street}</p>}
                </div>

                {/* District + City */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quartier</label>
                    <input type="text" value={address.district}
                      onChange={e => setAddress(p => ({ ...p, district: e.target.value }))}
                      placeholder="Ex : Hay Riad"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Ville <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={address.city}
                      onChange={e => { setAddress(p => ({ ...p, city: e.target.value })); setErrors(p => ({ ...p, city: '' })) }}
                      placeholder="Ex : Casablanca"
                      className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 ${errors.city ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    />
                    {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><Phone size={14} /> Téléphone <span className="text-red-500">*</span></span>
                  </label>
                  <input type="tel" value={address.phone}
                    onChange={e => { setAddress(p => ({ ...p, phone: e.target.value })); setErrors(p => ({ ...p, phone: '' })) }}
                    placeholder="Ex : 06 12 34 56 78"
                    className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 ${errors.phone ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  />
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><Info size={14} /> Instructions (optionnel)</span>
                  </label>
                  <input type="text" value={address.instructions}
                    onChange={e => setAddress(p => ({ ...p, instructions: e.target.value }))}
                    placeholder="Code d'entrée, étage, interphone..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>
            </div>

            {/* Delivery info */}
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Truck size={20} className="text-sky-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sky-900 mb-2">Informations de livraison</p>
                  <div className="space-y-1.5">
                    <p className="text-sm text-sky-700 flex items-center gap-2">
                      <Clock size={13} /> Délai estimé : <strong>24h – 48h</strong>
                    </p>
                    <p className="text-sm text-sky-700 flex items-center gap-2">
                      <Package size={13} /> Frais : <strong>{DELIVERY_FEE} DH</strong>
                    </p>
                    <p className="text-sm text-sky-700">Paiement en espèces à la réception</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order summary */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-3">Récapitulatif</h3>
              <div className="space-y-1.5 mb-3 max-h-36 overflow-y-auto">
                {cartItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    {item.image && <img src={item.image} alt={item.name} className="w-9 h-9 object-cover rounded-lg" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">×{item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold">{(item.price * item.quantity).toFixed(2)} DH</p>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Sous-total</span><span>{subtotal.toFixed(2)} DH</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Livraison</span><span className="text-sky-600 font-medium">+{DELIVERY_FEE} DH</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 border-t pt-2">
                  <span>Total</span>
                  <span className="text-sky-700">{(subtotal + DELIVERY_FEE).toFixed(2)} DH</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Calendar + Slots ── */}
          <div className="space-y-5">

            {/* Calendar */}
            <div className="bg-white rounded-2xl shadow-sm p-7">
              <div className="flex items-center gap-2 mb-5">
                <Calendar size={20} className="text-sky-700" />
                <h2 className="text-lg font-bold text-gray-900">Choisissez une date</h2>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {days.map((d, i) => {
                  const isSel   = selectedDate?.toDateString() === d.toDateString()
                  const isToday = i === 0
                  return (
                    <button key={i} onClick={() => setSelectedDate(d)}
                      className={`flex-shrink-0 flex flex-col items-center px-3.5 py-3 rounded-2xl border-2 transition-all min-w-[62px] ${
                        isSel
                          ? 'border-sky-700 bg-sky-700 text-white shadow-md'
                          : 'border-gray-200 hover:border-sky-400 hover:bg-sky-50 text-gray-700'
                      }`}>
                      <span className={`text-[11px] font-bold uppercase ${isSel ? 'text-sky-100' : 'text-gray-400'}`}>
                        {DAY_LABELS[d.getDay()]}
                      </span>
                      <span className="text-xl font-bold leading-tight mt-0.5">{d.getDate()}</span>
                      <span className={`text-[11px] ${isSel ? 'text-sky-100' : 'text-gray-400'}`}>
                        {MONTH_LABELS[d.getMonth()]}
                      </span>
                      {isToday && (
                        <span className={`text-[10px] font-bold mt-0.5 ${isSel ? 'text-white' : 'text-sky-600'}`}>
                          Auj.
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Slots */}
            <div className="bg-white rounded-2xl shadow-sm p-7">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock size={20} className="text-sky-700" />
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Créneaux disponibles</h2>
                    {selectedDate && (
                      <p className="text-sm text-gray-500">
                        {DAY_FULL[selectedDate.getDay()]} {selectedDate.getDate()} {MONTH_LABELS[selectedDate.getMonth()]}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!loading && timeSlots.length > 0 && (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                      {availableCount} dispo
                    </span>
                  )}
                  <button onClick={() => selectedDate && silentRefresh(selectedDate)}
                    disabled={loading || refreshing}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-40">
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {lastRefresh && !loading && (
                <p className="text-[11px] text-gray-400 mb-4">
                  Actualisé à {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · auto 30s
                </p>
              )}

              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 size={28} className="animate-spin text-sky-700" />
                  <span className="ml-2 text-gray-500">Chargement...</span>
                </div>
              ) : slotError ? (
                <div className="text-center py-10 bg-red-50 rounded-xl">
                  <p className="text-red-600">{slotError}</p>
                  <button onClick={() => fetchSlots(selectedDate)}
                    className="mt-3 px-4 py-2 bg-sky-700 text-white rounded-lg text-sm">Réessayer</button>
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <Clock size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="font-medium text-gray-500">Aucun créneau disponible ce jour</p>
                  <p className="text-sm text-gray-400 mt-1">Choisissez une autre date.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {timeSlots.map(slot => {
                      const isSel    = selectedSlot?.id === slot.id
                      const isFull   = slot.status === 'full'
                      const isAlmost = slot.status === 'almost-full'

                      let border = 'border-gray-200 bg-white hover:border-sky-400 hover:shadow-sm cursor-pointer'
                      if (isFull)   border = 'border-red-100 bg-red-50 opacity-60 cursor-not-allowed'
                      if (isAlmost) border = 'border-orange-200 bg-orange-50 hover:border-orange-400 cursor-pointer'
                      if (isSel)    border = 'border-sky-700 bg-sky-50 shadow-md ring-2 ring-sky-200 cursor-pointer'

                      const placeColor = isFull ? 'text-red-500' : isAlmost ? 'text-orange-500' : 'text-green-600'

                      return (
                        <button key={slot.id}
                          onClick={() => slot.available && setSelectedSlot(slot)}
                          disabled={!slot.available}
                          className={`p-4 rounded-2xl border-2 transition-all text-left ${border}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className={`text-lg font-bold ${isSel ? 'text-sky-700' : 'text-gray-900'}`}>
                                {slot.time}
                              </span>
                              <span className="text-sm text-gray-400 ml-1.5">→ {slot.endTime}</span>
                            </div>
                            {isSel && <CheckCircle size={18} className="text-sky-600" />}
                          </div>
                          <OccupancyBar reservations={slot.reservations} capacity={slot.capacity} />
                          <div className={`flex items-center gap-1.5 mt-2 text-sm font-semibold ${placeColor}`}>
                            <Users size={13} />
                            {isFull
                              ? 'Complet'
                              : `${slot.remaining} place${slot.remaining > 1 ? 's' : ''} restante${slot.remaining > 1 ? 's' : ''}`
                            }
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {slot.reservations}/{slot.capacity} réservé{slot.reservations > 1 ? 's' : ''}
                          </p>
                        </button>
                      )
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-gray-100">
                    {[
                      { color: 'bg-green-500', label: 'Disponible' },
                      { color: 'bg-orange-400', label: 'Presque complet' },
                      { color: 'bg-red-500',   label: 'Complet' }
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${l.color}`} />
                        <span className="text-sm text-gray-500">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Selected recap + Confirm */}
            {selectedSlot && (
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5">
                <p className="text-sm font-semibold text-sky-700 mb-2">Créneau sélectionné</p>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-sky-600" />
                  <p className="font-bold text-sky-900">
                    {selectedSlot.time} – {selectedSlot.endTime}
                    {selectedDate && (
                      <span className="font-normal text-sky-700 ml-2 text-sm">
                        · {DAY_FULL[selectedDate.getDay()]} {selectedDate.getDate()} {MONTH_LABELS[selectedDate.getMonth()]}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={!selectedDate || !selectedSlot || confirming}
              className={`w-full py-4 font-bold rounded-2xl text-lg transition-all flex items-center justify-center gap-3 shadow-lg ${
                confirming
                  ? 'bg-green-500 text-white scale-105'
                  : !selectedDate || !selectedSlot
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-sky-700 hover:bg-sky-800 text-white'
              }`}>
              {confirming
                ? <><CheckCircle size={22} className="animate-bounce" /> Livraison confirmée !</>
                : <><Truck size={22} /> Confirmer la livraison</>
              }
            </button>

            {(!selectedDate || !selectedSlot) && (
              <p className="text-sm text-center text-gray-400">
                Sélectionnez une date et un créneau pour confirmer
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeliveryPage
