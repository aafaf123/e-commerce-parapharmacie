import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Calendar, Plus, Trash2, X, Download, Settings, Ban, ArrowLeft, Sliders } from 'lucide-react';
import adminApi from '../api/adminAxios';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DEFAULT_START = '08:00';
const DEFAULT_END   = '20:00';
const DEFAULT_INTERVAL = 60;
const DEFAULT_CAPACITY = 5;

const AdminTimeSlots = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('days');

  // Per-day configs (one entry per dayOfWeek max)
  const [configs, setConfigs] = useState([]);
  // Blocked slots
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({ date: '', startTime: '', endTime: '', reason: '' });
  // Today reservations
  const [todayReservations, setTodayReservations] = useState([]);
  // Edit modal for a day's hours
  const [editDay, setEditDay] = useState(null);
  // Slot capacity overrides
  const [selectedDow, setSelectedDow] = useState(1); // day for capacity tab
  const [slotOverrides, setSlotOverrides] = useState([]);
  const [previewSlots, setPreviewSlots] = useState([]); // generated slots for selected day
  const [savingSlot, setSavingSlot] = useState(null); // { dayOfWeek, id?, startTime, endTime, intervalMinutes, capacity }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchConfigs(), fetchBlocked(), fetchTodayReservations()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      // Fetch ALL configs (including inactive) to correctly show disabled days
      const { data } = await adminApi.get('/time-slots/config?all=true');
      setConfigs(data);
    } catch { setConfigs([]); }
  };

  const fetchBlocked = async () => {
    try {
      const { data } = await adminApi.get('/time-slots/blocked');
      setBlockedSlots(data);
    } catch { setBlockedSlots([]); }
  };

  const fetchTodayReservations = async () => {
    try {
      const { data } = await adminApi.get('/time-slots/today-reservations');
      setTodayReservations(data);
    } catch { setTodayReservations([]); }
  };

  // Fetch overrides + generate preview slots for selected day
  const fetchOverrides = async (dow) => {
    try {
      const { data } = await adminApi.get(`/time-slots/slot-capacities?dayOfWeek=${dow}`);
      setSlotOverrides(data);
    } catch { setSlotOverrides([]); }
    generatePreviewSlots(dow);
  };

  // Generate the list of slot times for a given day based on config or defaults
  const generatePreviewSlots = (dow) => {
    const cfg = getConfig(dow);
    const start = cfg?.startTime || DEFAULT_START;
    const end = cfg?.endTime || DEFAULT_END;
    const interval = cfg?.intervalMinutes || DEFAULT_INTERVAL;
    const defaultCap = cfg?.capacity || DEFAULT_CAPACITY;

    const slots = [];
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let cur = sh * 60 + sm;
    const endMin = eh * 60 + em;
    while (cur < endMin) {
      const h = String(Math.floor(cur / 60)).padStart(2, '0');
      const m = String(cur % 60).padStart(2, '0');
      slots.push({ time: `${h}:${m}`, defaultCapacity: defaultCap });
      cur += interval;
    }
    setPreviewSlots(slots);
  };

  useEffect(() => {
    if (activeTab === 'capacities') fetchOverrides(selectedDow);
  }, [activeTab, selectedDow, configs]);

  // Get config for a given dayOfWeek (or null = using defaults)
  const getConfig = (dow) => configs.find(c => c.dayOfWeek === dow) || null;

  // Toggle a day: if active config exists → deactivate; if inactive → activate; if none → create default
  const toggleDay = async (dow) => {
    const cfg = getConfig(dow);
    try {
      if (!cfg) {
        // Create default config for this day
        await adminApi.post('/time-slots/config', {
          dayOfWeek: dow, startTime: DEFAULT_START, endTime: DEFAULT_END,
          capacity: DEFAULT_CAPACITY, intervalMinutes: DEFAULT_INTERVAL, active: false
        });
      } else {
        await adminApi.put(`/time-slots/config/${cfg.id}`, { active: !cfg.active });
      }
      fetchConfigs();
    } catch { alert('Erreur lors de la mise à jour'); }
  };

  // Open edit modal for a day's hours
  const openEditDay = (dow) => {
    const cfg = getConfig(dow);
    setEditDay({
      dayOfWeek: dow,
      id: cfg?.id || null,
      startTime: cfg?.startTime || DEFAULT_START,
      endTime: cfg?.endTime || DEFAULT_END,
      intervalMinutes: cfg?.intervalMinutes || DEFAULT_INTERVAL,
      capacity: cfg?.capacity || DEFAULT_CAPACITY,
    });
  };

  const saveEditDay = async (e) => {
    e.preventDefault();
    try {
      if (editDay.id) {
        await adminApi.put(`/time-slots/config/${editDay.id}`, {
          startTime: editDay.startTime, endTime: editDay.endTime,
          intervalMinutes: editDay.intervalMinutes, capacity: editDay.capacity
        });
      } else {
        await adminApi.post('/time-slots/config', {
          dayOfWeek: editDay.dayOfWeek, startTime: editDay.startTime,
          endTime: editDay.endTime, intervalMinutes: editDay.intervalMinutes,
          capacity: editDay.capacity, active: true
        });
      }
      setEditDay(null);
      fetchConfigs();
    } catch { alert('Erreur lors de la sauvegarde'); }
  };

  // Block a slot
  const handleBlockSubmit = async (e) => {
    e.preventDefault();
    try {
      await adminApi.post('/time-slots/blocked', blockForm);
      setShowBlockModal(false);
      setBlockForm({ date: '', startTime: '', endTime: '', reason: '' });
      fetchBlocked();
    } catch { alert('Erreur lors du blocage'); }
  };

  const handleUnblock = async (id) => {
    if (!confirm('Débloquer ce créneau ?')) return;
    try {
      await adminApi.delete(`/time-slots/blocked/${id}`);
      fetchBlocked();
    } catch { alert('Erreur lors du déblocage'); }
  };

  const handleExportPDF = () => {
    const html = `<html><head><title>Réservations du ${new Date().toLocaleDateString('fr-FR')}</title>
    <style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#f2f2f2}</style></head>
    <body><h1>Réservations - ${new Date().toLocaleDateString('fr-FR')}</h1>
    <table><thead><tr><th>N° Commande</th><th>Client</th><th>Créneau</th><th>Statut</th><th>Montant</th></tr></thead>
    <tbody>${todayReservations.map(o => `<tr><td>${o.orderNumber}</td><td>${o.user.firstName} ${o.user.lastName}</td><td>${o.timeSlotStart} - ${o.timeSlotEnd}</td><td>${o.status}</td><td>${o.total.toFixed(2)} DH</td></tr>`).join('')}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-sky-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin/admindashboard')} className="text-gray-500 hover:text-gray-700">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Gestion des créneaux</h1>
              <p className="text-xs text-gray-500">Tous les jours sont actifs par défaut (08h–20h)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { id: 'days', label: 'Jours & Horaires', icon: Calendar },
            { id: 'capacities', label: 'Capacités par créneau', icon: Sliders },
            { id: 'blocked', label: 'Créneaux bloqués', icon: Ban },
            { id: 'export', label: 'Export du jour', icon: Download },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}>
              <tab.icon size={15} />{tab.label}
            </button>
          ))}
        </div>

        {/* TAB: Jours & Horaires */}
        {activeTab === 'days' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Par défaut, tous les jours sont disponibles de <strong>08h00 à 20h00</strong> (créneaux d'1h, capacité 5).
              Désactivez un jour ou modifiez ses horaires selon vos besoins.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DAYS.map((dayName, dow) => {
                const cfg = getConfig(dow);
                // A day is "active" if no config exists (default) OR config exists with active=true
                const isActive = !cfg || cfg.active;
                const start = cfg?.startTime || DEFAULT_START;
                const end = cfg?.endTime || DEFAULT_END;
                const interval = cfg?.intervalMinutes || DEFAULT_INTERVAL;
                const capacity = cfg?.capacity || DEFAULT_CAPACITY;

                return (
                  <div key={dow} className={`bg-white rounded-xl border-2 p-4 transition-all ${
                    isActive ? 'border-green-200' : 'border-gray-200 opacity-60'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-900">{dayName}</span>
                      <button
                        onClick={() => toggleDay(dow)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          isActive ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    {isActive && (
                      <>
                        <div className="text-sm text-gray-600 space-y-1 mb-3">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-sky-600" />
                            <span>{start} – {end}</span>
                          </div>
                          <div className="text-xs text-gray-400">
                            Intervalle : {interval} min · Capacité : {capacity} commandes
                          </div>
                        </div>
                        <button
                          onClick={() => openEditDay(dow)}
                          className="w-full text-xs text-sky-700 border border-sky-200 rounded-lg py-1.5 hover:bg-sky-50 transition-colors flex items-center justify-center gap-1"
                        >
                          <Settings size={12} /> Modifier les horaires
                        </button>
                      </>
                    )}
                    {!isActive && (
                      <p className="text-xs text-gray-400 mt-1">Jour désactivé</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: Capacités par créneau */}
        {activeTab === 'capacities' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Définissez une capacité spécifique pour chaque créneau horaire.
              Laissez la valeur par défaut pour utiliser la capacité du jour.
            </p>

            {/* Day selector */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {DAYS.map((name, dow) => (
                <button key={dow} onClick={() => setSelectedDow(dow)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    selectedDow === dow
                      ? 'bg-sky-700 text-white border-sky-700'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {name}
                </button>
              ))}
            </div>

            {previewSlots.length === 0 ? (
              <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">
                <Clock size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucun créneau configuré pour ce jour</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Créneau</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacité par défaut</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacité spécifique</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewSlots.map(({ time, defaultCapacity }) => {
                      const override = slotOverrides.find(o => o.slotTime === time);
                      const currentCap = override ? override.capacity : defaultCapacity;
                      const isOverridden = !!override;

                      return (
                        <SlotCapacityRow
                          key={time}
                          time={time}
                          defaultCapacity={defaultCapacity}
                          currentCapacity={currentCap}
                          isOverridden={isOverridden}
                          saving={savingSlot === time}
                          onSave={(cap) => handleSaveSlotCapacity(time, cap, defaultCapacity)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: Créneaux bloqués */}
        {activeTab === 'blocked' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">Bloquez un jour entier ou une plage horaire spécifique.</p>
              <button onClick={() => setShowBlockModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Ban size={15} /> Bloquer un créneau
              </button>
            </div>

            {blockedSlots.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                <Ban size={36} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucun créneau bloqué</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Date', 'Horaires', 'Raison', 'Action'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {blockedSlots.map(slot => (
                      <tr key={slot.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {new Date(slot.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {slot.startTime ? `${slot.startTime} – ${slot.endTime || '23:59'}` : 'Journée entière'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{slot.reason}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleUnblock(slot.id)}
                            className="text-xs text-green-600 hover:text-green-800 font-medium">
                            Débloquer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: Export */}
        {activeTab === 'export' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">
                Réservations du {new Date().toLocaleDateString('fr-FR')}
              </h2>
              <button onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">
                <Download size={15} /> Exporter PDF
              </button>
            </div>
            {todayReservations.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                <Clock size={36} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucune réservation aujourd'hui</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {['N° Commande', 'Client', 'Créneau', 'Statut', 'Montant'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {todayReservations.map(order => (
                      <tr key={order.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{order.user.firstName} {order.user.lastName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{order.timeSlotStart} – {order.timeSlotEnd}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            order.status === 'RECEIVED' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'PREPARING' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'READY' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>{order.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{order.total.toFixed(2)} DH</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Edit day hours */}
      {editDay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">Horaires — {DAYS[editDay.dayOfWeek]}</h3>
              <button onClick={() => setEditDay(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={saveEditDay} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Heure début</label>
                  <input type="time" value={editDay.startTime}
                    onChange={e => setEditDay({ ...editDay, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Heure fin</label>
                  <input type="time" value={editDay.endTime}
                    onChange={e => setEditDay({ ...editDay, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Intervalle (min)</label>
                  <select value={editDay.intervalMinutes}
                    onChange={e => setEditDay({ ...editDay, intervalMinutes: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500">
                    {[30, 60, 90, 120].map(v => <option key={v} value={v}>{v} min</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Capacité</label>
                  <input type="number" min="1" max="20" value={editDay.capacity}
                    onChange={e => setEditDay({ ...editDay, capacity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500" required />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditDay(null)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit"
                  className="flex-1 py-2 bg-sky-700 text-white rounded-lg text-sm hover:bg-sky-800">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Block slot */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">Bloquer un créneau</h3>
              <button onClick={() => setShowBlockModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleBlockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={blockForm.date}
                  onChange={e => setBlockForm({ ...blockForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Début (optionnel)</label>
                  <input type="time" value={blockForm.startTime}
                    onChange={e => setBlockForm({ ...blockForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fin (optionnel)</label>
                  <input type="time" value={blockForm.endTime}
                    onChange={e => setBlockForm({ ...blockForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Raison</label>
                <textarea value={blockForm.reason}
                  onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })}
                  placeholder="Jour férié, absence livreur..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500 resize-none" required />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowBlockModal(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit"
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                  Bloquer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline editable row for slot capacity
const SlotCapacityRow = ({ time, defaultCapacity, currentCapacity, isOverridden, saving, onSave }) => {
  const [value, setValue] = useState(currentCapacity);

  // Sync if parent updates
  useEffect(() => { setValue(currentCapacity); }, [currentCapacity]);

  const isDirty = parseInt(value) !== currentCapacity;

  return (
    <tr className={isOverridden ? 'bg-sky-50' : ''}>
      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{time}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{defaultCapacity} places</td>
      <td className="px-4 py-3">
        <input
          type="number" min="0" max="50"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
        />
      </td>
      <td className="px-4 py-3">
        {isOverridden ? (
          <span className="px-2 py-0.5 text-xs bg-sky-100 text-sky-700 rounded-full font-medium">Personnalisé</span>
        ) : (
          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">Défaut</span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onSave(value)}
          disabled={saving || !isDirty}
          className="px-3 py-1 text-xs bg-sky-700 text-white rounded-lg hover:bg-sky-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? '...' : 'Enregistrer'}
        </button>
        {isOverridden && (
          <button
            onClick={() => { setValue(defaultCapacity); onSave(defaultCapacity); }}
            disabled={saving}
            className="ml-2 px-3 py-1 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </td>
    </tr>
  );
};

export default AdminTimeSlots;
