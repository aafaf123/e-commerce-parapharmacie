import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Settings, Percent, Truck, Package, MapPin, Plus, Trash2, Save, RefreshCw, ArrowLeft,
  Shield, Activity, UserPlus, Pencil, X, AlertCircle, Check, User, Key
} from 'lucide-react'
import api from '../api/axios'
import adminApi from '../api/adminAxios'

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

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
  const navigate = useNavigate()
  const [tab, setTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  const [auditLogs, setAuditLogs] = useState([])
  const [auditFilter, setAuditFilter] = useState({ action: '', userType: '' })

  // Admin profile
  const [adminProfile, setAdminProfile] = useState({ firstName: '', lastName: '', email: '', currentPassword: '', newPassword: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })

  // Employees
  const [employees, setEmployees] = useState([])
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [newEmployee, setNewEmployee] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', pin: '' })
  const [creatingEmployee, setCreatingEmployee] = useState(false)
  const [employeeMsg, setEmployeeMsg] = useState({ type: '', text: '' })
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [editEmployeeForm, setEditEmployeeForm] = useState({ firstName: '', lastName: '', phone: '', isActive: true })
  const [updatingEmployee, setUpdatingEmployee] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [permEmployee, setPermEmployee] = useState(null)
  const [modules, setModules] = useState([])
  const [permissions, setPermissions] = useState({})
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [setPinEmployee, setSetPinEmployee] = useState(null)
  const [newPin, setNewPin] = useState('')
  const [settingPin, setSettingPin] = useState(false)

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
    if (!window.confirm(`Supprimer le type "${type.label}" et ses valeurs ?`)) return
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
    if (!window.confirm('Supprimer cette valeur ?')) return
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
    const params = new URLSearchParams(location.search)
    const requested = params.get('tab')
    if (requested) setTab(requested)
    refreshAll().catch(console.error)
  }, [])

  useEffect(() => {
    if (tab === 'audit') fetchAuditLogs().catch(console.error)
    if (tab === 'roles') { fetchEmployees(); fetchAdminProfile() }
  }, [tab])

  const fetchAdminProfile = async () => {
    try {
      const { data } = await adminApi.get('/user/permissions')
      if (data.user) setAdminProfile(p => ({ ...p, firstName: data.user.firstName || '', lastName: data.user.lastName || '', email: data.user.email || '' }))
    } catch {}
  }

  const saveAdminProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg({ type: '', text: '' })
    try {
      await adminApi.put('/profile', {
        firstName: adminProfile.firstName,
        lastName: adminProfile.lastName,
        ...(adminProfile.currentPassword && adminProfile.newPassword ? { currentPassword: adminProfile.currentPassword, newPassword: adminProfile.newPassword } : {})
      })
      setProfileMsg({ type: 'success', text: 'Profil mis à jour avec succès' })
      setAdminProfile(p => ({ ...p, currentPassword: '', newPassword: '' }))
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Erreur lors de la mise à jour' })
    } finally {
      setSavingProfile(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const { data } = await adminApi.get('/employees')
      setEmployees(data || [])
    } catch {}
  }

  const createEmployee = async (e) => {
    e.preventDefault()
    setEmployeeMsg({ type: '', text: '' })
    if (!newEmployee.firstName || !newEmployee.lastName || !newEmployee.email || !newEmployee.password) {
      setEmployeeMsg({ type: 'error', text: 'Prénom, nom, email et mot de passe sont requis' })
      return
    }
    setCreatingEmployee(true)
    try {
      await adminApi.post('/employees', newEmployee)
      setEmployeeMsg({ type: 'success', text: 'Employé créé avec succès. Le code PIN a été envoyé par email.' })
      setNewEmployee({ firstName: '', lastName: '', email: '', phone: '', password: '', pin: '' })
      setShowEmployeeForm(false)
      fetchEmployees()
    } catch (err) {
      setEmployeeMsg({ type: 'error', text: err.response?.data?.message || 'Erreur création' })
    } finally {
      setCreatingEmployee(false)
    }
  }

  const updateEmployee = async (e) => {
    e.preventDefault()
    setUpdatingEmployee(true)
    try {
      await adminApi.put(`/employees/${editingEmployee.id}`, editEmployeeForm)
      setEditingEmployee(null)
      fetchEmployees()
    } catch { alert('Erreur mise à jour') }
    finally { setUpdatingEmployee(false) }
  }

  const deleteEmployee = async (id) => {
    if (!window.confirm('Désactiver cet employé ?')) return
    try { await adminApi.delete(`/employees/${id}`); fetchEmployees() }
    catch { alert('Erreur désactivation') }
  }

  const openPermissions = async (emp) => {
    setLoadingPerms(true)
    try {
      const [modRes, permRes] = await Promise.all([
        adminApi.get('/employees/permissions/modules'),
        adminApi.get(`/employees/${emp.id}/permissions`)
      ])
      setModules(modRes.data)
      setPermEmployee(emp)
      const init = {}
      modRes.data.forEach(m => {
        init[m.key] = permRes.data.permissions?.[m.key] || { canView: false, canCreate: false, canEdit: false, canDelete: false }
      })
      setPermissions(init)
      setShowPermissionsModal(true)
    } catch { alert('Erreur chargement permissions') }
    finally { setLoadingPerms(false) }
  }

  const savePermissions = async () => {
    try {
      await adminApi.put(`/employees/${permEmployee.id}/permissions`, { permissions })
      setShowPermissionsModal(false)
      setPermEmployee(null)
    } catch { alert('Erreur sauvegarde permissions') }
  }

  const handleSetPin = async (e) => {
    e.preventDefault()
    if (!newPin || newPin.length < 4) { alert('PIN doit avoir au moins 4 chiffres'); return }
    setSettingPin(true)
    try {
      await adminApi.post(`/employees/${setPinEmployee.id}/set-pin`, { pin: newPin })
      alert('Code PIN défini et envoyé par email à l\'employé')
      setSetPinEmployee(null)
      setNewPin('')
    } catch (err) { alert(err.response?.data?.message || 'Erreur') }
    finally { setSettingPin(false) }
  }

  const fetchAuditLogs = async () => {
    try {
      const { data } = await adminApi.get('/audit-logs', { params: { limit: 200 } })
      setAuditLogs(data.logs || [])
    } catch (err) {
      console.error('Erreur audit logs', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sky-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
              title="Retour au Tableau de Bord"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-semibold hidden md:inline">Dashboard</span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <div className="p-2 bg-sky-700 rounded-lg">
              <Settings size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-lg sm:text-2xl font-bold text-gray-900 truncate">Réglages</h1>
              <p className="text-sm text-gray-500">TVA, livraison gratuite, variantes, villes/quartiers, capacité livraison</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => refreshAll().catch(console.error)}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Actualiser
            </button>
             </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              <TabButton active={tab === 'general'} icon={Percent} onClick={() => setTab('general')}>
                Général
              </TabButton>
              <TabButton active={tab === 'variants'} icon={Package} onClick={() => setTab('variants')}>
                Variantes
              </TabButton>
              <TabButton active={tab === 'delivery'} icon={Truck} onClick={() => setTab('delivery')}>
                Livraison
              </TabButton>
              <TabButton active={tab === 'roles'} icon={Shield} onClick={() => setTab('roles')}>
                Rôles &amp; Employés
              </TabButton>
              <TabButton active={tab === 'audit'} icon={Activity} onClick={() => setTab('audit')}>
                Journal d'Activité
              </TabButton>
            </div>
          </div>
        </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {tab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-1">TVA</h2>
              <p className="text-sm text-gray-500 mb-4">Taux global utilisé pour les prix HT/TTC.</p>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Taux TVA (%)</label>
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
              <h2 className="font-bold text-gray-900 mb-1">Livraison gratuite</h2>
              <p className="text-sm text-gray-500 mb-4">Seuil en DH à partir duquel la livraison est gratuite.</p>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Seuil (DH)</label>
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
                onClick={() => saveGeneral().then(() => alert('Paramètres enregistrés')).catch(() => alert('Erreur sauvegarde'))}
                disabled={savingGeneral}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={18} />
                {savingGeneral ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {tab === 'variants' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-1">Types de variantes</h2>
              <p className="text-sm text-gray-500 mb-4">Ajoute des types (ex: volume, SPF) et leurs valeurs. Tout est dynamique.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <input
                  value={newType.name}
                  onChange={(e) => setNewType((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nom technique (ex: volume)"
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  value={newType.label}
                  onChange={(e) => setNewType((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Label (ex: Volume)"
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={() => createVariantType().catch(() => alert('Erreur création type'))}
                  className="px-3 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg inline-flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Ajouter
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {variantTypes.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{t.label}</p>
                      <p className="text-xs text-gray-500">Nom: {t.name}</p>
                      <p className={`text-xs mt-1 ${t.active ? 'text-green-700' : 'text-gray-400'}`}>
                        {t.active ? 'Actif' : 'Inactif'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleVariantType(t).catch(() => alert('Erreur'))}
                        className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg"
                      >
                        {t.active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={() => deleteVariantType(t).catch(() => alert('Erreur suppression'))}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      value={valueDraft[t.id] || ''}
                      onChange={(e) => setValueDraft((p) => ({ ...p, [t.id]: e.target.value }))}
                      placeholder="Ajouter une valeur (ex: 50ml)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={() => createVariantValue(t.id).catch(() => alert('Erreur création valeur'))}
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
                          onClick={() => deleteVariantValue(v.id).catch(() => alert('Erreur suppression'))}
                          className="text-red-600 hover:text-red-800"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    ))}
                    {(t.values || []).length === 0 && <p className="text-sm text-gray-500">Aucune valeur.</p>}
                  </div>
                </div>
              ))}
              {variantTypes.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 text-center text-gray-500">
                  Aucun type de variante.
                </div>
              )}
            </div>

            <div className="text-sm text-gray-500">
              Gestion des variantes intégrée directement ici.
            </div>
          </div>
        )}

        {tab === 'delivery' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={18} className="text-sky-700" />
                <h2 className="font-bold text-gray-900">Villes de livraison</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">Gérez les villes où la livraison est disponible.</p>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    value={newCityName}
                    onChange={(e) => setNewCityName(e.target.value)}
                    placeholder="Ajouter une ville"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button onClick={() => createCity().catch(() => alert('Erreur création ville'))} className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg inline-flex items-center gap-2">
                    <Plus size={18} />
                    Ajouter
                  </button>
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {cities.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 p-4 rounded-xl border border-gray-200 hover:border-sky-300 hover:bg-sky-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        <p className={`text-xs ${c.active ? 'text-green-700' : 'text-gray-400'}`}>{c.active ? 'Active' : 'Désactivée'}</p>
                      </div>
                      {c.active && (
                        <button
                          onClick={() => disableCity(c.id).catch(() => alert('Erreur'))}
                          className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          title="Désactiver et supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                  {cities.length === 0 && <p className="text-sm text-gray-500 text-center py-6">Aucune ville configurée. Ajouter une ville pour commencer.</p>}
                </div>
              </div>
            </div>

             <div className="text-sm text-gray-500">
               Gestion des zones de livraison intégrée directement ici.
               <br />
               Les créneaux horaires sont gérés dans le module <a href="/admin/time-slots" className="text-sky-700 hover:underline">Click & Collect</a>.
             </div>
          </div>
        )}

        {tab === 'roles' && (
          <div className="space-y-6">
            {/* Section profil admin */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <User size={18} className="text-sky-700" />
                <h2 className="font-bold text-gray-900">Mon Profil Administrateur</h2>
              </div>
              {profileMsg.text && (
                <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
                  profileMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {profileMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  {profileMsg.text}
                </div>
              )}
              <form onSubmit={saveAdminProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Prénom</label>
                  <input value={adminProfile.firstName} onChange={e => setAdminProfile(p => ({...p, firstName: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nom</label>
                  <input value={adminProfile.lastName} onChange={e => setAdminProfile(p => ({...p, lastName: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input value={adminProfile.email} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mot de passe actuel</label>
                  <input type="password" value={adminProfile.currentPassword} onChange={e => setAdminProfile(p => ({...p, currentPassword: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Laisser vide pour ne pas changer" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nouveau mot de passe</label>
                  <input type="password" value={adminProfile.newPassword} onChange={e => setAdminProfile(p => ({...p, newPassword: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Nouveau mot de passe" />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" disabled={savingProfile} className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg inline-flex items-center gap-2 disabled:opacity-50">
                    <Save size={16} />{savingProfile ? 'Enregistrement...' : 'Enregistrer le profil'}
                  </button>
                </div>
              </form>
            </div>

            {/* Section gestion employés */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-sky-700" />
                  <h2 className="font-bold text-gray-900">Gestion des Employés</h2>
                </div>
                <button onClick={() => { setShowEmployeeForm(true); setEmployeeMsg({ type: '', text: '' }) }} className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg inline-flex items-center gap-2">
                  <UserPlus size={16} />Ajouter
                </button>
              </div>

              {employeeMsg.text && (
                <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
                  employeeMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {employeeMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  {employeeMsg.text}
                </div>
              )}

              {employees.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Aucun employé enregistré.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Nom</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Email</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Téléphone</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Statut</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Créé le</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(emp => (
                        <tr key={emp.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{emp.firstName} {emp.lastName}</td>
                          <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                          <td className="px-4 py-3 text-gray-600">{emp.phone || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${emp.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {emp.isActive ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{new Date(emp.createdAt).toLocaleDateString('fr-FR')}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openPermissions(emp)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg mr-1" title="Permissions">
                              <Shield size={15} />
                            </button>
                            <button onClick={() => { setSetPinEmployee(emp); setNewPin('') }} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg mr-1" title="Définir PIN">
                              <Key size={15} />
                            </button>
                            <button onClick={() => { setEditingEmployee(emp); setEditEmployeeForm({ firstName: emp.firstName, lastName: emp.lastName, phone: emp.phone || '', isActive: emp.isActive }) }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg mr-1" title="Modifier">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => deleteEmployee(emp.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Désactiver">
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'audit' && (() => {
          const filtered = auditLogs.filter(log => {
            if (auditFilter.action && log.action !== auditFilter.action) return false
            if (auditFilter.userType === 'admin' && !log.admin) return false
            if (auditFilter.userType === 'employee' && !log.employee) return false
            return true
          })
          return (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={18} className="text-sky-700" />
                  <h2 className="font-bold text-gray-900">Journal d'Activité</h2>
                </div>
                <div className="flex flex-wrap gap-3 mb-4">
                  <select value={auditFilter.action} onChange={e => setAuditFilter(p => ({...p, action: e.target.value}))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Toutes les actions</option>
                    <option value="CREATE">CREATE</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="DELETE">DELETE</option>
                    <option value="ACTIVATE">ACTIVATE</option>
                    <option value="DEACTIVATE">DEACTIVATE</option>
                  </select>
                  <select value={auditFilter.userType} onChange={e => setAuditFilter(p => ({...p, userType: e.target.value}))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Tous les utilisateurs</option>
                    <option value="admin">Admin uniquement</option>
                    <option value="employee">Employés uniquement</option>
                  </select>
                  <button onClick={() => fetchAuditLogs()} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm inline-flex items-center gap-1">
                    <RefreshCw size={14} />Actualiser
                  </button>
                  <span className="ml-auto text-sm text-gray-500 self-center">{filtered.length} entrée{filtered.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full text-sm divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date/Heure</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Utilisateur</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rôle</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">IP</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {filtered.length === 0 ? (
                        <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400">Aucune entrée trouvée</td></tr>
                      ) : filtered.map(log => {
                        const actor = log.admin || log.employee || null
                        const role = log.admin ? 'Admin' : log.employee ? 'Employé' : 'Système'
                        return (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">{new Date(log.createdAt).toLocaleString('fr-FR')}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{actor ? `${actor.firstName} ${actor.lastName}` : 'Système'}</div>
                              <div className="text-xs text-gray-400">{actor?.email || ''}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                role === 'Admin' ? 'bg-red-100 text-red-700' : role === 'Employé' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                              }`}>{role}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                                log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                                log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                                log.action === 'ACTIVATE' ? 'bg-emerald-100 text-emerald-800' :
                                log.action === 'DEACTIVATE' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-700'
                              }`}>{log.action}</span>
                            </td>
                            <td className="px-4 py-3 max-w-xs">
                              <span className="truncate block" title={log.description}>{log.description || '-'}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{log.ipAddress || 'N/A'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Modal création employé */}
      {showEmployeeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Créer un employé</h3>
              <button onClick={() => setShowEmployeeForm(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Un code PIN sera généré automatiquement et envoyé par email à l'employé (ou saisissez-en un manuellement).</p>
            <form onSubmit={createEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Prénom *</label>
                  <input value={newEmployee.firstName} onChange={e => setNewEmployee(p => ({...p, firstName: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Prénom" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nom *</label>
                  <input value={newEmployee.lastName} onChange={e => setNewEmployee(p => ({...p, lastName: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Nom" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email *</label>
                <input type="email" value={newEmployee.email} onChange={e => setNewEmployee(p => ({...p, email: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="email@exemple.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Téléphone</label>
                <input type="tel" value={newEmployee.phone} onChange={e => setNewEmployee(p => ({...p, phone: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="06 12 34 56 78" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mot de passe *</label>
                <input type="password" value={newEmployee.password} onChange={e => setNewEmployee(p => ({...p, password: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Mot de passe" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Code PIN <span className="text-gray-400 font-normal">(optionnel — généré automatiquement si vide)</span></label>
                <input value={newEmployee.pin} onChange={e => setNewEmployee(p => ({...p, pin: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: 123456" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEmployeeForm(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={creatingEmployee} className="flex-1 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg disabled:opacity-50">{creatingEmployee ? 'Création...' : 'Créer l\'employé'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal modifier employé */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Modifier l'employé</h3>
              <button onClick={() => setEditingEmployee(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={updateEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Prénom</label>
                  <input value={editEmployeeForm.firstName} onChange={e => setEditEmployeeForm(p => ({...p, firstName: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nom</label>
                  <input value={editEmployeeForm.lastName} onChange={e => setEditEmployeeForm(p => ({...p, lastName: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Téléphone</label>
                <input type="tel" value={editEmployeeForm.phone} onChange={e => setEditEmployeeForm(p => ({...p, phone: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Statut</label>
                <select value={editEmployeeForm.isActive ? 'true' : 'false'} onChange={e => setEditEmployeeForm(p => ({...p, isActive: e.target.value === 'true'}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="true">Actif</option>
                  <option value="false">Inactif</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingEmployee(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={updatingEmployee} className="flex-1 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg disabled:opacity-50">{updatingEmployee ? 'Enregistrement...' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal définir PIN */}
      {setPinEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Définir le code PIN</h3>
              <button onClick={() => setSetPinEmployee(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Employé : <strong>{setPinEmployee.firstName} {setPinEmployee.lastName}</strong><br />Le nouveau PIN sera envoyé par email à l'employé.</p>
            <form onSubmit={handleSetPin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nouveau code PIN (min. 4 chiffres)</label>
                <input value={newPin} onChange={e => setNewPin(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: 123456" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setSetPinEmployee(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={settingPin} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50">{settingPin ? 'Envoi...' : 'Définir &amp; Envoyer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal permissions employé */}
      {showPermissionsModal && permEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 shadow-xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Permissions de {permEmployee.firstName} {permEmployee.lastName}</h3>
                <p className="text-sm text-gray-500">{permEmployee.email}</p>
              </div>
              <button onClick={() => { setShowPermissionsModal(false); setPermEmployee(null) }} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            {loadingPerms ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700"></div></div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-2">Sélectionnez les pages et les actions autorisées pour cet employé.</p>
                {modules.map(m => (
                  <div key={m.key} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{m.label}</p>
                        <p className="text-xs text-gray-500">{m.description}</p>
                      </div>
                      <button type="button" onClick={() => {
                        const all = permissions[m.key]?.canView && permissions[m.key]?.canCreate && permissions[m.key]?.canEdit && permissions[m.key]?.canDelete
                        setPermissions(p => ({...p, [m.key]: { canView: !all, canCreate: !all, canEdit: !all, canDelete: !all }}))
                      }} className="text-xs text-sky-600 hover:text-sky-800">
                        {permissions[m.key]?.canView && permissions[m.key]?.canCreate && permissions[m.key]?.canEdit && permissions[m.key]?.canDelete ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[['canView','Consulter'],['canCreate','Créer'],['canEdit','Modifier'],['canDelete','Supprimer']].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={permissions[m.key]?.[key] || false}
                            onChange={e => setPermissions(p => ({...p, [m.key]: {...p[m.key], [key]: e.target.checked}}))} className="rounded border-gray-300 text-sky-600" />
                          <span className="text-sm text-gray-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
              <button onClick={() => { setShowPermissionsModal(false); setPermEmployee(null) }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={savePermissions} disabled={loadingPerms} className="px-6 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg disabled:opacity-50">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminSettings

