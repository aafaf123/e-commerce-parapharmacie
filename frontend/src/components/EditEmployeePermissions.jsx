import { useState, useEffect } from 'react';
import { Save, X, CheckSquare, Square, Loader2 } from 'lucide-react';
import adminAxios from '../api/adminAxios';

const ACTIONS = [
  { key: 'canView',   label: 'Consulter', color: 'text-blue-600' },
  { key: 'canCreate', label: 'Créer',     color: 'text-green-600' },
  { key: 'canEdit',   label: 'Modifier',  color: 'text-orange-600' },
  { key: 'canDelete', label: 'Supprimer', color: 'text-red-600' },
];

const EditEmployeePermissions = ({ employeeId, onSave, onCancel }) => {
  const [modules, setModules]       = useState([]);
  const [permissions, setPermissions] = useState({});
  const [employee, setEmployee]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (!employeeId) return;
    const load = async () => {
      try {
        setLoading(true);
        const [modRes, permRes] = await Promise.all([
          adminAxios.get('/employees/permissions/modules'),
          adminAxios.get(`/employees/permissions/${employeeId}`)
        ]);
        setModules(modRes.data);
        setEmployee(permRes.data.user);

        // Initialiser toutes les permissions
        const init = {};
        modRes.data.forEach(m => {
          init[m.key] = permRes.data.permissions[m.key] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
        });
        setPermissions(init);
      } catch (e) {
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [employeeId]);

  const toggle = (moduleKey, action) => {
    setPermissions(prev => {
      const updated = { ...prev, [moduleKey]: { ...prev[moduleKey], [action]: !prev[moduleKey][action] } };
      // Si on décoche canView, tout décocher
      if (action === 'canView' && !updated[moduleKey].canView) {
        updated[moduleKey] = { canView: false, canCreate: false, canEdit: false, canDelete: false };
      }
      // Si on coche une action autre que canView, cocher canView automatiquement
      if (action !== 'canView' && updated[moduleKey][action]) {
        updated[moduleKey].canView = true;
      }
      return updated;
    });
  };

  const toggleAll = (moduleKey) => {
    const p = permissions[moduleKey];
    const allOn = ACTIONS.every(a => p[a.key]);
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: { canView: !allOn, canCreate: !allOn, canEdit: !allOn, canDelete: !allOn }
    }));
  };

  const toggleColumn = (action) => {
    const allOn = modules.every(m => permissions[m.key]?.[action]);
    setPermissions(prev => {
      const updated = { ...prev };
      modules.forEach(m => {
        updated[m.key] = { ...updated[m.key], [action]: !allOn };
        // Si on coche une action, cocher canView
        if (action !== 'canView' && !allOn) updated[m.key].canView = true;
        // Si on décoche canView, tout décocher
        if (action === 'canView' && allOn) {
          updated[m.key] = { canView: false, canCreate: false, canEdit: false, canDelete: false };
        }
      });
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAxios.put(`/employees/permissions/${employeeId}`, { permissions });
      onSave?.();
    } catch {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 size={32} className="animate-spin text-sky-700" />
    </div>
  );

  return (
    <div className="bg-white rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Permissions de l'employé</h2>
          {employee && (
            <p className="text-sm text-gray-500 mt-0.5">
              {employee.firstName} {employee.lastName} — {employee.email}
            </p>
          )}
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg">
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Tableau des permissions */}
      <div className="p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 pr-4 font-semibold text-gray-700 w-48">Page / Module</th>
              {ACTIONS.map(a => (
                <th key={a.key} className="text-center py-3 px-3 font-semibold">
                  <button
                    onClick={() => toggleColumn(a.key)}
                    className={`${a.color} hover:opacity-70 transition-opacity font-semibold`}
                    title={`Tout ${a.label.toLowerCase()}`}
                  >
                    {a.label}
                  </button>
                </th>
              ))}
              <th className="text-center py-3 px-3 font-semibold text-gray-500">Tout</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m, idx) => {
              const p = permissions[m.key] || {};
              const allOn = ACTIONS.every(a => p[a.key]);
              return (
                <tr key={m.key} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-3 pr-4 font-medium text-gray-800">{m.label}</td>
                  {ACTIONS.map(a => (
                    <td key={a.key} className="text-center py-3 px-3">
                      <button onClick={() => toggle(m.key, a.key)} className="mx-auto block">
                        {p[a.key]
                          ? <CheckSquare size={20} className={a.color} />
                          : <Square size={20} className="text-gray-300" />
                        }
                      </button>
                    </td>
                  ))}
                  <td className="text-center py-3 px-3">
                    <button onClick={() => toggleAll(m.key)} className="mx-auto block">
                      {allOn
                        ? <CheckSquare size={20} className="text-sky-600" />
                        : <Square size={20} className="text-gray-300" />
                      }
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 p-6 border-t">
        <button onClick={onCancel} className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-sky-700 text-white rounded-lg hover:bg-sky-800 flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Sauvegarde...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
};

export default EditEmployeePermissions;
