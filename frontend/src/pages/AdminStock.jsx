import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertTriangle, TrendingDown, TrendingUp, RefreshCw, ArrowLeft, Plus, Search, ToggleLeft, ToggleRight, Eye, EyeOff } from 'lucide-react';
import adminApi from '../api/adminAxios';
import axios from '../api/axios';

const TYPE_LABELS = { SALE: 'Vente', RETURN: 'Retour', RESTOCK: 'Réapprovisionnement', ADJUSTMENT: 'Ajustement' };
const TYPE_COLORS = {
  SALE:       'bg-red-100 text-red-700',
  RETURN:     'bg-green-100 text-green-700',
  RESTOCK:    'bg-blue-100 text-blue-700',
  ADJUSTMENT: 'bg-gray-100 text-gray-700',
};

const AdminStock = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('products');
  const [alerts, setAlerts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [restockModal, setRestockModal] = useState(null);
  const [restockForm, setRestockForm] = useState({ quantity: '', reason: '' });
  
  // Products tab state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // all, active, inactive, outOfStock
  const [searchTerm, setSearchTerm] = useState('');
  const [productPagination, setProductPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [productLoading, setProductLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchAlerts();
    fetchMovements(1, '');
    fetchCategories();
    fetchBrands();
  }, []);

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts(1);
    }
  }, [activeTab, filterCategory, filterBrand, filterStatus]);

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get('/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch { setCategories([]); }
  };

  const fetchBrands = async () => {
    try {
      // baseURL is already http://localhost:5000/api/admin, so just use '/brands'
      const { data } = await adminApi.get('/brands');
      setBrands(Array.isArray(data) ? data : []);
    } catch { setBrands([]); }
  };

  const fetchProducts = async (page = 1) => {
    setProductLoading(true);
    try {
      const params = { 
        page, 
        limit: 20,
        category: filterCategory || undefined,
        brand: filterBrand || undefined,
        search: searchTerm || undefined
      };
      
      if (filterStatus === 'active') params.active = 'true';
      else if (filterStatus === 'inactive') params.active = 'false';
      else if (filterStatus === 'outOfStock') params.outOfStock = 'true';
      
      const { data } = await axios.get('/products', { params });
      setProducts(data.products || data || []);
      setProductPagination({
        page: data.pagination?.currentPage || data.page || 1,
        totalPages: data.pagination?.totalPages || data.totalPages || 1,
        total: data.pagination?.total || data.total || 0
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setProductLoading(false);
    }
  };

  const handleSearch = () => {
    fetchProducts(1);
  };

  const fetchAlerts = async () => {
    try {
      const { data } = await adminApi.get('/stock/alerts');
      setAlerts(data);
    } catch { setAlerts([]); }
  };

  const fetchMovements = async (page = 1, type = typeFilter) => {
    setLoading(true);
    try {
      const params = { page, limit: 30 };
      if (type) params.type = type;
      const { data } = await adminApi.get('/stock/movements', { params });
      setMovements(data.movements);
      setPagination(data.pagination);
    } catch { setMovements([]); }
    finally { setLoading(false); }
  };

  const handleFilterChange = (type) => {
    setTypeFilter(type);
    fetchMovements(1, type);
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    try {
      await adminApi.put(`/stock/restock/${restockModal.id}`, restockForm);
      setRestockModal(null);
      setRestockForm({ quantity: '', reason: '' });
      fetchAlerts();
      fetchMovements(1, typeFilter);
      fetchProducts(productPagination.page);
    } catch { alert('Erreur lors du réapprovisionnement'); }
  };

  // Toggle product active status
  const toggleProductActive = async (product) => {
    try {
      await axios.put(`/products/${product.id}`, {
        ...product,
        active: !product.active
      });
      fetchProducts(productPagination.page);
    } catch (error) {
      console.error('Error toggling product status:', error);
      alert('Erreur lors de la modification du statut');
    }
  };

  // Mark product as out of stock (set stock to 0)
  const markAsOutOfStock = async (product) => {
    if (!window.confirm(`Marquer "${product.name}" comme rupture de stock ?`)) return;
    try {
      await axios.put(`/products/${product.id}`, {
        ...product,
        stock: 0
      });
      fetchProducts(productPagination.page);
      fetchAlerts();
    } catch (error) {
      console.error('Error marking as out of stock:', error);
      alert('Erreur lors de la modification du stock');
    }
  };

  const criticalCount = alerts.filter(p => p.stock === 0).length;
  const lowCount = alerts.filter(p => p.stock > 0).length;

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : '—';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/admin/dashboard')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gestion du stock</h1>
            <p className="text-xs text-gray-500">Mouvements en temps réel · Alertes critiques · Catalogue produits</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={18} className="text-red-500" />
              <span className="text-xs text-gray-500">Rupture totale</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-orange-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Package size={18} className="text-orange-500" />
              <span className="text-xs text-gray-500">Stock faible</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{lowCount}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={18} className="text-blue-500" />
              <span className="text-xs text-gray-500">Ventes (total)</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {movements.filter(m => m.type === 'SALE').reduce((s, m) => s + Math.abs(m.quantity), 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-green-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={18} className="text-green-500" />
              <span className="text-xs text-gray-500">Retours (total)</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {movements.filter(m => m.type === 'RETURN' || m.type === 'RESTOCK').reduce((s, m) => s + m.quantity, 0)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { id: 'products', label: 'Catalogue Produits' },
            { id: 'alerts', label: `Alertes (${alerts.length})` },
            { id: 'movements', label: 'Historique' },
            { id: 'stats', label: 'Stats par produit' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: Products Catalog */}
        {activeTab === 'products' && (
          <div>
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Rechercher un produit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                {/* Brand Filter */}
                <select
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                >
                  <option value="">Toutes les marques</option>
                  {brands.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                >
                  <option value="">Tous les statuts</option>
                  <option value="active">Actifs</option>
                  <option value="inactive">Inactifs</option>
                  <option value="outOfStock">Rupture de stock</option>
                </select>
              </div>

              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-500">
                  {productPagination.total} produit(s) trouvé(s)
                </span>
                <button 
                  onClick={() => {
                    setFilterCategory('');
                    setFilterBrand('');
                    setFilterStatus('');
                    setSearchTerm('');
                    fetchProducts(1);
                  }}
                  className="text-sm text-sky-700 hover:text-sky-800"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            </div>

            {/* Products Table */}
            {productLoading ? (
              <div className="flex justify-center py-12 bg-white rounded-xl border border-gray-100">
                <div className="w-8 h-8 border-4 border-sky-700 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
                <Package size={40} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucun produit trouvé</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Image', 'Nom', 'Marque', 'Catégorie', 'Prix', 'Stock', 'Statut', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {products.map(product => (
                        <tr key={product.id} className={`hover:bg-gray-50 ${!product.active ? 'bg-gray-50 opacity-75' : ''}`}>
                          <td className="px-4 py-3">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded-lg" onError={(e) => { e.target.src = '/images/placeholder.jpg' }} />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Package size={20} className="text-gray-400" />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{product.name}</p>
                              <p className="text-xs text-gray-500 truncate max-w-xs">{product.description?.substring(0, 50) || '—'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{product.brand || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{getCategoryName(product.categoryId)}</td>
                          <td className="px-4 py-3">
                            <div>
                              <span className="text-sm font-semibold text-gray-900">{product.price.toFixed(2)} DH</span>
                              {product.oldPrice && (
                                <span className="text-xs text-gray-400 line-through ml-1">{product.oldPrice.toFixed(2)} DH</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              product.stock === 0 ? 'bg-red-100 text-red-700'
                              : product.stock <= product.stockAlert ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                            }`}>
                              {product.stock}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                product.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {product.active ? 'Actif' : 'Inactif'}
                              </span>
                              {product.stock === 0 && (
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                                  Rupture
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {/* Toggle Active/Inactive */}
                              <button
                                onClick={() => toggleProductActive(product)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  product.active 
                                    ? 'text-green-600 hover:bg-green-50' 
                                    : 'text-gray-500 hover:bg-gray-100'
                                }`}
                                title={product.active ? 'Désactiver le produit' : 'Activer le produit'}
                              >
                                {product.active ? <Eye size={16} /> : <EyeOff size={16} />}
                              </button>

                              {/* Mark as out of stock (if has stock) */}
                              {product.stock > 0 && (
                                <button
                                  onClick={() => markAsOutOfStock(product)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Marquer comme rupture de stock"
                                >
                                  <AlertTriangle size={16} />
                                </button>
                              )}

                              {/* Quick restock button (if out of stock) */}
                              {product.stock === 0 && (
                                <button
                                  onClick={() => { setRestockModal(product); setRestockForm({ quantity: '', reason: '' }); }}
                                  className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                                  title="Réapprovisionner"
                                >
                                  <Plus size={16} />
                                </button>
                              )}

                              {/* Edit button */}
                              <button
                                onClick={() => navigate(`/admin/products`)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Modifier"
                              >
                                <RefreshCw size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {productPagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4 pb-4">
                    <button disabled={productPagination.page === 1}
                      onClick={() => fetchProducts(productPagination.page - 1)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                      Précédent
                    </button>
                    <span className="px-3 py-1.5 text-sm text-gray-600">
                      Page {productPagination.page} / {productPagination.totalPages}
                    </span>
                    <button disabled={productPagination.page === productPagination.totalPages}
                      onClick={() => fetchProducts(productPagination.page + 1)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                      Suivant
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: Alerts */}
        {activeTab === 'alerts' && (
          <div>
            {alerts.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
                <Package size={40} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucun produit en stock critique</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Produit', 'Stock actuel', 'Seuil alerte', 'Statut', 'Action'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {alerts.map(product => (
                      <tr key={product.id} className={product.stock === 0 ? 'bg-red-50' : ''}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {product.image && (
                              <img src={product.image} alt={product.name} className="w-10 h-10 object-cover rounded-lg" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">{product.name}</p>
                              <p className="text-xs text-gray-400">{product.brand}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-lg font-bold ${product.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                            {product.stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{product.stockAlert}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            product.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {product.stock === 0 ? 'Rupture' : 'Stock faible'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setRestockModal(product); setRestockForm({ quantity: '', reason: '' }); }}
                            className="flex items-center gap-1 text-xs text-sky-700 border border-sky-200 rounded-lg px-2 py-1 hover:bg-sky-50"
                          >
                            <Plus size={12} /> Réapprovisionner
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: Movements */}
        {activeTab === 'movements' && (
          <div>
            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {['', 'SALE', 'RETURN', 'RESTOCK'].map(type => (
                <button key={type} onClick={() => handleFilterChange(type)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    typeFilter === type
                      ? 'bg-sky-700 text-white border-sky-700'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {type === '' ? 'Tous' : TYPE_LABELS[type]}
                </button>
              ))}
              <button onClick={() => fetchMovements(pagination.page, typeFilter)}
                className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                <RefreshCw size={12} /> Actualiser
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-sky-700 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
                <p className="text-sm">Aucun mouvement trouvé</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Date', 'Produit', 'Type', 'Quantité', 'Raison'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {movements.map(m => (
                        <tr key={m.id}>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            <br />
                            <span className="text-gray-400">{new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {m.product?.image && (
                                <img src={m.product.image} alt={m.product.name} className="w-8 h-8 object-cover rounded" />
                              )}
                              <div>
                                <p className="text-sm font-medium text-gray-900">{m.product?.name}</p>
                                <p className="text-xs text-gray-400">Stock actuel : {m.product?.stock}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${TYPE_COLORS[m.type] || 'bg-gray-100 text-gray-700'}`}>
                              {TYPE_LABELS[m.type] || m.type}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${m.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {m.quantity > 0 ? '+' : ''}{m.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{m.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <button disabled={pagination.page === 1}
                      onClick={() => fetchMovements(pagination.page - 1, typeFilter)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                      Précédent
                    </button>
                    <span className="px-3 py-1.5 text-sm text-gray-600">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <button disabled={pagination.page === pagination.totalPages}
                      onClick={() => fetchMovements(pagination.page + 1, typeFilter)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {/* TAB: Stats par produit */}
        {activeTab === 'stats' && (
          <div>
            <div className="flex gap-2 mb-4">
              {[{ v: 'day', l: "Aujourd'hui" }, { v: 'month', l: 'Ce mois' }].map(({ v, l }) => (
                <button key={v} onClick={() => setStatsPeriod(v)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                    statsPeriod === v ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>{l}</button>
              ))}
            </div>
            {statsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-sky-700 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : stats.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400">
                <BarChart2 size={40} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucun mouvement sur cette période</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Produit', 'Stock actuel', 'Ventes', 'Retours', 'Réappros'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stats.map(s => (
                      <tr key={s.productId}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {s.image && <img src={s.image} alt={s.productName} className="w-8 h-8 object-cover rounded" />}
                            <div>
                              <p className="text-sm font-medium text-gray-900">{s.productName}</p>
                              <p className="text-xs text-gray-400">{s.brand}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${
                            s.currentStock === 0 ? 'text-red-600' : s.currentStock <= s.stockAlert ? 'text-orange-600' : 'text-gray-800'
                          }`}>{s.currentStock}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-600">
                            <TrendingDown size={14} />{s.sales}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-600">
                            <TrendingUp size={14} />{s.returns}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
                            <RefreshCw size={14} />{s.restocks}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Restock Modal */}
      {restockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-1">Réapprovisionner</h3>
            <p className="text-sm text-gray-500 mb-4">{restockModal.name} — Stock actuel : <strong>{restockModal.stock}</strong></p>
            <form onSubmit={handleRestock} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Quantité à ajouter</label>
                <input type="number" min="1" value={restockForm.quantity}
                  onChange={e => setRestockForm({ ...restockForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
                  required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Raison (optionnel)</label>
                <input type="text" value={restockForm.reason}
                  onChange={e => setRestockForm({ ...restockForm, reason: e.target.value })}
                  placeholder="Livraison fournisseur, correction..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-sky-500" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setRestockModal(null)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit"
                  className="flex-1 py-2 bg-sky-700 text-white rounded-lg text-sm hover:bg-sky-800">
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStock;