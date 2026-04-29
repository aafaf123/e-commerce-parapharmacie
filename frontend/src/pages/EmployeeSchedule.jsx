import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Plus, Trash2, X, AlertCircle, Check, ArrowLeft, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import adminApi from '../api/adminAxios';
import { useAuth } from '../context/AuthContext';

const DEFAULT_CAPACITY = 1;

const EmployeeSchedule = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user: authUser } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  const employeeId = id || authUser?.id;
  const DAYS = t('employee_schedule.days', { returnObjects: true });

  const [employee, setEmployee] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editDay, setEditDay] = useState(null);

  useEffect(() => { if (employeeId) fetchSchedules(); }, [employeeId]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const empRes = await adminApi.get(`/employees/${employeeId}`);
      setEmployee(empRes.data);
      const { data } = await adminApi.get(`/time-slots/config?type=EMPLOYEE&employeeId=${employeeId}&all=true`);
      setSchedules(data || []);
    } catch {
      setError(t('employee_schedule.error_load'));
    } finally {
      setLoading(false);
    }
  };

  const getSchedulesForDay = (dow) => schedules.filter(s => s.dayOfWeek === dow);

  const openEditDay = (dow) => {
    const daySchedules = getSchedulesForDay(dow);
    const periods = daySchedules.length > 0
      ? daySchedules.map(s => ({ id: s.id, startTime: s.startTime, endTime: s.endTime, maxCapacity: s.maxCapacity || DEFAULT_CAPACITY, isAvailable: s.isAvailable !== undefined ? s.isAvailable : true }))
      : [{ id: null, startTime: '08:00', endTime: '12:00', maxCapacity: DEFAULT_CAPACITY, isAvailable: true }];
    setEditDay({ dayOfWeek: dow, periods });
  };

  const addPeriod = () => {
    const last = editDay.periods[editDay.periods.length - 1];
    setEditDay({ ...editDay, periods: [...editDay.periods, { id: null, startTime: last ? last.endTime : '08:00', endTime: '20:00', maxCapacity: DEFAULT_CAPACITY, isAvailable: true }] });
  };

  const removePeriod = (index) => {
    if (editDay.periods.length > 1) setEditDay({ ...editDay, periods: editDay.periods.filter((_, i) => i !== index) });
  };

  const updatePeriod = (index, field, value) => {
    const newPeriods = [...editDay.periods];
    newPeriods[index] = { ...newPeriods[index], [field]: value };
    setEditDay({ ...editDay, periods: newPeriods });
  };

  const validatePeriods = (periods) => {
    for (let i = 0; i < periods.length; i++) {
      if (periods[i].startTime >= periods[i].endTime)
        return { valid: false, message: t('employee_schedule.validation_start_before_end', { n: i + 1 }) };
      for (let j = i + 1; j < periods.length; j++) {
        if (periods[i].startTime < periods[j].endTime && periods[i].endTime > periods[j].startTime)
          return { valid: false, message: t('employee_schedule.validation_overlap', { a: i + 1, b: j + 1 }) };
      }
    }
    return { valid: true };
  };

  const saveEditDay = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const validation = validatePeriods(editDay.periods);
    if (!validation.valid) { setError(validation.message); return; }
    try {
      const currentIds = editDay.periods.filter(p => p.id).map(p => p.id);
      for (const s of getSchedulesForDay(editDay.dayOfWeek)) {
        if (!currentIds.includes(s.id)) await adminApi.delete(`/time-slots/config/${s.id}`);
      }
      for (const p of editDay.periods) {
        const payload = { dayOfWeek: editDay.dayOfWeek, startTime: p.startTime, endTime: p.endTime, capacity: p.maxCapacity || 1, active: p.isAvailable !== undefined ? p.isAvailable : true, type: 'EMPLOYEE', userId: employeeId };
        if (p.id) await adminApi.put(`/time-slots/config/${p.id}`, payload);
        else await adminApi.post('/time-slots/config', payload);
      }
      setSuccess(t('employee_schedule.success_update', { day: DAYS[editDay.dayOfWeek] }));
      setEditDay(null);
      fetchSchedules();
    } catch (err) {
      setError(err.response?.data?.message || t('employee_schedule.error_save'));
    }
  };

  if (loading && !employee) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-700"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2">
                <ArrowLeft size={20} className={isAr ? 'rotate-180' : ''} />
                <span className="text-sm font-semibold hidden lg:inline">{t('employee_schedule.back')}</span>
              </button>
              <div className="h-8 w-px bg-gray-200"></div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{t('employee_schedule.title')}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <User size={14} className="text-sky-600" />
                  <span>{employee?.firstName} {employee?.lastName}</span>
                  <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-xs border border-sky-100 uppercase font-medium">
                    {t('employee_schedule.employee_badge')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 mb-6">
            <AlertCircle size={18} /><span className="text-sm font-medium">{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 mb-6">
            <Check size={18} /><span className="text-sm font-medium">{success}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50 bg-gray-50/30">
            <h3 className="text-lg font-bold text-gray-900">{t('employee_schedule.weekly_config_title')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('employee_schedule.weekly_config_desc')}</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {DAYS.map((day, idx) => {
                const daySchedules = getSchedulesForDay(idx);
                const isActive = daySchedules.length > 0;
                return (
                  <div key={idx} className={`relative group rounded-2xl border-2 transition-all p-5 h-full flex flex-col ${isActive ? 'border-sky-100 bg-white shadow-sm' : 'border-gray-100 bg-gray-50/50 grayscale opacity-60'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-gray-900">{day}</h4>
                      {isActive ? (
                        <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                          <Check size={10} /> {daySchedules.length}
                        </div>
                      ) : (
                        <div className="text-[10px] uppercase font-bold text-gray-400">{t('employee_schedule.closed')}</div>
                      )}
                    </div>
                    <div className="flex-grow space-y-3">
                      {isActive ? (
                        daySchedules.map((s, si) => (
                          <div key={s.id || si} className="flex flex-col gap-1 p-2.5 rounded-xl bg-sky-50/50 border border-sky-100/50">
                            <div className="flex items-center gap-2 text-sm font-semibold text-sky-900">
                              <Clock size={14} className="text-sky-500" />{s.startTime} – {s.endTime}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-400 italic py-4 text-center">{t('employee_schedule.no_schedule')}</div>
                      )}
                    </div>
                    <button
                      onClick={() => openEditDay(idx)}
                      className="mt-6 w-full py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 bg-white text-sky-700 border-sky-200 hover:bg-sky-700 hover:text-white hover:border-transparent hover:shadow-md active:scale-95"
                    >
                      {isActive ? t('employee_schedule.edit_hours') : t('employee_schedule.configure_day')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {editDay && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{t('employee_schedule.modal_title', { day: DAYS[editDay.dayOfWeek] })}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('employee_schedule.modal_subtitle', { name: `${employee?.firstName} ${employee?.lastName}` })}</p>
              </div>
              <button onClick={() => setEditDay(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={saveEditDay} className="p-6">
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {editDay.periods.map((period, index) => (
                  <div key={index} className="p-4 rounded-2xl border-2 border-gray-100 bg-gray-50/30 hover:border-sky-200 transition-all relative">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-1 rounded-lg border border-sky-100">
                        {t('employee_schedule.period_badge', { n: index + 1 })}
                      </span>
                      {editDay.periods.length > 1 && (
                        <button type="button" onClick={() => removePeriod(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('employee_schedule.start_label')}</label>
                        <input type="time" value={period.startTime} onChange={e => updatePeriod(index, 'startTime', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all" required />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('employee_schedule.end_label')}</label>
                        <input type="time" value={period.endTime} onChange={e => updatePeriod(index, 'endTime', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all" required />
                      </div>
                      <div className="col-span-2 space-y-1.5 pt-2">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('employee_schedule.capacity_label')}</label>
                        <input type="number" min="1" value={period.maxCapacity} onChange={e => updatePeriod(index, 'maxCapacity', parseInt(e.target.value) || 1)} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all" required />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addPeriod} className="w-full mt-4 py-3 border-2 border-dashed border-gray-200 text-gray-500 rounded-2xl text-sm font-bold hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50/50 transition-all flex items-center justify-center gap-2">
                <Plus size={18} />{t('employee_schedule.add_period')}
              </button>
              <div className="flex gap-3 mt-8 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setEditDay(null)} className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all">
                  {t('employee_schedule.cancel')}
                </button>
                <button type="submit" className="flex-1 py-3 bg-sky-700 text-white rounded-xl text-sm font-bold hover:bg-sky-800 shadow-lg shadow-sky-700/20 active:scale-[0.98] transition-all">
                  {t('employee_schedule.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeSchedule;
