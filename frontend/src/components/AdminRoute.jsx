// frontend/src/components/AdminRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../stores';
import { usePermissions } from '../context/PermissionsContext';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Mapping chemin → clé module
const PATH_TO_MODULE = {
  '/admin/products':          'products',
  '/admin/categories':        'categories',
  '/admin/orders':            'orders',
  '/admin/promotions':        'promotions',
  '/admin/time-slots':        'timeslots',
  '/admin/users':             'customers',
  '/admin/reports':           'reports',
  '/admin/suppliers':         'suppliers',
  '/admin/purchase-orders':   'purchase_orders',
  '/admin/supplier-discounts':'supplier_discounts',
  '/admin/stock':             'inventory',
  '/admin/reviews':           'reviews',
  '/admin/settings':          'settings',
};

const AccessDenied = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl shadow-lg p-10 max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldOff size={32} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h1>
        <p className="text-gray-500 mb-6">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          Contactez l'administrateur.
        </p>
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-sky-700 text-white rounded-lg hover:bg-sky-800 transition-colors"
        >
          <ArrowLeft size={16} /> Retour au dashboard
        </button>
      </div>
    </div>
  );
};

const AdminRoute = ({ children }) => {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { canView, loading: permLoading } = usePermissions();
  const location = useLocation();

  if (authLoading || permLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const isAdmin  = user?.role === 'ADMIN';
  const isEmploye = user?.role === 'EMPLOYE';

  if (!isAdmin && !isEmploye) {
    return <Navigate to="/" replace />;
  }

  // Employé sur le dashboard → laisser accéder (menu filtré selon permissions)

  // Vérifier la permission canView pour la page courante (employés seulement)
  if (isEmploye) {
    const module = Object.entries(PATH_TO_MODULE).find(([path]) =>
      location.pathname.startsWith(path)
    )?.[1];

    if (module && !canView(module)) {
      return <AccessDenied />;
    }
  }

  return children;
};

export default AdminRoute;
