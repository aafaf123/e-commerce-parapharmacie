import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Calendar, Plus, Trash2, X, ArrowLeft } from 'lucide-react';
import adminApi from '../api/adminAxios';

const DAYS_DOW = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_INTERVAL = 60;
const DEFAULT_CAPACITY = 5;

const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const getMinTimeForToday = (currentTimeMinutes) => {
  const rounded = Math.ceil(currentTimeMinutes / 30) * 30;
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const AdminTimeSlots = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('days');

  const rawDayNames = t('days_of_week', { returnObjects: true });
  const dayNames = Array.isArray(rawDayNames)
    ? rawDayNames
    : ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  const getOrderedDays = () => {
    const now = new Date();
    const options = { timeZone: 'Africa/Casablanca' };
    const moroccoStr = now.toLocaleString('en-US', options);
    const moroccoDate = new Date(moroccoStr);
    let moroccoDay = moroccoDate.getDay();
    const currentHour = moroccoDate.getHours();
    const currentMinute = moroccoDate.getMinutes();
    
    if (currentHour >= 18) {
      moroccoDay = (moroccoDay + 1) % 7;
    }
    
    const orderedDays = [];
    const orderedDows = [];
    
    for (let i = 0; i < 7; i++) {
      const dayIndex = (moroccoDay + i) % 7;
      orderedDays.push(dayNames[dayIndex]);
      orderedDows.push(DAYS_DOW[dayIndex]);
    }
    
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    return { 
      orderedDays, 
      orderedDows, 
      currentDow: moroccoDay,
      currentTimeMinutes,
      currentHour,
      currentMinute
    };
  };

  const [{ orderedDays, orderedDows, currentDow, currentTimeMinutes }, setDayOrder] = useState(getOrderedDays());

  const [configs, setConfigs] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [todayReservations, setTodayReservations] = useState([]);
  const [editDay, setEditDay] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchAll();
    setDayOrder(getOrderedDays());
    const interval = setInterval(() => {
      setDayOrder(getOrderedDays());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchConfigs(), fetchTodayReservations()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      const { data } = await adminApi.get('/time-slots/config?all=true&type=STORE');
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

  useEffect(() => {
    if (activeTab === 'export') {
      fetchTodayReservations();
    }
  }, [activeTab]);

  const getConfigsForDay = (dow) => configs.filter(c => c.dayOfWeek === dow);

  const isDayActive = (dow) => {
    const dayConfigs = getConfigsForDay(dow);
    return dayConfigs.length > 0 && dayConfigs.some(c => c.active);
  };

  const toggleDay = async (dow) => {
    if (dow === 0) {
      alert(t('admin_timeslots.sunday_closed'));
      return;
    }
    const dayConfigs = getConfigsForDay(dow);
    const hasActive = dayConfigs.some(c => c.active);
    
    try {
      if (dayConfigs.length === 0) {
        await adminApi.post('/time-slots/config', {
          dayOfWeek: dow, startTime: '08:00', endTime: '20:00',
          capacity: DEFAULT_CAPACITY, intervalMinutes: DEFAULT_INTERVAL, active: true
        });
      } else {
        for (const cfg of dayConfigs) {
          await adminApi.put(`/time-slots/config/${cfg.id}`, { active: !hasActive });
        }
      }
      fetchConfigs();
    } catch { alert(t('admin_timeslots.error_update')); }
  };

  const openEditDay = (dow) => {
    const dayConfigs = getConfigsForDay(dow);
    let periods;
    
    if (dayConfigs.length > 0) {
      periods = dayConfigs.map(c => ({ 
        id: c.id, 
        startTime: c.startTime, 
        endTime: c.endTime, 
        intervalMinutes: c.intervalMinutes || DEFAULT_INTERVAL, 
        capacity: c.capacity || DEFAULT_CAPACITY
      }));
    } else {
      const isToday = dow === currentDow;
      const minStartTime = isToday ? getMinTimeForToday(currentTimeMinutes) : '08:00';
      periods = [{ 
        id: null, 
        startTime: minStartTime, 
        endTime: '20:00', 
        intervalMinutes: DEFAULT_INTERVAL, 
        capacity: DEFAULT_CAPACITY
      }];
    }
    
    setEditDay({
      dayOfWeek: dow,
      periods: periods,
      isToday: dow === currentDow
    });
  };

  const addPeriod = () => {
    const lastPeriod = editDay.periods[editDay.periods.length - 1];
    const defaultStart = lastPeriod ? lastPeriod.endTime : '08:00';
    setEditDay({
      ...editDay,
      periods: [...editDay.periods, { id: null, startTime: defaultStart, endTime: '20:00', intervalMinutes: DEFAULT_INTERVAL, capacity: DEFAULT_CAPACITY }]
    });
  };

  const removePeriod = (index) => {
    if (editDay.periods.length > 1) {
      const newPeriods = editDay.periods.filter((_, i) => i !== index);
      setEditDay({ ...editDay, periods: newPeriods });
    }
  };

  const updatePeriod = (index, field, value) => {
    const newPeriods = [...editDay.periods];
    newPeriods[index] = { ...newPeriods[index], [field]: value };
    setEditDay({ ...editDay, periods: newPeriods });
  };

  const validatePeriodsOverlap = (periods) => {
    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        const p1 = periods[i];
        const p2 = periods[j];
        
        if (p1.startTime < p2.endTime && p1.endTime > p2.startTime) {
          return { valid: false, message: `Les plages ${i + 1} et ${j + 1} se chevauchent: (${p1.startTime}-${p1.endTime} vs ${p2.startTime}-${p2.endTime})` };
        }
      }
    }
    
    for (let i = 0; i < periods.length; i++) {
      if (periods[i].startTime >= periods[i].endTime) {
        return { valid: false, message: `Plage ${i + 1}: L'heure de début doit être avant l'heure de fin` };
      }
    }
    
    return { valid: true };
  };

  const saveEditDay = async (e) => {
    e.preventDefault();
    try {
      const validation = validatePeriodsOverlap(editDay.periods);
      if (!validation.valid) {
        alert(`❌ ${t('admin_timeslots.validation_error')}:\n${validation.message}`);
        return;
      }
      
      const currentIds = editDay.periods.filter(p => p.id).map(p => p.id);
      const dayConfigs = getConfigsForDay(editDay.dayOfWeek);
      for (const cfg of dayConfigs) {
        if (!currentIds.includes(cfg.id)) {
          await adminApi.delete(`/time-slots/config/${cfg.id}`);
        }
      }
      
      const errors = [];
      for (const period of editDay.periods) {
        try {
          if (period.id) {
            await adminApi.put(`/time-slots/config/${period.id}`, {
              startTime: period.startTime,
              endTime: period.endTime,
              capacity: parseInt(period.capacity) || 5
            });
          } else {
            await adminApi.post('/time-slots/config', {
              dayOfWeek: editDay.dayOfWeek,
              startTime: period.startTime,
              endTime: period.endTime,
              capacity: parseInt(period.capacity) || 5,
              active: true
            });
          }
        } catch (err) {
          errors.push(`Plage ${period.startTime}-${period.endTime}: ${err.response?.data?.message || err.message}`);
        }
      }
      
      if (errors.length > 0) {
        alert(`⚠️ ${t('admin_timeslots.save_errors')}:\n${errors.join('\n')}`);
        fetchConfigs();
      } else {
        setEditDay(null);
        fetchConfigs();
      }
    } catch (err) {
      const msg = err.response?.data?.message || t('admin_timeslots.error_save');
      alert(`❌ ${msg}`);
    }
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
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
              title={i18n.language?.startsWith('ar') ? 'العودة إلى لوحة التحكم' : 'Retour au Tableau de Bord'}
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-semibold hidden lg:inline">{i18n.language?.startsWith('ar') ? 'لوحة التحكم' : 'Dashboard'}</span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t('admin_timeslots.title')}</h1>
              <p className="text-xs text-gray-500">{t('admin_timeslots.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { id: 'days', label: t('admin_timeslots.tab_days'), icon: Calendar },
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
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl">
              <h3 className="font-semibold text-gray-900 mb-2">{t('admin_timeslots.tip_title')}</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{t('admin_timeslots.tip_desc')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {orderedDays.map((dayName, idx) => {
                const dow = orderedDows[idx];
                const dayConfigs = getConfigsForDay(dow);
                const isActive = dow !== 0 && isDayActive(dow);
                
                const periods = dayConfigs.filter(c => c.active).map(c => `${c.startTime} – ${c.endTime}`);

                return (
                  <div key={dow} className={`bg-white rounded-xl border-2 p-4 transition-all ${
                    isActive ? 'border-green-200' : 'border-gray-200 opacity-60'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`font-semibold ${dow === 0 ? 'text-gray-400' : 'text-gray-900'}`}>{dayName}</span>
                      <button
                        onClick={() => toggleDay(dow)}
                        disabled={dow === 0}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isActive ? 'bg-green-500' : 'bg-gray-300'
                        } ${dow === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          isActive ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    {isActive && (
                      <>
                        <div className="text-sm text-gray-600 space-y-1 mb-3">
                          {periods.map((period, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <Clock size={13} className="text-sky-600" />
                              <span>{period}</span>
                            </div>
                          ))}
                          {periods.length === 0 && (
                            <div className="text-xs text-gray-400">{t('admin_timeslots.no_schedule')}</div>
                          )}
                        </div>
                        <button
                          onClick={() => openEditDay(dow)}
                          className="w-full text-xs text-sky-700 border border-sky-200 rounded-lg py-1.5 hover:bg-sky-50 transition-colors flex items-center justify-center gap-1"
                        >
                          {t('admin_timeslots.edit_hours')}
                        </button>
                      </>
                    )}
                    {!isActive && (
                      <p className="text-xs text-gray-400 mt-1">{t('admin_timeslots.day_disabled')}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Edit day hours with multiple periods */}
      {editDay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 text-lg">{t('admin_timeslots.modal_title')} — <span className="text-sky-600">{dayNames[editDay.dayOfWeek]}</span></h3>
            </div>
            
            {editDay.periods.length > 1 && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
                <span>{t('admin_timeslots.multiple_periods', { n: editDay.periods.length })}</span>
              </div>
            )}
            
            <form onSubmit={saveEditDay}>
              <div className="space-y-4">
                {editDay.periods.map((period, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-sky-300 transition-colors">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2 py-1 rounded">{t('admin_timeslots.period_label', { n: index + 1 })}</span>
                        {index > 0 && <span className="text-xs text-gray-500 ml-2">{t('admin_timeslots.already_defined')}: {period.startTime}-{period.endTime}</span>}
                      </div>
                      {editDay.periods.length > 1 && (
                        <button type="button" onClick={() => removePeriod(index)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('admin_timeslots.start_time')}</label>
                        {editDay.isToday && index === 0 && (
                          <p className="text-xs text-orange-600 mb-1">
                            ⚠️ {t('admin_timeslots.min_time')}: {getMinTimeForToday(currentTimeMinutes)}
                          </p>
                        )}
                        <input type="time" value={period.startTime}
                          onChange={e => updatePeriod(index, 'startTime', e.target.value)}
                          min={editDay.isToday && index === 0 ? getMinTimeForToday(currentTimeMinutes) : undefined}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('admin_timeslots.end_time')}</label>
                        <input type="time" value={period.endTime}
                          onChange={e => updatePeriod(index, 'endTime', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('admin_timeslots.interval')}</label>
                        <select value={period.intervalMinutes}
                          onChange={e => updatePeriod(index, 'intervalMinutes', parseInt(e.target.value))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500">
                          {[15, 30, 45, 60, 90, 120].map(v => <option key={v} value={v}>{v} min</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('admin_timeslots.capacity')}</label>
                        <input type="number" min="1" max="50" value={period.capacity}
                          onChange={e => updatePeriod(index, 'capacity', parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" required />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <button type="button" onClick={addPeriod}
                className="w-full mt-4 py-2.5 border-2 border-dashed border-sky-300 text-sky-700 rounded-lg text-sm font-medium hover:bg-sky-50 transition-colors flex items-center justify-center gap-2">
                <Plus size={16} /> {t('admin_timeslots.add_period')}
              </button>

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setEditDay(null)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 font-medium">
                  {t('common.cancel')}
                </button>
                <button type="submit"
                  className="flex-1 py-2 bg-sky-700 text-white rounded-lg text-sm hover:bg-sky-800 font-medium transition-colors">
                  ✅ {t('admin_timeslots.save_periods', { n: editDay.periods.length })}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTimeSlots;