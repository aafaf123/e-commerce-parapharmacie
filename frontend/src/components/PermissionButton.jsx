import React from 'react';
import { useEmployeePermissions } from '../hooks/useEmployeePermissions';

const PermissionButton = ({ 
  children, 
  module, 
  action = 'canView', 
  className = '',
  disabled = false,
  ...props 
}) => {
  const { hasPermission, loading } = useEmployeePermissions();

  if (loading) {
    return (
      <button 
        className={`${className} opacity-50 cursor-not-allowed`} 
        disabled={true}
        {...props}
      >
        {children}
      </button>
    );
  }

  if (!hasPermission(module, action)) {
    return null; // Ne pas afficher le bouton si pas de permission
  }

  return (
    <button 
      className={className} 
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default PermissionButton;