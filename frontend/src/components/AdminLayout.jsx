// frontend/src/components/AdminLayout.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Clock, Tag, Users,
  TrendingUp, Truck, BarChart2, Star, Settings, Layers, Bell,
  LogOut, ExternalLink, Menu, X, ChevronRight
} from 'lucide-react';
import { usePermissionsStore } from '../stores';
import { useAuthNew } from '../context/AuthContextNew';

const ALL_MENU_ITEMS = [
  { path: '/admin/dashboard',       label: 'Dashboard',         icon: LayoutDashboard, module: null },
  { path: '/admin/orders',          label: 'Commandes',         icon: ShoppingCart,    module: 'orders' },
  { path: '/admin/products',        label: 'Produits',          icon: Package,         module: 'products' },
  { path: '/admin/categories',      label: 'Catégories',        icon: Layers,          module: 'categories' },
  { path: '/admin/stock',           label: 'Stock',             icon: BarChart2,       module: 'inventory' },
  { path: '/admin/purchase-orders', label: 'Bons commande',     icon: Truck,           module: 'purchase_orders' },
  { path: '/admin/suppliers',       label: 'Fournisseurs',      icon: Truck,           module: 'suppliers' },
  { path: '/admin/promotions',      label: 'Promotions',        icon: Tag,             module: 'promotions' },
  { path: '/admin/time-slots',      label: 'Créneaux',          icon: Clock,           module: 'timeslots' },
  { path: '/admin/users',           label: 'Utilisateurs',      icon: Users,           module: 'customers' },
  { path: '/admin/reports',         label: 'Rapports',          icon: TrendingUp,      module: 'reports' },
  { path: '/admin/reviews',         label: 'Avis',              icon: Star,            module: 'reviews' },
  { path: '/admin/notifications',   label: 'Notifications',     icon: Bell,            module: null },
  { path: '/admin/settings',        label: 'Paramètres',        icon: Settings,        module: 'settings' },
];

const AdminLayout = ({ children, title, subtitle, actions }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { canView } = usePermissionsStore();
  const { user } = useAuthNew();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = ALL_MENU_ITEMS.filter(item => !item.module || canView(item.module));

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 shadow-lg z-30
        transform transition-transform duration-300 ease-in-out flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:shadow-none lg:z-auto
      `}>
        {/* Logo sidebar */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-sky-700 text-lg">ParaClick</p>
            <p className="text-xs text-gray-500">{user?.role === 'EMPLOYE' ? 'Espace Employé' : 'Administration'}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-gray-100 rounded">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 border border-sky-100'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon size={17} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight size={14} className="ml-auto text-sky-500" />}
              </button>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div className="border-t border-gray-100 p-3 space-y-1">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            <ExternalLink size={16} />
            <span>Voir le site</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={16} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Burger mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu size={20} className="text-gray-600" />
            </button>

            {/* Titre */}
            <div className="flex-1 min-w-0">
              {title && (
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{title}</h1>
              )}
              {subtitle && (
                <p className="text-xs sm:text-sm text-gray-500 truncate hidden sm:block">{subtitle}</p>
              )}
            </div>

            {/* Actions header */}
            {actions && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {actions}
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
