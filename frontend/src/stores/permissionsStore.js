import { create } from 'zustand'

const usePermissionsStore = create((set, get) => ({
  // État
  permissions: {},
  loading: false,
  error: null,

  // Actions
  setPermissions: (permissions) => set({ permissions, error: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  loadPermissions: async (userId) => {
    set({ loading: true, error: null })
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/employee-permissions/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const permissionsMap = {}
        
        data.permissions.forEach(perm => {
          permissionsMap[perm.module] = {
            canView: perm.canView,
            canCreate: perm.canCreate,
            canEdit: perm.canEdit,
            canDelete: perm.canDelete
          }
        })

        set({ 
          permissions: permissionsMap, 
          loading: false,
          error: null 
        })
      } else {
        const data = await response.json()
        set({ 
          error: data.message, 
          loading: false 
        })
      }
    } catch (error) {
      set({ 
        error: 'Erreur lors du chargement des permissions', 
        loading: false 
      })
    }
  },

  updatePermissions: async (userId, module, permissions) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/employee-permissions/${userId}/${module}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(permissions)
      })

      if (response.ok) {
        // Mettre à jour localement
        const { permissions: currentPerms } = get()
        set({
          permissions: {
            ...currentPerms,
            [module]: permissions
          },
          error: null
        })
        return { success: true }
      } else {
        const data = await response.json()
        set({ error: data.message })
        return { success: false, error: data.message }
      }
    } catch (error) {
      const errorMsg = 'Erreur lors de la mise à jour'
      set({ error: errorMsg })
      return { success: false, error: errorMsg }
    }
  },

  clearPermissions: () => set({ 
    permissions: {}, 
    error: null 
  }),

  // Getters
  hasPermission: (module, action) => {
    const { permissions } = get()
    return permissions[module]?.[action] || false
  },

  canView: (module) => get().hasPermission(module, 'canView'),
  canCreate: (module) => get().hasPermission(module, 'canCreate'),
  canEdit: (module) => get().hasPermission(module, 'canEdit'),
  canDelete: (module) => get().hasPermission(module, 'canDelete'),

  getModulePermissions: (module) => {
    const { permissions } = get()
    return permissions[module] || {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false
    }
  },

  getAllPermissions: () => get().permissions,

  hasAnyPermission: (module) => {
    const modulePerms = get().getModulePermissions(module)
    return Object.values(modulePerms).some(perm => perm === true)
  }
}))

export default usePermissionsStore