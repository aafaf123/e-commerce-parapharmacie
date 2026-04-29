// frontend/src/context/PermissionsContext.jsx
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import adminAxios from '../api/adminAxios';
import { useAuth } from './AuthContext';

const PermissionsContext = createContext(null);

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider');
  return ctx;
};

export const PermissionsProvider = ({ children }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState(null); // null = pas encore chargé
  const [loading, setLoading] = useState(true);
  const lastFetchedId = useRef(null); // évite les appels dupliqués

  const userId = user?.id || null;
  const userRole = user?.role || null;

  useEffect(() => {
    // Pas d'utilisateur connecté
    if (!userId) {
      setPermissions({});
      setLoading(false);
      lastFetchedId.current = null;
      return;
    }

    // Déjà chargé pour cet utilisateur → ne pas refaire
    if (lastFetchedId.current === userId) return;
    lastFetchedId.current = userId;

    // Admin → tous les droits sans appel API
    if (userRole === 'ADMIN') {
      setPermissions('ADMIN');
      setLoading(false);
      return;
    }

    // Employé → charger depuis l'API
    if (userRole === 'EMPLOYE') {
      setLoading(true);
      adminAxios.get('/employees/permissions/my')
        .then(({ data }) => setPermissions(data.permissions || {}))
        .catch(() => setPermissions({}))
        .finally(() => setLoading(false));
      return;
    }

    // Autre rôle (CLIENT, etc.)
    setPermissions({});
    setLoading(false);
  }, [userId, userRole]); // primitives stables → pas de boucle

  const can = (module, action = 'canView') => {
    if (!permissions) return false;
    if (permissions === 'ADMIN') return true;
    return permissions[module]?.[action] === true;
  };

  const canView   = (module) => can(module, 'canView');
  const canCreate = (module) => can(module, 'canCreate');
  const canEdit   = (module) => can(module, 'canEdit');
  const canDelete = (module) => can(module, 'canDelete');

  const refetch = () => {
    lastFetchedId.current = null; // forcer un rechargement
    if (userId) {
      setLoading(true);
      adminAxios.get('/employees/permissions/my')
        .then(({ data }) => setPermissions(data.permissions || {}))
        .catch(() => setPermissions({}))
        .finally(() => setLoading(false));
    }
  };

  return (
    <PermissionsContext.Provider value={{ permissions, loading, can, canView, canCreate, canEdit, canDelete, refetch }}>
      {children}
    </PermissionsContext.Provider>
  );
};
