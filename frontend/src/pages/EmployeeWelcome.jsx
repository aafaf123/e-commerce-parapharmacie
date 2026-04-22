import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Clock,
  Bell, LogOut, ExternalLink, AlertTriangle,
  RefreshCw, Star, Users, Clock3, AlertCircle, CheckCircle, Truck, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEmployeeDashboard } from '../context/EmployeeDashboardContext';

const menuItems = [
  { path: '/admin/products', label: 'Produits', icon: Package },
  { path: '/admin/categories', label: 'Catégories', icon: LayoutDashboard },
  { path: '/admin/orders', label: 'Commandes', icon: ShoppingCart },
  { path: '/admin/reviews', label: 'Avis', icon: Star },
  { path: '/admin/stock', label: 'Stock', icon: Clock },
  { path: '/admin/schedule', label: 'Créneaux', icon: Clock3 },
  { path: '/admin/purchase-orders', label: 'Achat', icon: Truck },
];

const EmployeeWelcome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const {
    isConnected,
    stats,
    notifications,
    recentOrders,
    lowStockProducts,
    urgentOrders,
    lastUpdate,
    refreshAll
  } = useEmployeeDashboard();

  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [deniedMessage, setDeniedMessage] = useState('');

  useEffect(() => {
    const storedMessage = sessionStorage.getItem('accessDeniedMessage');
    if (storedMessage) {
      setDeniedMessage(storedMessage);
      setShowAccessDenied(true);
      sessionStorage.removeItem('accessDeniedMessage');
    }
  }, []);

  const handleMenuClick = (path) => {
    setDeniedMessage('');
    setShowAccessDenied(false);
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getUrgencyClass = (order) => {
    const mins = order.minutesUntilSlot;
    if (mins < 60) return 'text-red-600 bg-red-50 border-red-200';
    if (mins < 120) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  };

  const getUrgencyLabel = (order) => {
    const mins = order.minutesUntilSlot;
    if (mins < 60) return 'Urgent (<1h)';
    if (mins < 120) return 'Bientôt (<2h)';
    return `Dans ${Math.floor(mins/60)}h`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Espace Employé</h1>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600">ParaClick • Dernière sync: {formatTime(lastUpdate)}</p>
                  <span className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {isConnected ? 'Connecté' : 'Déconnecté'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  localStorage.removeItem('lastVisitedPath');
                  navigate('/');
                }}
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors border border-gray-200"
              >
                <ExternalLink size={16} />
                <span>Voir le site</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Menu Horizontal */}
      <div className="bg-gray-100 border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex items-center gap-1 py-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => handleMenuClick(item.path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sky-700 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                  title={item.label}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
            {/* Bouton refresh manuel */}
            <button
              onClick={refreshAll}
              className="ml-auto flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
              title="Rafraîchir"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Commandes en attente - cliquable */}
          <button
            onClick={() => navigate('/admin/orders')}
            className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-sky-300 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500 group-hover:text-sky-600 transition-colors">Commandes en attente</p>
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <ShoppingCart size={18} className="text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 group-hover:text-sky-600 transition-colors">{stats.pendingOrders || recentOrders.length}</p>
            <p className="text-xs text-gray-500 mt-1">À traiter aujourd'hui</p>
          </button>

          {/* Nouvelles commandes - cliquable */}
          <button
            onClick={() => navigate('/admin/orders')}
            className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-sky-300 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500 group-hover:text-sky-600 transition-colors">Nouvelles commandes</p>
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <CheckCircle size={18} className="text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 group-hover:text-sky-600 transition-colors">{stats.newOrders || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Aujourd'hui</p>
          </button>

          {/* Stock critique - cliquable */}
          <button
            onClick={() => navigate('/admin/stock')}
            className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-sky-300 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500 group-hover:text-sky-600 transition-colors">Stock critique</p>
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
                <AlertCircle size={18} className="text-red-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 group-hover:text-sky-600 transition-colors">{lowStockProducts.length}</p>
            <p className="text-xs text-gray-500 mt-1">Produits sous le seuil</p>
          </button>

          {/* Commandes urgentes - cliquable */}
          <button
            onClick={() => navigate('/admin/orders')}
            className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-sky-300 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500 group-hover:text-sky-600 transition-colors">Commandes urgentes</p>
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <Clock3 size={18} className="text-orange-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 group-hover:text-sky-600 transition-colors">{urgentOrders.length}</p>
            <p className="text-xs text-gray-500 mt-1">Retrait &lt; 2 heures</p>
          </button>
        </div>

        {/* Notificationsalertes rapides */}
        {notifications.length > 0 && (
          <div className="mb-6 p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-3">
            <Bell size={24} className="text-sky-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-sky-900">Notifications</p>
              <p className="text-xs text-sky-700">Vous avez {notifications.length} notification(s) non lue(s)</p>
            </div>
            <button
              onClick={() => navigate('/admin/orders')}
              className="px-3 py-1.5 text-xs bg-sky-700 text-white rounded-lg hover:bg-sky-800"
            >
              Voir
            </button>
          </div>
        )}

        {/* 2 colonnes : Dernières commandes + Alertes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Dernières commandes reçues */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart size={20} className="text-sky-600" />
                Dernières commandes
              </h3>
              <button
                onClick={() => navigate('/admin/orders')}
                className="text-sm text-sky-600 hover:text-sky-700 font-medium"
              >
                Voir tout
              </button>
            </div>

            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart size={40} className="mx-auto mb-2 text-gray-300" />
                <p>Aucune commande récente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.slice(0, 8).map((order) => (
                  <div
                    key={order.id}
                    className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate('/admin/orders')}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900">{order.orderNumber || 'ORD-...'}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        order.status === 'RECEIVED' ? 'bg-yellow-100 text-yellow-700' :
                        order.status === 'PREPARING' ? 'bg-blue-100 text-blue-700' :
                        order.status === 'READY' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {order.status || 'RECEIVED'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{order.user?.firstName || 'Client'} {order.user?.lastName?.charAt(0) || ''}.</span>
                      <span className="font-medium">{order.total?.toFixed(2) || 0} DH</span>
                    </div>
                    {order.items && (
                      <p className="text-xs text-gray-500 mt-1">{order.items.length} article(s)</p>
                    )}
                    {order.timeSlotDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        📅 {new Date(order.timeSlotDate).toLocaleDateString('fr-FR')} à {order.timeSlotStart}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alertes - Produits en rupture / urgent */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle size={20} className="text-red-600" />
                Alertes & Ruptures
              </h3>
              <button
                onClick={() => navigate('/admin/stock')}
                className="text-sm text-sky-600 hover:text-sky-700 font-medium"
              >
                Voir tout
              </button>
            </div>

            {lowStockProducts.length === 0 && urgentOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle size={40} className="mx-auto mb-2 text-green-500" />
                <p>Tout est en ordre</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Produits en stock bas - Tableau */}
                {lowStockProducts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Produits en stock critique</h4>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Marque</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Seuil</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {lowStockProducts.slice(0, 4).map((product, idx) => (
                            <tr key={`stock-${idx}`} className="hover:bg-gray-50 align-top">
                              <td className="px-4 py-2 align-top">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 flex-shrink-0 bg-gray-100 rounded flex items-center justify-center">
                                    {product.image ? (
                                      <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded" />
                                    ) : (
                                      <Package size={14} className="text-gray-400" />
                                    )}
                                  </div>
                                  <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]" title={product.name}>{product.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500 truncate max-w-[100px] align-top">{product.brand || '—'}</td>
                              <td className="px-4 py-2 text-center align-top">
                                <span className={`inline-flex items-center justify-center px-2 py-0.5 text-sm font-bold rounded-full min-w-[2.5rem] ${
                                  product.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {product.stock}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500 text-center align-top">{product.stockAlert || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Commandes urgentes - Tableau compact */}
                {urgentOrders.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Commandes urgentes</h4>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Commande</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Retrait</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Dans</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {urgentOrders.slice(0, 5).map((order) => (
                            <tr
                              key={`urgent-${order.id}`}
                              className={`hover:bg-gray-50 cursor-pointer align-top ${getUrgencyClass(order).split(' ')[0]}`}
                              onClick={() => navigate('/admin/orders')}
                            >
                              <td className="px-4 py-2 align-top">
                                <span className="text-sm font-bold text-gray-900">{order.orderNumber}</span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500 align-top">{order.user?.firstName || 'Client'}</td>
                              <td className="px-4 py-2 text-sm text-gray-500 text-center align-top">
                                {order.timeSlotDate ? new Date(order.timeSlotDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'} à {order.timeSlotStart || '—'}
                              </td>
                              <td className="px-4 py-2 text-center align-top">
                                <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
                                  order.minutesUntilSlot < 60 ? 'bg-red-100 text-red-700' :
                                  order.minutesUntilSlot < 120 ? 'bg-orange-100 text-orange-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {getUrgencyLabel(order)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Commandes urgentes (pleine largeur) */}
        {urgentOrders.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock3 size={20} className="text-orange-600" />
                Commandes urgentes à préparer
              </h3>
              <button
                onClick={() => navigate('/admin/orders')}
                className="text-sm text-sky-600 hover:text-sky-700 font-medium"
              >
                Voir toutes les commandes
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {urgentOrders.map((order) => (
                <div
                  key={order.id}
                  className={`p-4 rounded-lg border-2 ${getUrgencyClass(order)} hover:shadow-md transition-shadow cursor-pointer`}
                  onClick={() => navigate('/admin/orders')}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-lg">{order.orderNumber}</p>
                      <p className="text-sm opacity-80">{order.user?.firstName} {order.user?.lastName?.charAt(0)}.</p>
                    </div>
                    <Clock3 size={20} className="flex-shrink-0" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Retrait:</span>
                      <span>{order.timeSlotDate ? new Date(order.timeSlotDate).toLocaleDateString('fr-FR') : 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Heure:</span>
                      <span>{order.timeSlotStart || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-current opacity-30">
                      <span className="font-medium">Total:</span>
                      <span className="font-bold">{order.total?.toFixed(2) || 0} DH</span>
                    </div>
                    {order.items && (
                      <p className="text-xs opacity-75">{order.items.length} article(s)</p>
                    )}
                  </div>
                  <div className="mt-3">
                    <span className="inline-block w-full text-center text-xs font-bold py-1 px-2 rounded bg-white bg-opacity-50">
                      {getUrgencyLabel(order)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dernière mise à jour */}
        {lastUpdate && (
          <div className="text-center mt-6">
            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <RefreshCw size={14} />
              Dernière mise à jour: {formatTime(lastUpdate)}
            </button>
          </div>
        )}
      </main>

      {/* Access Denied Modal */}
      {showAccessDenied && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle size={48} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Accès refusé</h3>
              <p className="text-gray-600 mb-6">
                {deniedMessage || "Vous n'avez pas les permissions nécessaires pour accéder à cette section."}
              </p>
              <button
                onClick={() => setShowAccessDenied(false)}
                className="w-full bg-sky-700 hover:bg-sky-800 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeWelcome;
