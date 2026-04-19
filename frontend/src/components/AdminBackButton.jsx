import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminBackButton = ({ to = '/admin/dashboard', showLabel = true, className = '' }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className={`p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-200 flex items-center gap-2 group ${className}`}
      title="Retour au Tableau de Bord"
    >
      <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
      {showLabel && <span className="text-sm font-semibold hidden lg:inline">Dashboard</span>}
    </button>
  );
};

export default AdminBackButton;