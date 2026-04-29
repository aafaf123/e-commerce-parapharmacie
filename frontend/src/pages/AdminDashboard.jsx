import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, ShoppingCart, DollarSign, Package, Clock, AlertTriangle,
  TrendingUp, Calendar, Users, LogOut, Bell, RefreshCw, Tag, Radio,
  Grid3x3, Layers, Truck, ExternalLink, Star, BarChart2, Settings
} from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import api from '../api/axios';
import adminApi from '../api/adminAxios';
import AdminNotifications from '../components/AdminNotifications';
import { useAdminWebSocket } from '../context/AdminWebSocketContext';
import { usePermissions } from '../context/PermissionsContext';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isConnected, stats, notificationCount, clearNotifications } = useAdminWebSocket();
  const { canView, loading: permissionsLoading } = usePermissions();

  // Menu dynamique — filtré selon les permissions
  const ALL_MENU_ITEMS = [
    { path: '/admin/products',        label: 'Produits',          icon: Grid3x3,    module: 'products' },
    { path: '/admin/categories',      label: 'Catégories',        icon: Layers,     module: 'categories' },
    { path: '/admin/orders',          label: 'Commandes',         icon: ShoppingCart, module: 'orders' },
    { path: '/admin/promotions',      label: 'Promotions',        icon: Tag,        module: 'promotions' },
    { path: '/admin/time-slots',      label: 'Créneaux',          icon: Clock,      module: 'timeslots' },
    { path: '/admin/users',           label: 'Utilisateurs',      icon: Users,      module: 'customers' },
    { path: '/admin/reports',         label: 'Rapports',          icon: TrendingUp, module: 'reports' },
    { path: '/admin/suppliers',       label: 'Fournisseurs',      icon: Truck,      module: 'suppliers' },
    { path: '/admin/purchase-orders', label: 'Bons de commande',  icon: Package,    module: 'purchase_orders' },
    { path: '/admin/stock',           label: 'Stock',             icon: BarChart2,  module: 'inventory' },
    { path: '/admin/reviews',         label: 'Avis clients',      icon: Star,       module: 'reviews' },
    { path: '/admin/settings',        label: 'Paramètres',        icon: Settings,   module: 'settings' },
  ];
  const menuItems = ALL_MENU_ITEMS.filter(item => canView(item.module));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const [kpis, setKpis] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [urgentOrders, setUrgentOrders] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [salesPeriod, setSalesPeriod] = useState('30d');
  const [stockThreshold, setStockThreshold] = useState(10);
  const [urgentTimeframe, setUrgentTimeframe] = useState(2);
  const [expiryThreshold, setExpiryThreshold] = useState(3);
  const [expiringProducts, setExpiringProducts] = useState([]);
  const [urgentLastUpdate, setUrgentLastUpdate] = useState(null);
  const [dataErrors, setDataErrors] = useState([]);
  const [persistentNotificationCount, setPersistentNotificationCount] = useState(0);

  // frontend/src/pages/AdminDashboard.jsx
