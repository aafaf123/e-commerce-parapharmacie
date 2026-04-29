import React from 'react';
import { useEmployeePermissions } from '../hooks/useEmployeePermissions';
import { AlertCircle, Lock } from 'lucide-react';

const ProtectedRoute = ({ 
  children, 
  module, 
  action = 'canView', 
  fallback = null,
  showMessage = true 
}) => {
  const { hasPermission, loading } = useEmployeePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Vérification des permissions...</span>
      </div>
    );
  }

  if (!hasPermission(module, action)) {
    if (fallback) {
      return fallback;
    }

    if (!showMessage) {
      return null;
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Lock className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Accès restreint</h3>
        <p className="text-gray-600 text-center">
          Vous n'avez pas les permissions nécessaires pour accéder à cette fonctionnalité.
        </p>
        <div className="mt-4 flex items-center text-sm text-gray-500">
          <AlertCircle className="h-4 w-4 mr-1" />
          Permission requise: {module} - {action}
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;