import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

const AdminSessionIndicator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Vérifier si c'est une session admin active
  const adminSessionActive = localStorage.getItem('adminSessionActive') === 'true';
  const isAdminRole = user && ['ADMIN', 'EMPLOYE', 'PREPARATEUR', 'CAISSIER'].includes(user.role);

  if (!adminSessionActive || !isAdminRole) return null;

  const handleReturnToAdmin = () => {
    const returnPath = localStorage.getItem('adminReturnPath');
    localStorage.removeItem('adminSessionActive');
    localStorage.removeItem('adminReturnPath');
    
    // Déterminer la page de retour selon le rôle
    if (user.role === 'ADMIN') {
      navigate(returnPath || '/admin/dashboard');
    } else if (user.role === 'EMPLOYE' || user.role === 'PREPARATEUR' || user.role === 'CAISSIER') {
      navigate('/admin/employee');
    } else {
      navigate('/admin/dashboard');
    }
  };

  const getRoleLabel = () => {
    switch (user.role) {
      case 'ADMIN': return 'Administrateur';
      case 'EMPLOYE': return 'Employé';
      case 'PREPARATEUR': return 'Préparateur';
      case 'CAISSIER': return 'Caissier';
      default: return 'Staff';
    }
  };

  return (
    <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white px-4 py-2 shadow-lg z-40 relative">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-sky-200" />
          <div>
            <p className="text-sm font-medium">
              Session {getRoleLabel()} active
            </p>
            <p className="text-xs text-sky-200">
              Connecté en tant que {user.firstName} {user.lastName}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleReturnToAdmin}
          className="flex items-center gap-2 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Retour admin
        </button>
      </div>
    </div>
  );
};

export default AdminSessionIndicator;