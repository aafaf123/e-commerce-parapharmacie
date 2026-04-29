// frontend/src/hooks/useEmployeePermissions.js
// Redirige vers le contexte global — rétrocompatibilité
import { usePermissions } from '../context/PermissionsContext';

export const useEmployeePermissions = () => {
  const { permissions, loading, can, canView, canCreate, canEdit, canDelete, refetch } = usePermissions();

  return {
    permissions,
    loading,
    hasPermission: can,
    canAccessModule: canView,
    canView,
    canCreate,
    canEdit,
    canDelete,
    refetch
  };
};
