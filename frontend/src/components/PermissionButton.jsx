import { usePermissions } from '../context/PermissionsContext';
import Button from './ui/Button';

// Rend le bouton invisible si l'employé n'a pas la permission
// Usage: <PermissionButton module="products" action="canDelete" variant="danger" onClick={...}>Supprimer</PermissionButton>
const PermissionButton = ({ children, module, action = 'canView', variant, size, className = '', disabled = false, ...props }) => {
  const { can, loading } = usePermissions();

  if (loading) return null;
  if (!can(module, action)) return null;

  return (
    <Button variant={variant} size={size} className={className} disabled={disabled} {...props}>
      {children}
    </Button>
  );
};

export default PermissionButton;
