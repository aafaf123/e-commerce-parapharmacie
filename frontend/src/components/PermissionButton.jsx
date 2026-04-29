import { usePermissions } from '../context/PermissionsContext';

// Rend le bouton invisible si l'employé n'a pas la permission
// Usage: <PermissionButton module="products" action="canDelete" onClick={...}>Supprimer</PermissionButton>
const PermissionButton = ({ children, module, action = 'canView', className = '', disabled = false, ...props }) => {
  const { can, loading } = usePermissions();

  if (loading) return null;
  if (!can(module, action)) return null;

  return (
    <button className={className} disabled={disabled} {...props}>
      {children}
    </button>
  );
};

export default PermissionButton;