// Remplacer la vérification du token admin

  useEffect(() => {
    // Configurer axios avec le token normal (déjà vérifié par AdminRoute)
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    fetchAllData();
  }, []);

  // Refresh urgent orders when timeframe changes
  useEffect(() => {
    fetchUrgentOrders();
    
    const urgentInterval = setInterval(fetchUrgentOrders, 60000);
    return () => clearInterval(urgentInterval);
  }, [urgentTimeframe]);

  useEffect(() => {
    fetchSalesChart();
    
    // Auto-refresh chart every hour
    const chartInterval = setInterval(fetchSalesChart, 3600000);
    return () => clearInterval(chartInterval);
  }, [salesPeriod]);

  // Refresh low stock products when threshold changes
  useEffect(() => {
    fetchLowStockProducts();
  }, [stockThreshold]);

  // Refresh expiring products when threshold changes
  useEffect(() => {
    fetchExpiringProducts();
  }, [expiryThreshold]);
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Charger les données en parallèle mais gérer les erreurs individuellement
      const promises = [
        fetchKPIs().catch(error => {
          console.error('Erreur chargement KPIs:', error);
          setKpis(null);
        }),
        fetchSalesChart().catch(error => {
          console.error('Erreur chargement graphique ventes:', error);
          setSalesData([]);
        }),
        fetchUrgentOrders().catch(error => {
          console.error('Erreur chargement commandes urgentes:', error);
          setUrgentOrders([]);
        }),
        fetchLowStockProducts().catch(error => {
          console.error('Erreur chargement produits stock faible:', error);
          setLowStockProducts([]);
        }),
        fetchExpiringProducts().catch(error => {
          console.error('Erreur chargement produits expirants:', error);
          setExpiringProducts([]);
        }),
        fetchHeatmap().catch(error => {
          console.error('Erreur chargement heatmap:', error);
          setHeatmapData([]);
        }),
        fetchPersistentNotificationCount().catch(error => {
          console.error('Erreur chargement notifications persistantes:', error);
          setPersistentNotificationCount(0);
        })
      ];

      await Promise.all(promises);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Ne rediriger que si c'est vraiment une erreur d'authentification
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        navigate('/login');
      }
      // Pour 403, afficher un message mais ne pas rediriger
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  const fetchKPIs = async () => {
    const { data } = await adminApi.get('/kpis');
    setKpis(data);
  };

  const fetchSalesChart = async () => {
    const { data } = await adminApi.get(`/sales-chart?period=${salesPeriod}`);
    setSalesData(data);
  };

  const fetchUrgentOrders = async () => {
    const { data } = await adminApi.get(`/urgent-orders?hours=${urgentTimeframe}`);
    setUrgentOrders(data);
  };

  const fetchLowStockProducts = async () => {
    const { data } = await adminApi.get(`/low-stock-products?threshold=${stockThreshold}`);
    setLowStockProducts(data);
  };

  const fetchExpiringProducts = async () => {
    const { data } = await adminApi.get(`/expiring-products?months=${expiryThreshold}`);
    setExpiringProducts(data);
  };

  const fetchHeatmap = async () => {
    const { data } = await adminApi.get('/heatmap-slots?days=30');
    setHeatmapData(data);
  };

  const fetchPersistentNotificationCount = async () => {
    const { data } = await adminApi.get('/notifications/unread-count');
    setPersistentNotificationCount(data.count);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/login');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(isAr ? 'ar-MA' : 'fr-MA', {
      style: 'currency',
      currency: 'MAD'
    }).format(amount);
  };

  const getHeatmapColor = (count) => {
    if (count === 0) return '#f3f4f6';
    if (count <= 2) return '#dbeafe';
    if (count <= 5) return '#93c5fd';
    if (count <= 10) return '#3b82f6';
    return '#1e40af';
  };

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sky-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('admin.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* AdminNotifications */}
      <AdminNotifications />

      {/* Afficher les erreurs de données si présentes */}
      {dataErrors.length > 0 && (
        <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">
            ⚠️ {t('admin.data_error')}
          </p>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowListMenu((prev) => !prev)}
                className="text-sky-700 hover:text-sky-900"
                title={isAr ? 'فتح القائمة' : 'Ouvrir le menu'}
              >
                <LayoutDashboard size={28} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('admin.dashboard_title')}</h1>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600">Parapharmacie ParaClick{user?.role === 'EMPLOYE' ? ` • Employé : ${user.firstName} ${user.lastName}` : ''}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title={isAr ? 'تحديث' : 'Actualiser'}
              >
                <RefreshCw size={20} className={`text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              <LanguageSwitcher />

              <button
                onClick={() => {
                  localStorage.removeItem('lastVisitedPath')
                  setShowListMenu(false)
                  navigate('/')
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors"
              >
                <ExternalLink size={16} />
                <span className="hidden sm:inline">{t('admin.view_site')}</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">{t('admin.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex">
        {/* Sidebar */}
        {showListMenu && (
          <aside
            className="w-64 bg-white border-r border-gray-200 shadow-sm flex-shrink-0"
          >
            <nav className="flex flex-col gap-1 p-4">
              {menuItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setShowListMenu(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 rounded-lg text-sm"
                  >
                    <Icon size={16} /> {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPIs Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Commandes du jour */}
          {canView('orders') && (
            <div 
              onClick={() => navigate('/admin/orders')}
              className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500 relative cursor-pointer hover:bg-blue-50 transition-colors"
            >
              {stats.newOrders > 0 && (
                <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                  +{stats.newOrders}
                </div>
              )}
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart size={24} className="text-blue-500" />
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">Aujourd'hui</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{kpis?.ordersToday || 0}</p>
              <p className="text-sm text-gray-600 mt-1">Commandes du jour</p>
            </div>
          )}

          {/* CA Journalier */}
          {canView('reports') && (
            <div 
              onClick={() => navigate('/admin/reports')}
              className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500 cursor-pointer hover:bg-green-50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <DollarSign size={24} className="text-green-500" />
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">Jour</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(kpis?.dailyRevenue || 0)}</p>
              <p className="text-sm text-gray-600 mt-1">CA journalier</p>
            </div>
          )}

          {/* CA Mensuel */}
          {canView('reports') && (
            <div 
              onClick={() => navigate('/admin/reports')}
              className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500 cursor-pointer hover:bg-purple-50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <TrendingUp size={24} className="text-purple-500" />
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">Mois</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(kpis?.monthlyRevenue || 0)}</p>
              <p className="text-sm text-gray-600 mt-1">CA mensuel</p>
            </div>
          )}

          {/* Créneaux réservés */}
          {canView('timeslots') && (
            <div 
              onClick={() => navigate('/admin/time-slots')}
              className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500 relative cursor-pointer hover:bg-orange-50 transition-colors"
            >
              {stats.pendingOrders > 0 && (
                <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold animate-pulse">
                  {stats.pendingOrders}
                </div>
              )}
              <div className="flex items-center justify-between mb-2">
                <Clock size={24} className="text-orange-500" />
                <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded">Aujourd'hui</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{kpis?.slotsReservedToday || 0}</p>
              <p className="text-sm text-gray-600 mt-1">Créneaux réservés</p>
            </div>
          )}
        </div>

        {/* Alertes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Stock faible */}
          {kpis?.lowStock > 0 && (
            <div 
              onClick={() => navigate('/admin/products?filter=low-stock')}
              className="bg-orange-50 border border-orange-200 rounded-xl p-4 cursor-pointer hover:bg-orange-100 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={24} className="text-orange-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="font-semibold text-orange-900">{t('admin.low_stock')}</p>
                  <p className="text-sm text-orange-700">{t('admin.low_stock_desc', { count: kpis.lowStock })}</p>
                </div>
              </div>
            </div>
          )}

          {/* Rupture de stock */}
          {kpis?.outOfStock > 0 && (
            <div 
              onClick={() => navigate('/admin/products?filter=out-of-stock')}
              className="bg-red-50 border border-red-200 rounded-xl p-4 cursor-pointer hover:bg-red-100 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <Package size={24} className="text-red-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="font-semibold text-red-900">{t('admin.out_of_stock')}</p>
                  <p className="text-sm text-red-700">{t('admin.out_of_stock_desc', { count: kpis.outOfStock })}</p>
                </div>
              </div>
            </div>
          )}

          {/* Commandes non traitées */}
          {kpis?.pendingOrders > 0 && (
            <div 
              onClick={() => navigate('/admin/orders?status=RECEIVED')}
              className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 cursor-pointer hover:bg-yellow-100 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <Bell size={24} className="text-yellow-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="font-semibold text-yellow-900">Commandes en attente</p>
                  <p className="text-sm text-yellow-700">{kpis.pendingOrders} commande(s) non traitée(s)</p>
                </div>
              </div>
            </div>
          )}

          {/* Notifications persistantes */}
          {persistentNotificationCount > 0 && (
            <div
              onClick={() => navigate('/admin/notifications')}
              className="bg-purple-50 border border-purple-200 rounded-xl p-4 cursor-pointer hover:bg-purple-100 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <Bell size={24} className="text-purple-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="font-semibold text-purple-900">Notifications système</p>
                  <p className="text-sm text-purple-700">{persistentNotificationCount} notification(s) non lue(s)</p>
                  <p className="text-xs text-purple-600 mt-1">Cliquez pour consulter</p>
                </div>
              </div>
            </div>
          )}

          {/* Notifications temps réel */}
          {notificationCount > 0 && (
            <div
              onClick={() => clearNotifications()}
              className="bg-blue-50 border border-blue-200 rounded-xl p-4 cursor-pointer hover:bg-blue-100 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <Bell size={24} className="text-blue-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="font-semibold text-blue-900">Notifications temps réel</p>
                  <p className="text-sm text-blue-700">{notificationCount} notification(s) active(s)</p>
                  <p className="text-xs text-blue-600 mt-1">Cliquez pour effacer</p>
                </div>
              </div>
            </div>
          )}

          {/* Alertes Péremption */}
          {kpis?.expiringSoon > 0 && (
            <div 
              onClick={() => navigate('/admin/products?filter=expiring')}
              className="bg-purple-50 border border-purple-200 rounded-xl p-4 cursor-pointer hover:bg-purple-100 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <Calendar size={24} className="text-purple-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="font-semibold text-purple-900">{t('admin.expiring_soon')}</p>
                  <p className="text-sm text-purple-700">{t('admin.expiring_soon_desc', { count: kpis.expiringSoon })}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Graphique des ventes */}
        <ProtectedRoute module="reports" showMessage={false}>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Évolution des ventes</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSalesPeriod('7d')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    salesPeriod === '7d' 
                      ? 'bg-sky-100 text-sky-700 border border-sky-300' 
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  7 jours
                </button>
                <button
                  onClick={() => setSalesPeriod('30d')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    salesPeriod === '30d' 
                      ? 'bg-sky-100 text-sky-700 border border-sky-300' 
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  30 jours
                </button>
                <button
                  onClick={() => setSalesPeriod('12m')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    salesPeriod === '12m' 
                      ? 'bg-sky-100 text-sky-700 border border-sky-300' 
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  12 mois
                </button>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0369a1"
                  strokeWidth={2}
                  name="Chiffre d'affaires (DH)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="orders"
                  stroke="#16a34a"
                  strokeWidth={2}
                  name="Nombre de commandes"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ProtectedRoute>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Commandes urgentes */}
          <ProtectedRoute module="orders" showMessage={false}>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Commandes urgentes</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={urgentTimeframe}
                    onChange={(e) => setUrgentTimeframe(Number(e.target.value))}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value={2}>Dans les 2h</option>
                    <option value={15}>Dans les 15h</option>
                    <option value={24}>Dans les 24h</option>
                  </select>
                </div>
              </div>

              {urgentOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock size={48} className="mx-auto text-gray-300 mb-2" />
                  <p>Aucune commande urgente</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {urgentOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => navigate(`/admin/orders?search=${order.orderNumber}`)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-sky-300 transition-colors cursor-pointer group hover:bg-sky-50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                          <p className="text-sm text-gray-600">
                            {order.user?.firstName} {order.user?.lastName}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            order.status === 'RECEIVED'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {order.status === 'RECEIVED' ? 'Reçue' : 'En préparation'}
                          </span>
                          {order.minutesUntilSlot !== undefined && (
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                              order.minutesUntilSlot <= 30
                                ? 'bg-red-100 text-red-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              ⏰ {order.minutesUntilSlot < 60
                                ? `${order.minutesUntilSlot} min`
                                : `${Math.floor(order.minutesUntilSlot / 60)}h${order.minutesUntilSlot % 60 > 0 ? String(order.minutesUntilSlot % 60).padStart(2,'0') : ''}`
                              }
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock size={16} />
                        <span>
                          {new Date(order.timeSlotDate).toLocaleDateString('fr-FR')} à {order.timeSlotStart}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-2">
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ProtectedRoute>

          {/* Produits en stock faible */}
          <ProtectedRoute module="inventory" showMessage={false}>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Stock faible</h2>
                <select
                  value={stockThreshold}
                  onChange={(e) => setStockThreshold(Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                >
                  <option value={5}>≤ 5 unités</option>
                  <option value={10}>≤ 10 unités</option>
                  <option value={15}>≤ 15 unités</option>
                  <option value={20}>≤ 20 unités</option>
                </select>
              </div>

              {lowStockProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package size={48} className="mx-auto text-gray-300 mb-2" />
                  <p>Aucun produit en stock faible</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {lowStockProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => navigate(`/admin/products?filter=low-stock`)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-sky-300 transition-colors cursor-pointer group hover:bg-sky-50"
                    >
                      <div className="flex items-center gap-3">
                        {product.image && (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm">{product.name}</p>
                          <p className="text-xs text-gray-600">{product.brand}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            product.stock === 0
                              ? 'text-red-600'
                              : product.stock <= 5
                              ? 'text-orange-600'
                              : 'text-yellow-600'
                          }`}>
                            {product.stock}
                          </p>
                          <p className="text-xs text-gray-500">en stock</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ProtectedRoute>

          {/* Suivi des expirations */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{t('admin.expiring_title')}</h2>
              <select
                value={expiryThreshold}
                onChange={(e) => setExpiryThreshold(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
              >
                <option value={1}>{t('admin.months_threshold', { n: 1 })}</option>
                <option value={2}>{t('admin.months_threshold', { n: 2 })}</option>
                <option value={3}>{t('admin.months_threshold', { n: 3 })}</option>
              </select>
            </div>

            {expiringProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar size={48} className="mx-auto text-gray-300 mb-2" />
                <p>{t('admin.no_expiring')}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {expiringProducts.map((product) => {
                  const daysLeft = Math.ceil((new Date(product.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                  return (
                    <div
                      key={product.id}
                      onClick={() => navigate(`/admin/products?filter=expiring`)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors cursor-pointer group hover:bg-purple-50"
                    >
                      <div className="flex items-center gap-3">
                        {product.image && (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm">{product.name}</p>
                          <p className="text-xs text-gray-600">{t('admin.expires_on')} {new Date(product.expiryDate).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            daysLeft <= 30
                              ? 'text-red-600'
                              : daysLeft <= 60
                              ? 'text-orange-600'
                              : 'text-purple-600'
                          }`}>
                            {daysLeft}
                          </p>
                          <p className="text-xs text-gray-500">{t('admin.days_left')}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Carte thermique des créneaux */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t('admin.heatmap_title')}</h2>
          
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="grid grid-cols-[100px_repeat(20,40px)] gap-1">
                {/* Header avec les heures */}
                <div></div>
                {Array.from({ length: 20 }, (_, i) => {
                  const hour = Math.floor(i / 2) + 9;
                  const minute = i % 2 === 0 ? '00' : '30';
                  return (
                    <div key={i} className="text-xs text-center text-gray-600 font-medium">
                      {hour}:{minute}
                    </div>
                  );
                })}

                {/* Lignes pour chaque jour */}
                {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map((dayKey, dayIdx) => {
                  const dayLabels = isAr
                    ? ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
                    : ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
                  const dayDisplay = dayLabels[dayIdx]
                  return (
                  <React.Fragment key={dayKey}>
                    <div className="text-sm font-medium text-gray-700 flex items-center">
                      {dayDisplay}
                    </div>
                    {Array.from({ length: 20 }, (_, i) => {
                      const hour = Math.floor(i / 2) + 9;
                      const minute = i % 2 === 0 ? '00' : '30';
                      const timeStr = `${String(hour).padStart(2, '0')}:${minute}`;
                      const slot = heatmapData.find(s => s.day === dayKey && s.time === timeStr);
                      const count = slot?.count || 0;
                      
                      return (
                        <div
                          key={`${dayKey}-${i}`}
                          className="h-10 rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center"
                          style={{ backgroundColor: getHeatmapColor(count) }}
                          title={`${dayDisplay} ${timeStr}: ${count} ${t('admin.reservations')}`}
                        >
                          {count > 0 && (
                            <span className="text-xs font-medium text-white">{count}</span>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Légende */}
          <div className="flex items-center gap-4 mt-6 justify-center">
            <span className="text-sm text-gray-600">{t('admin.less_frequent')}</span>
            <div className="flex gap-1">
              {[0, 2, 5, 10, 15].map((count) => (
                <div
                  key={count}
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: getHeatmapColor(count) }}
                />
              ))}
            </div>
            <span className="text-sm text-gray-600">{t('admin.more_frequent')}</span>
          </div>
        </div>
          </div>


        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;