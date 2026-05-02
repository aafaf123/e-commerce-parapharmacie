import { usePermissionsStore } from '../stores';
import Button from './ui/Button';

const PermissionButton = ({ children, module, action = 'canView', variant, size, className = '', disabled = false, ...props }) => {
  const { canView, canCreate, canEdit, canDelete } = usePermissionsStore();
  const actions = { canView, canCreate, canEdit, canDelete };
  if (!actions[action]?.(module)) return null;
  return (
    <Button variant={variant} size={size} className={className} disabled={disabled} {...props}>
      {children}
    </Button>
  );
};

export default PermissionButton;
