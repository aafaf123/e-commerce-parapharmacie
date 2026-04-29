import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Settings,
  Percent,
  Truck,
  Package,
  MapPin,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react'

import api from '../api/axios'
import adminApi from '../api/adminAxios'

const TabButton = ({ active, icon: Icon, children, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
      active ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
    }`}
  >
    <Icon size={16} />
    {children}
  </button>
)

const numberOr = (v, fallback) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const AdminSettings = () => {
  const { i18n } = useTranslation()
  const isAr = i18n.language?.startsWith('ar')
  const navigate = useNavigate()
  const [tab, setTab] = useState('general')
  const [loading, setLoading] = useState(true)

  // GENERAL
  const [tvaPercent, setTvaPercent] = useState(20)
  const [freeThreshold, setFreeThreshold] = useState(300)
  const [savingGeneral, setSavingGeneral] = useState(false)

  // VARIANTS
  const [variantTypes, setVariantTypes] = useState([])
  const [newType, setNewType] = useState({ name: '', label: '' })
  const [valueDraft, setValueDraft] = useState({}) // { [typeId]: value }

  // DELIVERY (zones + daily capacity)
  const [cities, setCities] = useState([])
  const [newCityName, setNewCityName] = useState('')
  const [expandedCity, setExpandedCity] = useState(null)
  const [newDistrictName, setNewDistrictName] = useState({})
  const [deliveryDayConfigs, setDeliveryDayConfigs] = useState([])

  const deliveryConfigMap = useMemo(() => {
    const m = new Map()
    for (const cfg of deliveryDayConfigs) m.set(cfg.dayOfWeek, cfg)
    return m
  }, [deliveryDayConfigs])

  const fetchGeneral = async () => {
    const { data } = await api.get('/settings')
    if (data?.TVA_RATE !== undefined) setTvaPercent(numberOr(data.TVA_RATE, 0) * 100)
    if (data?.FREE_SHIPPING_THRESHOLD !== undefined) setFreeThreshold(numberOr(data.FREE_SHIPPING_THRESHOLD, 0))
  }

  const saveGeneral = async () => {
    setSavingGeneral(true)
    try {
      await api.put('/settings/TVA_RATE', { value: Number(tvaPercent) / 100 })
      await api.put('/settings/FREE_SHIPPING_THRESHOLD', { value: Number(freeThreshold) })
    } finally {
      setSavingGeneral(false)
    }
  }

  const fetchVariants = async () => {
    const { data } = await adminApi.get('/variant-types')
    const enriched = await Promise.all(
      (data || []).map(async (vt) => {
        const vals = await adminApi.get(`/variant-types/${vt.id}/values`)
        return { ...vt, values: vals.data || [] }
      })
    )
    setVariantTypes(enriched)
  }

  const createVariantType = async () => {
    const name = newType.name.trim()
    const label = newType.label.trim()
    if (!name || !label) return
    await adminApi.post('/variant-types', { name, label, active: true })
    setNewType({ name: '', label: '' })
    await fetchVariants()
  }

  const toggleVariantType = async (type) => {
    await adminApi.put(`/variant-types/${type.id}`, { active: !type.active })
    await fetchVariants()
  }

  const deleteVariantType = async (type) => {
    if (!window.confirm(isAr ? `حذف النوع "${type.label}" وقيمه؟` : `Supprimer le type "${type.label}" et ses valeurs ?`)) return
    await adminApi.delete(`/variant-types/${type.id}`)
    await fetchVariants()
  }

  const createVariantValue = async (typeId) => {
    const raw = (valueDraft[typeId] || '').trim()
    if (!raw) return
    await adminApi.post(`/variant-types/${typeId}/values`, { value: raw, active: true })
    setValueDraft((p) => ({ ...p, [typeId]: '' }))
    await fetchVariants()
  }

  const deleteVariantValue = async (valueId) => {
    if (!window.confirm(isAr ? 'حذف هذه القيمة؟' : 'Supprimer cette valeur ?')) return
    await adminApi.delete(`/variant-types/values/${valueId}`)
    await fetchVariants()
  }

  const fetchDelivery = async () => {
    const [citiesRes, cfgRes] = await Promise.all([
      adminApi.get('/delivery-zones/cities?all=true'),
      adminApi.get('/delivery/config'),
    ])
    setCities(citiesRes.data || [])
    setDeliveryDayConfigs(cfgRes.data || [])
  }

  const createCity = async () => {
    const name = newCityName.trim()
    if (!name) return
    await adminApi.post('/delivery-zones/cities', { name, active: true, order: 0 })
    setNewCityName('')
    await fetchDelivery()
  }

  const disableCity = async (id) => {
    await adminApi.delete(`/delivery-zones/cities/${id}`)
    await fetchDelivery()
  }

  const createDistrict = async (cityId) => {
    const name = (newDistrictName[cityId] || '').trim()
    if (!name) return
    await adminApi.post(`/delivery-zones/cities/${cityId}/districts`, { name, active: true })
    setNewDistrictName(p => ({ ...p, [cityId]: '' }))
    await fetchDelivery()
  }

  const disableDistrict = async (id) => {
    await adminApi.delete(`/delivery-zones/districts/${id}`)
    await fetchDelivery()
  }

  const upsertDeliveryDay = async (dayOfWeek, patch) => {
    await adminApi.put(`/delivery/config/${dayOfWeek}`, {
      capacity: patch.capacity,
      active: patch.active,
      startTime: patch.startTime,
      endTime: patch.endTime,
    })
    const { data } = await adminApi.get('/delivery/config')
    setDeliveryDayConfigs(data || [])
  }

  const refreshAll = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchGeneral(), fetchVariants(), fetchDelivery()])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAll().catch(console.error)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sky-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{isAr ? 'جاري التحميل...' : 'Chargement...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
              title={isAr ? 'العودة إلى لوحة التحكم' : 'Retour au Tableau de Bord'}
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-semibold hidden lg:inline">{isAr ? 'لوحة التحكم' : 'Dashboard'}</span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <div className="p-2 bg-sky-700 rounded-lg">
              <Settings size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{isAr ? 'الإعدادات' : 'Réglages'}</h1>
              <p className="text-sm text-gray-500">{isAr ? 'الضريبة، التوصيل المجاني، الأنواع، المدن/الأحياء، سعة التوصيل' : 'TVA, livraison gratuite, variantes, villes/quartiers, capacité livraison'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => refreshAll().catch(console.error)}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg flex items-center gap-2"
            >
              <RefreshCw size={16} />
              {isAr ? 'تحديث' : 'Actualiser'}
            </button>
             </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              <TabButton active={tab === 'general'} icon={Percent} onClick={() => setTab('general')}>
                {isAr ? 'عام' : 'Général'}
              </TabButton>
              <TabButton active={tab === 'variants'} icon={Package} onClick={() => setTab('variants')}>
                {isAr ? 'الأنواع' : 'Variantes'}
              </TabButton>
              <TabButton active={tab === 'delivery'} icon={Truck} onClick={() => setTab('delivery')}>
                {isAr ? 'التوصيل' : 'Livraison'}
              </TabButton>
            </div>
          </div>
        </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {tab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-1">TVA</h2>
              <p className="text-sm text-gray-500 mb-4">{isAr ? 'النسبة العامة المستعملة لأسعار HT/TTC.' : 'Taux global utilisé pour les prix HT/TTC.'}</p>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{isAr ? 'نسبة الضريبة (%)' : 'Taux TVA (%)'}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={tvaPercent}
                onChange={(e) => setTvaPercent(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-1">{isAr ? 'التوصيل المجاني' : 'Livraison gratuite'}</h2>
              <p className="text-sm text-gray-500 mb-4">{isAr ? 'العتبة بالدرهم التي يصبح بعدها التوصيل مجانياً.' : 'Seuil en DH à partir duquel la livraison est gratuite.'}</p>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{isAr ? 'العتبة (DH)' : 'Seuil (DH)'}</label>
              <input
                type="number"
                min={0}
                value={freeThreshold}
                onChange={(e) => setFreeThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="lg:col-span-2">
              <button
                onClick={() => saveGeneral().then(() => alert(isAr ? 'تم حفظ الإعدادات' : 'Paramètres enregistrés')).catch(() => alert(isAr ? 'خطأ في الحفظ' : 'Erreur sauvegarde'))}
                disabled={savingGeneral}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={18} />
                {savingGeneral ? (isAr ? 'جاري الحفظ...' : 'Enregistrement...') : (isAr ? 'حفظ' : 'Enregistrer')}
              </button>
            </div>
          </div>
        )}

        {tab === 'variants' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-1">{isAr ? 'أنواع المتغيرات' : 'Types de variantes'}</h2>
              <p className="text-sm text-gray-500 mb-4">{isAr ? 'أضف أنواعاً (مثال: الحجم، SPF) وقيمها. كل شيء ديناميكي.' : 'Ajoute des types (ex: volume, SPF) et leurs valeurs. Tout est dynamique.'}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  value={newType.name}
                  onChange={(e) => setNewType((p) => ({ ...p, name: e.target.value }))}
                  placeholder={isAr ? 'اسم تقني (مثال: volume)' : 'Nom technique (ex: volume)'}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  value={newType.label}
                  onChange={(e) => setNewType((p) => ({ ...p, label: e.target.value }))}
                  placeholder={isAr ? 'تسمية (مثال: الحجم)' : 'Label (ex: Volume)'}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={() => createVariantType().catch(() => alert(isAr ? 'خطأ إنشاء النوع' : 'Erreur création type'))}
                  className="px-3 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg inline-flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  {isAr ? 'أضف' : 'Ajouter'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {variantTypes.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{t.label}</p>
                      <p className="text-xs text-gray-500">{isAr ? 'الاسم:' : 'Nom:'} {t.name}</p>
                      <p className={`text-xs mt-1 ${t.active ? 'text-green-700' : 'text-gray-400'}`}>
                        {t.active ? (isAr ? 'نشط' : 'Actif') : (isAr ? 'غير نشط' : 'Inactif')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleVariantType(t).catch(() => alert(isAr ? 'خطأ' : 'Erreur'))}
                        className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg"
                      >
                        {t.active ? (isAr ? 'تعطيل' : 'Désactiver') : (isAr ? 'تفعيل' : 'Activer')}
                      </button>
                      <button
                        onClick={() => deleteVariantType(t).catch(() => alert(isAr ? 'خطأ حذف النوع' : 'Erreur suppression'))}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title={isAr ? 'حذف' : 'Supprimer'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      value={valueDraft[t.id] || ''}
                      onChange={(e) => setValueDraft((p) => ({ ...p, [t.id]: e.target.value }))}
                      placeholder={isAr ? 'أضف قيمة (مثال: 50مل)' : 'Ajouter une valeur (ex: 50ml)'}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={() => createVariantValue(t.id).catch(() => alert(isAr ? 'خطأ إنشاء القيمة' : 'Erreur création valeur'))}
                      className="px-3 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(t.values || []).map((v) => (
                      <span key={v.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-gray-50">
                        <span className="text-sm">{v.value}</span>
                        <button
                          onClick={() => deleteVariantValue(v.id).catch(() => alert(isAr ? 'خطأ حذف القيمة' : 'Erreur suppression'))}
                          className="text-red-600 hover:text-red-800"
                          title={isAr ? 'حذف' : 'Supprimer'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    ))}
                    {(t.values || []).length === 0 && <p className="text-sm text-gray-500">{isAr ? 'لا توجد قيم.' : 'Aucune valeur.'}</p>}
                  </div>
                </div>
              ))}
              {variantTypes.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 text-center text-gray-500">
                  {isAr ? 'لا يوجد أي نوع متغير.' : 'Aucun type de variante.'}
                </div>
              )}
            </div>

            <div className="text-sm text-gray-500">
              {isAr ? 'إدارة الأنواع مدمجة هنا مباشرة.' : 'Gestion des variantes intégrée directement ici.'}
            </div>
          </div>
        )}

        {tab === 'delivery' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={18} className="text-sky-700" />
                <h2 className="font-bold text-gray-900">{isAr ? 'مدن التوصيل' : 'Villes de livraison'}</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">{isAr ? 'أدر المدن التي يتوفر فيها التوصيل.' : 'Gérez les villes où la livraison est disponible.'}</p>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    value={newCityName}
                    onChange={(e) => setNewCityName(e.target.value)}
                    placeholder={isAr ? 'أضف مدينة' : 'Ajouter une ville'}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button onClick={() => createCity().catch(() => alert(isAr ? 'خطأ في إنشاء المدينة' : 'Erreur création ville'))} className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg inline-flex items-center gap-2">
                    <Plus size={18} />
                    {isAr ? 'إضافة' : 'Ajouter'}
                  </button>
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {cities.map((c) => (
                    <div key={c.id} className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="flex items-center justify-between gap-2 p-4 hover:bg-sky-50 transition-colors cursor-pointer"
                        onClick={() => setExpandedCity(expandedCity === c.id ? null : c.id)}>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-500">
                            {(c.districts || []).filter(d => d.active).length} {isAr ? 'حي(أحياء)' : 'quartier(s)'} · {c.active ? <span className="text-green-700">{isAr ? 'نشطة' : 'Active'}</span> : <span className="text-gray-400">{isAr ? 'معطلة' : 'Désactivée'}</span>}
                          </p>
                        </div>
                        {c.active && (
                          <button onClick={(e) => { e.stopPropagation(); disableCity(c.id).catch(() => alert(isAr ? 'خطأ' : 'Erreur')) }}
                            className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors" title={isAr ? 'تعطيل' : 'Désactiver'}>
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      {expandedCity === c.id && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{isAr ? 'الأحياء' : 'Quartiers'}</p>
                          <div className="flex gap-2">
                            <input
                              value={newDistrictName[c.id] || ''}
                              onChange={(e) => setNewDistrictName(p => ({ ...p, [c.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && createDistrict(c.id).catch(() => alert(isAr ? 'خطأ' : 'Erreur'))}
                              placeholder={isAr ? 'أضف حياً' : 'Ajouter un quartier'}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                            <button onClick={() => createDistrict(c.id).catch(() => alert(isAr ? 'خطأ' : 'Erreur'))}
                              className="px-3 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg">
                              <Plus size={16} />
                            </button>
                          </div>
                          <div className="space-y-1">
                            {(c.districts || []).filter(d => d.active).map(d => (
                              <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-200">
                                <span className="text-sm text-gray-800">{d.name}</span>
                                <button onClick={() => disableDistrict(d.id).catch(() => alert(isAr ? 'خطأ' : 'Erreur'))}
                                  className="p-1 hover:bg-red-100 text-red-500 rounded transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            {(c.districts || []).filter(d => d.active).length === 0 && (
                              <p className="text-xs text-gray-400 text-center py-2">{isAr ? 'لا يوجد أي حي. أضف واحداً.' : 'Aucun quartier. Ajoutez-en un.'}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {cities.length === 0 && <p className="text-sm text-gray-500 text-center py-6">{isAr ? 'لا توجد مدن مهيأة. أضف مدينة للبدء.' : 'Aucune ville configurée. Ajouter une ville pour commencer.'}</p>}
                </div>
              </div>
            </div>

             <div className="text-sm text-gray-500">
               {isAr ? 'إدارة مناطق التوصيل مدمجة هنا مباشرة.' : 'Gestion des zones de livraison intégrée directement ici.'}
               <br />
               {isAr ? 'المواعيد الزمنية تُدار في وحدة ' : 'Les créneaux horaires sont gérés dans le module '}<a href="/admin/time-slots" className="text-sky-700 hover:underline">Click & Collect</a>.
             </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminSettings

