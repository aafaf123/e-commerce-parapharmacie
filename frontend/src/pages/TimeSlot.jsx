import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCart } from '../stores'
import { useAuth } from '../stores'
import {
  ArrowLeft, Calendar, Clock, CheckCircle, Loader2,
  RefreshCw, Users, Truck, Store, MapPin, Phone, Info
} from 'lucide-react'
import api from '../api/axios'

const DAY_LABELS  = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const DAY_FULL    = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

// Date en heure Maroc (UTC+1) pour éviter le décalage UTC
const toMoroccoDateStr = (date) => {
  const moroccoMs = date.getTime() + 60 * 60 * 1000
  return new Date(moroccoMs).toISOString().slice(0, 10)
}

// Check if a date is Sunday (dimanche)
const isSunday = (date) => date.getDay() === 0

// Get the first non-Sunday day from the days array
const getFirstAvailableDay = (days) => {
  for (const d of days) {
    if (!isSunday(d)) return d
  }
  return days[0]
}

// Compact occupancy bar
const OccupancyBar = ({ reservations, capacity }) => {
  const pct = capacity > 0 ? Math.min(100, Math.round((reservations / capacity) * 100)) : 100
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-green-500'
  return (
    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

const TimeSlot = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isDelivery = searchParams.get('mode') === 'delivery'
  const { cartItems } = useCart()
  const { isAdmin } = useAuth()

  const [days, setDays] = useState([])
  const [selectedDate,  setSelectedDate]  = useState(null)
  const [selectedSlot,  setSelectedSlot]  = useState(null)
  const [timeSlots,     setTimeSlots]     = useState([])
  const [loading,       setLoading]       = useState(false)
  const [refreshing,    setRefreshing]    = useState(false)
  const [error,         setError]         = useState(null)
  const [lastRefresh,   setLastRefresh]   = useState(null)
  const [confirming,    setConfirming]    = useState(false)

  // Initialize and refresh days each week
  useEffect(() => {
    const initDays = () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const newDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        return d
      })
      setDays(newDays)
      
      if (!selectedDate) {
        const firstAvailable = newDays.find(d => !isSunday(d))
        if (firstAvailable) setSelectedDate(firstAvailable)
      }
    }
    initDays()
    
    const midnightTimer = setInterval(() => {
      const now = new Date()
      const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
      setTimeout(initDays, msUntilMidnight)
    }, 86400000)
    
    return () => clearInterval(midnightTimer)
  }, [])

  // Delivery info from localStorage
  const deliveryAddress      = localStorage.getItem('deliveryAddress') || ''
  const deliveryPhone        = localStorage.getItem('deliveryPhone') || ''
  const deliveryInstructions = localStorage.getItem('deliveryInstructions') || ''

  const refreshTimer   = useRef(null)
  const currentDateRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/login'); return }
    if (cartItems.length === 0) { navigate('/cart'); return }
    // Auto-select the first non-Sunday day
    const firstAvailableDay = getFirstAvailableDay(days)
    setSelectedDate(firstAvailableDay)
    localStorage.setItem('orderMode', isDelivery ? 'DELIVERY' : 'CLICK_COLLECT')
  }, [])

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
    if (!silent) { setLoading(true); setError(null); setSelectedSlot(null) }
    try {
      const dateStr = toMoroccoDateStr(date) // date en heure Maroc (UTC+1)
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
      if (!silent) setError('Impossible de charger les créneaux.')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const silentRefresh = async (date) => {
    setRefreshing(true)
    await fetchSlots(date, true)
    setRefreshing(false)
  }

  const handleConfirm = () => {
    if (!selectedDate || !selectedSlot) return
    setConfirming(true)
    setTimeout(() => {
      // Store date as YYYY-MM-DD to avoid timezone issues
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
      localStorage.setItem('selectedTimeSlot', JSON.stringify({
        date: dateStr,  // Store as "2026-04-07" not ISO string
        slot: selectedSlot
      }))
      navigate('/checkout/confirmation')
    }, 800)
  }

  const availableCount = timeSlots.filter(s => s.available).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/checkout')}
          className="flex items-center gap-2 text-sky-700 font-semibold mb-6 hover:text-sky-800">
          <ArrowLeft size={20} /> Retour
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main: calendar + slots */}
          <div className="lg:col-span-2 space-y-5">

            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-1">
                {isDelivery ? <Truck size={22} className="text-sky-700" /> : <Store size={22} className="text-sky-700" />}
                <h1 className="text-xl font-bold text-gray-900">
                  {isDelivery ? '📦 Mode de livraison : À domicile' : '📦 Mode de retrait : Click & Collect'}
                </h1>
              </div>
              <p className="text-sm text-gray-500 ml-9">
                {isDelivery
                  ? 'Choisissez votre créneau de livraison.'
                  : 'Choisissez votre créneau de retrait :'}
              </p>
            </div>

            {/* Calendar strip */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Sélectionnez une date</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {days.map((d, i) => {
                  const isSun   = isSunday(d)
                  const isSel   = selectedDate?.toDateString() === d.toDateString()
                  const isToday = i === 0
                  return (
                    <button key={i} onClick={() => !isSun && setSelectedDate(d)}
                      disabled={isSun}
                      className={`flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-xl border-2 transition-all min-w-[58px] ${
                        isSun
                          ? 'border-gray-100 bg-gray-100 text-gray-300 cursor-not-allowed opacity-50'
                          : isSel
                            ? 'border-sky-700 bg-sky-700 text-white shadow-md'
                            : 'border-gray-200 hover:border-sky-300 hover:bg-sky-50 text-gray-700'
                      }`}>
                      <span className={`text-[10px] font-semibold uppercase ${isSun ? 'text-gray-300' : isSel ? 'text-sky-100' : 'text-gray-400'}`}>
                        {DAY_LABELS[d.getDay()]}
                      </span>
                      <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                      <span className={`text-[10px] ${isSun ? 'text-gray-300' : isSel ? 'text-sky-100' : 'text-gray-400'}`}>
                        {MONTH_LABELS[d.getMonth()]}
                      </span>
                      {isToday && !isSun && (
                        <span className={`text-[9px] font-bold mt-0.5 ${isSel ? 'text-white' : 'text-sky-600'}`}>
                          Auj.
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                * Nous sommes fermés le dimanche
              </p>
            </div>

            {/* Time slots */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              {/* Slot header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Créneaux disponibles</p>
                  {selectedDate && (
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {DAY_FULL[selectedDate.getDay()]} {selectedDate.getDate()} {MONTH_LABELS[selectedDate.getMonth()]}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!loading && timeSlots.length > 0 && (
                    <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                      {availableCount} dispo
                    </span>
                  )}
                  <button onClick={() => selectedDate && silentRefresh(selectedDate)}
                    disabled={loading || refreshing}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-40">
                    <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {lastRefresh && !loading && (
                <p className="text-[10px] text-gray-400 mb-3">
                  Actualisé à {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · auto 30s
                </p>
              )}

              {loading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 size={24} className="animate-spin text-sky-700" />
                  <span className="ml-2 text-sm text-gray-500">Chargement...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8 bg-red-50 rounded-xl">
                  <p className="text-sm text-red-600">{error}</p>
                  <button onClick={() => fetchSlots(selectedDate)}
                    className="mt-3 px-4 py-2 bg-sky-700 text-white text-sm rounded-lg">Réessayer</button>
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl">
                  <Clock size={36} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-500">Aucun créneau disponible</p>
                  <p className="text-xs text-gray-400 mt-1">Ce jour est fermé. Choisissez une autre date.</p>
                </div>
              ) : (
                <>
                  {/* Slot grid — 2 columns for detailed view */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {timeSlots.map(slot => {
                      const isSel       = selectedSlot?.id === slot.id
                      const isFull      = slot.status === 'full'
                      const isAlmost    = slot.status === 'almost-full'

                      let border = 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-sm'
                      let timeColor = 'text-gray-900'
                      if (isFull)   border = 'border-red-100 bg-red-50 opacity-60 cursor-not-allowed'
                      if (isAlmost) border = 'border-orange-200 bg-orange-50 hover:border-orange-400'
                      if (isSel)    { border = 'border-sky-700 bg-sky-50 shadow-md'; timeColor = 'text-sky-700' }

                      const placeColor = isFull ? 'text-red-500' : isAlmost ? 'text-orange-500' : 'text-green-600'

                      return (
                        <button key={slot.id}
                          onClick={() => slot.available && setSelectedSlot(slot)}
                          disabled={!slot.available}
                          className={`p-3 rounded-xl border-2 transition-all text-left ${border}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <span className={`text-base font-bold ${timeColor}`}>{slot.time}</span>
                              <span className="text-xs text-gray-400 ml-1">→ {slot.endTime}</span>
                            </div>
                            {isAdmin && (
                              <div className={`flex items-center gap-1 text-xs font-semibold ${placeColor}`}>
                                <Users size={11} />
                                {isFull ? 'Complet' : `${slot.remaining} place${slot.remaining > 1 ? 's' : ''}`}
                              </div>
                            )}
                            {!isAdmin && !isFull && (
                              <div className={`flex items-center gap-1 text-xs font-semibold ${placeColor}`}>
                                <Users size={11} />
                                Disponible
                              </div>
                            )}
                          </div>
                          <OccupancyBar reservations={slot.reservations} capacity={slot.capacity} />
                          {isAdmin && (
                            <p className="text-[10px] text-gray-400 mt-1">
                              {slot.reservations}/{slot.capacity} réservé{slot.reservations > 1 ? 's' : ''}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
                    {[
                      { color: 'bg-green-500', label: 'Disponible' },
                      { color: 'bg-orange-400', label: 'Presque complet' },
                      { color: 'bg-red-500', label: 'Complet' }
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                        <span className="text-xs text-gray-500">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: summary + confirm */}
          <div className="lg:col-span-1 space-y-4">

            {/* Selected slot recap */}
            {selectedSlot && (
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-sky-700 uppercase mb-2">Créneau sélectionné</p>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-sky-600" />
                  <div>
                    <p className="text-sm font-bold text-sky-900">
                      {selectedSlot.time} – {selectedSlot.endTime}
                    </p>
                    {selectedDate && (
                      <p className="text-xs text-sky-700">
                        {DAY_FULL[selectedDate.getDay()]} {selectedDate.getDate()} {MONTH_LABELS[selectedDate.getMonth()]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Delivery address recap */}
            {isDelivery && deliveryAddress && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Adresse de livraison</p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-sky-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-800">{deliveryAddress}</p>
                  </div>
                  {deliveryPhone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-sky-600 flex-shrink-0" />
                      <p className="text-sm text-gray-800">{deliveryPhone}</p>
                    </div>
                  )}
                  {deliveryInstructions && (
                    <div className="flex items-start gap-2">
                      <Info size={14} className="text-sky-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-gray-500">{deliveryInstructions}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">ℹ️ </span>
                {isDelivery
                  ? 'Le livreur vous contactera le jour de la livraison.'
                  : 'Votre commande sera prête à l\'heure choisie. Présentez-vous à l\'accueil avec votre numéro de commande.'}
              </p>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              disabled={!selectedDate || !selectedSlot || confirming || loading}
              className={`w-full py-4 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-base shadow-lg ${
                confirming
                  ? 'bg-green-500 text-white scale-105'
                  : !selectedDate || !selectedSlot || loading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : isDelivery
                  ? 'bg-sky-700 hover:bg-sky-800 text-white'
                  : 'bg-sky-700 hover:bg-sky-800 text-white'
              }`}>
              {confirming ? (
                <><CheckCircle size={20} className="animate-bounce" /> Créneau confirmé !</>
              ) : loading ? (
                <><Loader2 size={18} className="animate-spin" /> Chargement...</>
              ) : isDelivery ? (
                <><Truck size={18} /> Confirmer la livraison</>
              ) : (
                <><Store size={18} /> Confirmer le retrait</>
              )}
            </button>

            {(!selectedDate || !selectedSlot) && !loading && (
              <p className="text-xs text-center text-gray-400">
                Sélectionnez une date et un créneau pour continuer
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default TimeSlot
