import { useState, useEffect } from 'react';
import adminApi from '../api/adminAxios';

export const useEmployeePermissions = () => {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  const fetchUserPermissions = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Si c'est un admin, il a tous les droits
      if (user.role === 'ADMIN') {
        setPermissions({
          products: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          orders: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          reports: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          promotions: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          timeslots: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          suppliers: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          categories: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          customers: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          inventory: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          settings: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          employees: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          reviews: { canView: true, canCreate: true, canEdit: true, canDelete: true },
          deliveries: { canView: true, canCreate: true, canEdit: true, canDelete: true }
        });
        setLoading(false);
        return;
      }

      // Pour les employés, récupérer leurs permissions depuis l'API
      if (user.id && user.role === 'EMPLOYE') {
        const { data } = await adminApi.get(`/employees/${user.id}/permissions`);
        setPermissions(data.permissions || {});
      } else {
        // Aucune permission pour les autres rôles
        setPermissions({});
      }
    } catch (error) {
      console.error('Erreur lors du chargement des permissions:', error);
      setError(error.message);
      setPermissions({});
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (module, action = 'canView') => {
    return permissions[module]?.[action] || false;
  };

  const canAccessModule = (module) => {
    return hasPermission(module, 'canView');
  };

  return {
    permissions,
    loading,
    error,
    hasPermission,
    canAccessModule,
    refetch: fetchUserPermissions
  };
};