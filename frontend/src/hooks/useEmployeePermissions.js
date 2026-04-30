// frontend/src/hooks/useEmployeePermissions.js
// Redirige vers le store Zustand — rétrocompatibilité
import { usePermissionsStore } from '../stores';

export const useEmployeePermissions = () => {
  const store = usePermissionsStore();
  const { permissions, loading, canView, canCreate, canEdit, canDelete } = store;

  return {
    permissions,
    loading,
    hasPermission: store.hasPermission,
    canAccessModule: canView,
    canView,
    canCreate,
    canEdit,
    canDelete,
    refetch: () => {} // Placeholder for compatibility
  };
};
