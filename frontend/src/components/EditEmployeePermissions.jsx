import React, { useState, useEffect } from 'react';

const EditEmployeePermissions = ({ employeeId, onSave, onCancel }) => {
  const [permissions, setPermissions] = useState({});
  const [modules, setModules] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Charger les modules et les permissions actuelles
        const [modulesResponse, permissionsResponse] = await Promise.all([
          fetch('/api/admin/employees/permissions/modules', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }),
          fetch(`/api/admin/employees/${employeeId}/permissions`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          })
        ]);

        const modulesData = await modulesResponse.json();
        const permissionsData = await permissionsResponse.json();

        setModules(modulesData);
        setEmployee(permissionsData.user);
        
        // Initialiser les permissions avec les valeurs actuelles
        const initialPermissions = {};
        modulesData.forEach(module => {
          initialPermissions[module.key] = permissionsData.permissions[module.key] || {
            canView: false,
            canCreate: false,
            canEdit: false,
            canDelete: false
          };
        });
        setPermissions(initialPermissions);
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
        alert('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    if (employeeId) {
      fetchData();
    }
  }, [employeeId]);

  const handlePermissionChange = (moduleKey, permissionType, checked) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [permissionType]: checked
      }
    }));
  };

  const handleSelectAllForModule = (moduleKey, checked) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: {
        canView: checked,
        canCreate: checked,
        canEdit: checked,
        canDelete: checked
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ permissions })
      });

      const result = await response.json();

      if (response.ok) {
        onSave(result);
      } else {
        alert(result.message || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la sauvegarde des permissions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Modifier les permissions</h2>
        {employee && (
          <p className="text-gray-600 mt-2">
            Employé: {employee.firstName} {employee.lastName} ({employee.email})
          </p>
        )}
      </div>
      
      <div className="space-y-4">
        <p className="text-sm text-gray-600 mb-4">
          Sélectionnez les pages auxquelles cet employé aura accès et les actions qu'il pourra effectuer.
        </p>
        
        {modules.map((module) => (
          <div key={module.key} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium text-gray-900">{module.label}</h4>
                <p className="text-sm text-gray-500">{module.description}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const allSelected = permissions[module.key]?.canView && 
                                    permissions[module.key]?.canCreate && 
                                    permissions[module.key]?.canEdit && 
                                    permissions[module.key]?.canDelete;
                  handleSelectAllForModule(module.key, !allSelected);
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {permissions[module.key]?.canView && 
                 permissions[module.key]?.canCreate && 
                 permissions[module.key]?.canEdit && 
                 permissions[module.key]?.canDelete ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions[module.key]?.canView || false}
                  onChange={(e) => handlePermissionChange(module.key, 'canView', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Consulter</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions[module.key]?.canCreate || false}
                  onChange={(e) => handlePermissionChange(module.key, 'canCreate', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Créer</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions[module.key]?.canEdit || false}
                  onChange={(e) => handlePermissionChange(module.key, 'canEdit', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Modifier</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={permissions[module.key]?.canDelete || false}
                  onChange={(e) => handlePermissionChange(module.key, 'canDelete', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Supprimer</span>
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Boutons d'action */}
      <div className="flex justify-end space-x-4 pt-6 mt-8 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
};

export default EditEmployeePermissions;