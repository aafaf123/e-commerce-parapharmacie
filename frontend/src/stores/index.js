// Export de tous les stores Zustand
export { default as useAuthStore } from './authStore'
export { default as useCartStore } from './cartStore'
export { default as useFavoritesStore } from './favoritesStore'
export { default as usePermissionsStore } from './permissionsStore'

// Hook combiné pour l'authentification et les permissions
import useAuthStore from './authStore'
import usePermissionsStore from './permissionsStore'
import useCartStore from './cartStore'
import useFavoritesStore from './favoritesStore'

export const useAuth = () => {
  const auth = useAuthStore()
  const permissions = usePermissionsStore()
  
  return {
    ...auth,
    permissions: permissions.permissions,
    loadPermissions: permissions.loadPermissions,
    hasPermission: permissions.hasPermission,
    canView: permissions.canView,
    canCreate: permissions.canCreate,
    canEdit: permissions.canEdit,
    canDelete: permissions.canDelete
  }
}

// Hook combiné pour le panier
export const useCart = () => {
  return useCartStore()
}

// Hook combiné pour les favoris
export const useFavorites = () => {
  return useFavoritesStore()
}