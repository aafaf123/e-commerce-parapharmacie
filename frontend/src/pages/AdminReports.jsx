import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Download, ArrowDown, Package, Eye, FileBarChart, Trophy, AlertTriangle, Clock, CalendarCheck, Users, Percent
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import adminApi from '../api/adminAxios';

const AdminReports = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState('products');
  const [productsData, setProductsData] = useState(null);
  const [topProductsData, setTopProductsData] = useState(null);
  const [bottomProductsData, setBottomProductsData] = useState(null);
  const [clickCollectData, setClickCollectData] = useState(null);
  const [salesSummary, setSalesSummary] = useState(null);

  // Filtres
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodType, setPeriodType] = useState('monthly');
  const [exportFormat, setExportFormat] = useState('json');

  const applyQuickFilter = (filter) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (filter === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (filter === 'week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      setStartDate(weekStart.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (filter === 'month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(monthStart.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

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
      
      // Toujours charger le résumé des ventes
      try {
        const { data: salesData } = await adminApi.get('/reports/sales', { params: { ...params, period: periodType } });
        setSalesSummary(salesData.summary);
      } catch {}
      
      if (activeReport === 'products' || activeReport === 'all') {
        const { data } = await adminApi.get('/reports/products', { params });
        setProductsData(data);
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
      const token = localStorage.getItem('token');
      const params = { startDate, endDate, format: exportFormat };
      const queryString = new URLSearchParams(params).toString();
      
      const response = await fetch(`http://localhost:5000/api/admin/reports/export/${reportType}?${queryString}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          alert('Session expirée. Veuillez vous reconnecter.');
          navigate('/admin/login');
          return;
        }
        throw new Error('Erreur lors de l\'export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `rapport_${reportType}_${Date.now()}.${exportFormat === 'pdf' ? 'pdf' : 'csv'}`;
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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
        {/* KPIs globaux */}
        {salesSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'CA Total (HT)', value: `${salesSummary.totalRevenue?.toFixed(2)} DH`, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'CA Total (TTC 20%)', value: `${(salesSummary.totalRevenue * 1.20)?.toFixed(2)} DH`, color: 'text-indigo-700', bg: 'bg-indigo-50' },
              { label: 'Commandes', value: salesSummary.totalOrders, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Panier moyen', value: `${salesSummary.averageOrderValue?.toFixed(2)} DH`, color: 'text-orange-700', bg: 'bg-orange-50' },
            ].map(kpi => (
              <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 border border-gray-100`}>
                <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          {/* Filtres rapides */}
          <div className="flex gap-2 mb-4">
            {[
              { label: "Aujourd'hui", value: 'today' },
              { label: 'Cette semaine', value: 'week' },
              { label: 'Ce mois', value: 'month' },
            ].map(f => (
              <button key={f.value} onClick={() => applyQuickFilter(f.value)}
                className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-colors">
                {f.label}
              </button>
            ))}
          </div>
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

            {(activeReport === 'products' || activeReport === 'all') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Périodicité</label>
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
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
                <option value="csv">Excel (CSV)</option>
                <option value="pdf">PDF</option>
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
              { id: 'products', label: 'Par Produit', icon: Package },
              { id: 'top', label: 'Top Ventes', icon: TrendingUp },
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marque</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qté vendue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix unitaire</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total HT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total TTC (20%)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productsData.data.slice(0, 20).map((product) => {
                    const ttc = product.revenue * 1.20;
                    return (
                      <tr key={product.productId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.productName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.brand}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.quantity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.avgUnitPrice?.toFixed(2) || product.unitPrice?.toFixed(2) || '—'} DH</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.revenue.toFixed(2)} DH</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700">{ttc.toFixed(2)} DH</td>
                      </tr>
                    );
                  })}
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

        {/* Top Produits */}
        {(activeReport === 'top' || activeReport === 'all') && topProductsData && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6"><Trophy className="inline w-5 h-5 mr-2" />Top 10 Produits Les Plus Vendus</h2>

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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900"><AlertTriangle className="inline w-5 h-5 mr-2" />Top 10 Produits Les Moins Vendus</h2>
              <button onClick={() => handleExport('bottom-products')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                <Download className="w-4 h-4" /> Exporter
              </button>
            </div>

            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marque</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qté vendue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commandes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bottomProductsData.data.map((product, index) => (
                    <tr key={product.productId} className={index < 3 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.productName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.brand}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.totalOrders}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          product.quantity === 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {product.quantity === 0 ? 'Jamais vendu' : 'Faibles ventes'}
                        </span>
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
