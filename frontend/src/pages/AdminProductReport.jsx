import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Package, TrendingUp, DollarSign, AlertTriangle, 
  Calendar, BarChart3, Download, Search, Filter, Eye
} from 'lucide-react';
import adminApi from '../api/adminAxios';

const AdminProductReport = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('productId');
  
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  
  // Filtres
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

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
        const isAdmin = user?.role === 'ADMIN' || user?.role === 'EMPLOYE';
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
      fetchProductReport();
    }
  }, [startDate, endDate, productId]);

  useEffect(() => {
    if (reportData?.products) {
      const filtered = reportData.products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, reportData]);

  const fetchProductReport = async () => {
    setLoading(true);
    try {
      const params = { startDate, endDate };
      if (productId) params.productId = productId;
      
      const { data } = await adminApi.get('/reports/products-detailed', { params });
      setReportData(data);
      
      if (productId && data.products.length > 0) {
        setSelectedProduct(data.products[0]);
      }
    } catch (error) {
      console.error('Error fetching product report:', error);
      if (error.response?.status === 403 || error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = { startDate, endDate, format: 'pdf' };
      if (productId) params.productId = productId;
      const queryString = new URLSearchParams(params).toString();
      
      const response = await fetch(`http://localhost:5000/api/admin/reports/export/products-detailed?${queryString}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors de l\'export');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport_produits_detaille_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Erreur lors de l\'export');
    }
  };

  const formatCurrency = (amount) => `${amount?.toFixed(2)} DH`;
  const formatPercentage = (value) => `${value?.toFixed(1)}%`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du rapport produit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/reports')}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
              title="Retour aux Rapports"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-semibold hidden lg:inline">Rapports</span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedProduct ? `Rapport Produit - ${selectedProduct.name}` : 'Rapport Produits Détaillé'}
              </h1>
              <p className="text-gray-600">Analyse complète des performances produits</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filtres */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recherche</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Nom, marque, code-barres..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleExport}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Exporter PDF
              </button>
            </div>
          </div>
        </div>

        {/* Résumé global */}
        {reportData?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
              <p className="text-sm text-gray-600">Produits analysés</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.summary.totalProducts}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
              <p className="text-sm text-gray-600">CA Total (HT)</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(reportData.summary.totalRevenue)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-orange-500">
              <p className="text-sm text-gray-600">Quantité vendue</p>
              <p className="text-2xl font-bold text-orange-700">{reportData.summary.totalQuantitySold}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500">
              <p className="text-sm text-gray-600">Marge brute totale</p>
              <p className="text-2xl font-bold text-purple-700">{formatCurrency(reportData.summary.totalGrossMargin)}</p>
            </div>
          </div>
        )}

        {/* Vue détaillée d'un produit spécifique */}
        {selectedProduct && (
          <div className="bg-white rounded-lg shadow-sm mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Package size={24} />
                Analyse Détaillée du Produit
              </h2>
            </div>
            
            <div className="p-6">
              {/* Identification produit */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">Identification</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Code-barres:</span> {selectedProduct.barcode || 'N/A'}</div>
                    <div><span className="font-medium">Nom:</span> {selectedProduct.name}</div>
                    <div><span className="font-medium">Marque:</span> {selectedProduct.brand || 'N/A'}</div>
                    <div><span className="font-medium">Catégorie:</span> {selectedProduct.category || 'N/A'}</div>
                  </div>
                </div>

                {/* Rentabilité */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign size={16} className="text-green-600" />
                    Rentabilité
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Prix d'achat HT:</span> {formatCurrency(selectedProduct.purchasePriceHT)}</div>
                    <div><span className="font-medium">Prix de vente HT:</span> {formatCurrency(selectedProduct.sellingPriceHT)}</div>
                    <div><span className="font-medium">Marge unitaire:</span> {formatCurrency(selectedProduct.unitGrossMargin)}</div>
                    <div><span className="font-medium">Marge totale:</span> {formatCurrency(selectedProduct.totalGrossMargin)}</div>
                    <div><span className="font-medium">Taux de marge:</span> {formatPercentage(selectedProduct.marginPercentage)}</div>
                  </div>
                </div>

                {/* Ventes */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-600" />
                    Ventes
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Quantité vendue:</span> {selectedProduct.quantitySold}</div>
                    <div><span className="font-medium">CA HT:</span> {formatCurrency(selectedProduct.revenueHT)}</div>
                    <div><span className="font-medium">CA TTC:</span> {formatCurrency(selectedProduct.revenueTTC)}</div>
                    <div><span className="font-medium">Nb commandes:</span> {selectedProduct.ordersCount}</div>
                  </div>
                </div>

                {/* Stock et réassort */}
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Package size={16} className="text-orange-600" />
                    Stock & Réassort
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Stock actuel:</span> {selectedProduct.currentStock}</div>
                    <div><span className="font-medium">Seuil d'alerte:</span> {selectedProduct.alertThreshold}</div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Statut:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedProduct.stockStatus === 'Normal' ? 'bg-green-100 text-green-800' :
                        selectedProduct.stockStatus === 'Alerte' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {selectedProduct.stockStatus}
                      </span>
                    </div>
                    <div><span className="font-medium">Dernier réassort:</span> {
                      selectedProduct.lastRestock ? 
                      new Date(selectedProduct.lastRestock).toLocaleDateString('fr-FR') : 
                      'Jamais'
                    }</div>
                  </div>
                </div>
              </div>

              {/* Métriques de performance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 rounded-lg text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100">Panier moyen</p>
                      <p className="text-2xl font-bold">{formatCurrency(selectedProduct.averageOrderValue)}</p>
                    </div>
                    <BarChart3 size={32} className="text-green-200" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-lg text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100">Qté moy./commande</p>
                      <p className="text-2xl font-bold">{selectedProduct.averageQuantityPerOrder?.toFixed(1)}</p>
                    </div>
                    <Package size={32} className="text-blue-200" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 rounded-lg text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100">Taux de marge</p>
                      <p className="text-2xl font-bold">{formatPercentage(selectedProduct.marginPercentage)}</p>
                    </div>
                    <TrendingUp size={32} className="text-purple-200" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Liste des produits */}
        {!selectedProduct && (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Rapport par Produit ({filteredProducts.length} produits)
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200" style={{ minWidth: '1400px' }}>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code-barres</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marque</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qté vendue</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CA HT</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CA TTC</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marge brute</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taux marge</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <tr key={product.productId} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {product.image && (
                            <img 
                              src={product.image} 
                              alt={product.name}
                              className="h-10 w-10 rounded-lg object-cover mr-3"
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">{product.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.barcode || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.brand || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.quantitySold}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(product.revenueHT)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-700">
                        {formatCurrency(product.revenueTTC)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-green-700">
                        {formatCurrency(product.totalGrossMargin)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          product.marginPercentage > 30 ? 'text-green-700' :
                          product.marginPercentage > 15 ? 'text-yellow-700' :
                          'text-red-700'
                        }`}>
                          {formatPercentage(product.marginPercentage)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.currentStock}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          product.stockStatus === 'Normal' ? 'bg-green-100 text-green-800' :
                          product.stockStatus === 'Alerte' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {product.stockStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => navigate(`/admin/product-report?productId=${product.productId}`)}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                        >
                          <Eye size={16} />
                          Détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun produit trouvé</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Aucun produit ne correspond aux critères de recherche.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProductReport;