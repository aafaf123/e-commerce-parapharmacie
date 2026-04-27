import React, { useState, useEffect } from 'react';

const CreateEmployeeForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    salary: ''
  });

  const [permissions, setPermissions] = useState({});
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);

  // Charger les modules disponibles
  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await fetch('/api/admin/employees/permissions/modules', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setModules(data);
        
        // Initialiser les permissions à false pour tous les modules
        const initialPermissions = {};
        data.forEach(module => {
          initialPermissions[module.key] = {
            canView: false,
            canCreate: false,
            canEdit: false,
            canDelete: false
          };
        });
        setPermissions(initialPermissions);
      } catch (error) {
        console.error('Erreur lors du chargement des modules:', error);
      }
    };

    fetchModules();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const employeeData = {
        ...formData,
        permissions
      };

      const response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(employeeData)
      });

      const result = await response.json();

      if (response.ok) {
        onSubmit(result);
      } else {
        alert(result.message || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la création de l\'employé');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Créer un nouveau employé</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations personnelles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prénom *
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom *
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Téléphone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Salaire (DH)
            </label>
            <input
              type="number"
              name="salary"
              value={formData.salary}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Permissions */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Permissions d'accès</h3>
          <p className="text-sm text-gray-600 mb-4">
            Sélectionnez les pages auxquelles cet employé aura accès et les actions qu'il pourra effectuer.
          </p>
          
          <div className="space-y-4">
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
                    Tout sélectionner
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
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-end space-x-4 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer l\'employé'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateEmployeeForm;