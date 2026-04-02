import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, LineChart, TrendingUp, Download, Calendar,
  ArrowUp, ArrowDown, Package, DollarSign, Eye
} from 'lucide-react';
import {
  BarChart, Bar, LineChart as LineChartComponent, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import adminApi from '../api/adminAxios';

const AdminReports = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState('sales');
  const [salesData, setSalesData] = useState(null);
  const [productsData, setProductsData] = useState(null);
  const [categoriesData, setCategoriesData] = useState(null);
  const [topProductsData, setTopProductsData] = useState(null);
  const [bottomProductsData, setBottomProductsData] = useState(null);
  const [clickCollectData, setClickCollectData] = useState(null);

  // Filtres
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodType, setPeriodType] = useState('monthly');
  const [exportFormat, setExportFormat] = useState('json');

  const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return false;
    }
    
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const isAdmin = user?.role === 'ADMIN' || user?.role === 'CAISSIER' || user?.role === 'PREPARATEUR';
        if (!isAdmin) {
          navigate('/');
          return false;
        }
      } catch (error) {
        navigate('/login');
        return false;
      }
    } else {
      navigate('/login');
      return false;
    }
    
    adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return true;
  };

  useEffect(() => {
    if (checkAuth()) {
      fetchAllReports();
    }
  }, [activeReport, startDate, endDate, periodType]);

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const params = { startDate, endDate };
      
      if (activeReport === 'sales' || activeReport === 'all') {
        const { data } = await adminApi.get('/reports/sales', { params: { ...params, period: periodType } });
        setSalesData(data);
      }

      if (activeReport === 'products' || activeReport === 'all') {
        const { data } = await adminApi.get('/reports/products', { params });
        setProductsData(data);
      }

      if (activeReport === 'categories' || activeReport === 'all') {
        const { data } = await adminApi.get('/reports/categories', { params });
        setCategoriesData(data);
      }

      if (activeReport === 'top' || activeReport === 'all') {
        const { data } = await adminApi.get('/reports/top-products', { params: { ...params, limit: 10 } });
        setTopProductsData(data);
      }

      if (activeReport === 'bottom' || activeReport === 'all') {
        const { data } = await adminApi.get('/reports/bottom-products', { params: { ...params, limit: 10 } });
        setBottomProductsData(data);
      }

      if (activeReport === 'clickcollect' || activeReport === 'all') {
        const { data } = await adminApi.get('/reports/click-collect', { params });
        setClickCollectData(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      if (error.response?.status === 403 || error.response?.status === 401) {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (reportType) => {
    try {
      const params = { startDate, endDate, format: exportFormat };
      const queryString = new URLSearchParams(params).toString();
      window.location.href = `http://localhost:5000/api/admin/reports/export/${reportType}?${queryString}`;
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Erreur lors de l\'export');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des rapports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rapports et Statistiques</h1>
              <p className="text-gray-600">Analyse détaillée des ventes et performances</p>
            </div>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Retour au tableau de bord
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filtres */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Du</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Au</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {(activeReport === 'sales' || activeReport === 'all') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Périodicité</label>
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format export</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV (Excel)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchAllReports}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* Navigation des rapports */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {[
              { id: 'sales', label: 'Ventes Globales', icon: LineChart },
              { id: 'products', label: 'Par Produit', icon: Package },
              { id: 'categories', label: 'Par Catégorie', icon: BarChart3 },
              { id: 'top', label: 'Top Produits', icon: TrendingUp },
              { id: 'bottom', label: 'Moins Vendus', icon: ArrowDown },
              { id: 'clickcollect', label: 'Click & Collect', icon: Eye }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveReport(tab.id)}
                className={`flex items-center px-1 py-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeReport === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Rapport de Ventes Globales */}
        {(activeReport === 'sales' || activeReport === 'all') && salesData && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Rapport de Ventes Globales</h2>
              <button
                onClick={() => handleExport('sales')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Exporter
              </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Chiffre d'affaires</p>
                    <p className="text-2xl font-bold text-gray-900">{salesData.summary.totalRevenue.toFixed(2)} €</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Commandes</p>
                    <p className="text-2xl font-bold text-gray-900">{salesData.summary.totalOrders}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Panier moyen</p>
                    <p className="text-2xl font-bold text-gray-900">{salesData.summary.averageOrderValue.toFixed(2)} €</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Articles vendus</p>
                    <p className="text-2xl font-bold text-gray-900">{salesData.summary.totalItems}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Graphique de ventes */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-md font-medium text-gray-900 mb-4">Évolution des ventes</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={salesData.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" fill="#3b82f6" stroke="#3b82f6" />
                  <Area type="monotone" dataKey="orders" fill="#10b981" stroke="#10b981" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Rapport Par Produit */}
        {(activeReport === 'products' || activeReport === 'all') && productsData && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Rapport Par Produit</h2>
              <button
                onClick={() => handleExport('products')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Exporter
              </button>
            </div>

            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Marque
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenu
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productsData.data.slice(0, 20).map((product) => (
                    <tr key={product.productId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.productName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.brand}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.revenue.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {productsData.data.length > 20 && (
                <div className="px-6 py-3 bg-gray-50 text-center text-sm text-gray-500">
                  ... et {productsData.data.length - 20} produits supplémentaires
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rapport Par Catégorie */}
        {(activeReport === 'categories' || activeReport === 'all') && categoriesData && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Rapport Par Catégorie</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-md font-medium text-gray-900 mb-4">Revenu par catégorie</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoriesData.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="categoryName" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-md font-medium text-gray-900 mb-4">Part des ventes (quantité)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoriesData.data}
                      dataKey="quantity"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {categoriesData.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg overflow-hidden mt-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Catégorie
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenu
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categoriesData.data.map((category) => (
                    <tr key={category.categoryId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {category.categoryName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {category.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {category.revenue.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Produits */}
        {(activeReport === 'top' || activeReport === 'all') && topProductsData && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">🏆 Top 10 Produits Les Plus Vendus</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-md font-medium text-gray-900 mb-4">Par quantité</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={topProductsData.data}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 200 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="productName" type="category" width={200} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-md font-medium text-gray-900 mb-4">Par revenu</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={topProductsData.data}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 200 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="productName" type="category" width={200} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Moins Vendus */}
        {(activeReport === 'bottom' || activeReport === 'all') && bottomProductsData && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">📉 Top 10 Produits Les Moins Vendus</h2>

            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Marque
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantité vendue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commandes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bottomProductsData.data.map((product, index) => (
                    <tr key={product.productId} className={index < 5 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.productName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.brand}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.totalOrders}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Click & Collect */}
        {(activeReport === 'clickcollect' || activeReport === 'all') && clickCollectData && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Click & Collect - Rapport d'Activité</h2>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Réservations totales</p>
                    <p className="text-2xl font-bold text-gray-900">{clickCollectData.summary.totalReserved}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Taux de retrait</p>
                    <p className="text-2xl font-bold text-gray-900">{clickCollectData.summary.pickupRate}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pic d'activité</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {clickCollectData.peakTime ? `${clickCollectData.peakTime.time}` : 'N/A'}
                  </p>
                  {clickCollectData.peakTime && (
                    <p className="text-xs text-gray-500">{clickCollectData.peakTime.count} réservations</p>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
                <div>
                  <p className="text-sm font-medium text-gray-600">Jour le plus actif</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {clickCollectData.peakDay ? `${new Date(clickCollectData.peakDay.date).toLocaleDateString('fr-FR')}` : 'N/A'}
                  </p>
                  {clickCollectData.peakDay && (
                    <p className="text-xs text-gray-500">{clickCollectData.peakDay.count} réservations</p>
                  )}
                </div>
              </div>
            </div>

            {/* Tableau des créneaux */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Créneau
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Réservées
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Retirées
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Annulées
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Taux de retrait
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clickCollectData.slotData.map((slot, index) => {
                    const pickupRate = slot.reserved > 0 ? ((slot.pickedUp / slot.reserved) * 100).toFixed(1) : 0;
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(slot.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {slot.time}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {slot.reserved}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                          {slot.pickedUp}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          {slot.cancelled}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            pickupRate >= 80 ? 'bg-green-100 text-green-800' :
                            pickupRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {pickupRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReports;