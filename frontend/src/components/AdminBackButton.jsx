import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';

const AdminBackButton = ({ to = '/admin/dashboard', showLabel = true, className = '' }) => {
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate(to)}
      className={`group ${className}`}
      title="Retour au Tableau de Bord"
    >
      <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
      {showLabel && <span className="font-semibold hidden lg:inline">Dashboard</span>}
    </Button>
  );
};

export default AdminBackButton;