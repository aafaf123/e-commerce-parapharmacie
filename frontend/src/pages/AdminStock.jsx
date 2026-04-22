import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertTriangle, TrendingDown, TrendingUp, RefreshCw, ArrowLeft, Plus, Search, ToggleLeft, ToggleRight, Eye, EyeOff, BarChart2, Clock, Layers, X } from 'lucide-react';
import adminApi from '../api/adminAxios';
import axios from '../api/axios';
import AdminBackButton from '../components/AdminBackButton';

const TYPE_LABELS = { SALE: 'Vente', RETURN: 'Retour', RESTOCK: 'Réapprovisionnement', ADJUSTMENT: 'Ajustement' };
const TYPE_COLORS = {
  SALE:       'bg-green-100 text-green-700',
  RETURN:     'bg-red-100 text-red-700',
  RESTOCK:    'bg-blue-100 text-blue-700',
  ADJUSTMENT: 'bg-gray-100 text-gray-700',
};

const AdminStock = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('products');
  const [alerts, setAlerts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [restockModal, setRestockModal] = useState(null);
  const [restockForm, setRestockForm] = useState({ quantity: '', reason: '' });
  const [selectedProductForVariants, setSelectedProductForVariants] = useState(null);
  const [variantsLoading, setVariantsLoading] = useState(false);
  
  // Products tab state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoryItems, setSubcategoryItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('');
  const [filterItem, setFilterItem] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // all, active, inactive, outOfStock
  const [searchTerm, setSearchTerm] = useState('');
  const [productPagination, setProductPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [productLoading, setProductLoading] = useState(false);

  const [stats, setStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [totals, setTotals] = useState({ salesTotal: 0, returnsTotal: 0 });
  const [totalsLoading, setTotalsLoading] = useState(true);

  useEffect(() => {
    // Vérifier l'authentification
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      navigate('/login');
      return;
    }
    
    try {
      const user = JSON.parse(userStr);
      const isAdmin = user?.role === 'ADMIN' || user?.role === 'EMPLOYE';
      if (!isAdmin) {
        navigate('/');
        return;
      }
    } catch (e) {
      navigate('/login');
      return;
    }
    
    // Configurer axios avec le token
    if (token) adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Charger les données
    fetchAlerts();
    fetchMovements(1, '');
    fetchCategories();
    fetchBrands();
  }, []);

  const fetchData = async () => {
    if (activeTab === 'products') fetchProducts(1);
    if (activeTab === 'stats') fetchStats();
  };
  
  const handleRefresh = () => {
    fetchAlerts();
    fetchMovements(1, typeFilter);
    fetchData();
  };
  
  useEffect(() => {
    fetchTotals();
    fetchData();
  }, []);

  const fetchTotals = async () => {
    setTotalsLoading(true);
    try {
      const { data } = await adminApi.get('/admin/stock/stats-totals');
      setTotals(data);
    } catch {
      setTotals({ salesTotal: 0, returnsTotal: 0 });
    } finally {
      setTotalsLoading(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      fetchAlerts();
      fetchMovements(1, typeFilter);
      if (activeTab === 'stats') fetchStats();
    }, 15000);

    return () => clearInterval(interval);
  }, [typeFilter, activeTab]);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await adminApi.get('/stock/stats');
      setStats(data);
    } catch { setStats([]); }
    finally { setStatsLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get('/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch { setCategories([]); }
  };

  const fetchSubcategories = async (categoryId) => {
    if (!categoryId) {
      setSubcategories([]);
      setSubcategoryItems([]);
      return;
    }
    try {
      const { data } = await axios.get(`/categories/${categoryId}/subcategories`);
      setSubcategories(Array.isArray(data) ? data : []);
      setSubcategoryItems([]);
    } catch { setSubcategories([]); }
  };

  const fetchSubcategoryItems = async (subcategoryId) => {
    if (!subcategoryId) {
      setSubcategoryItems([]);
      return;
    }
    try {
      const { data } = await axios.get(`/categories/subcategories/${subcategoryId}`);
      setSubcategoryItems(Array.isArray(data.items) ? data.items : []);
    } catch { setSubcategoryItems([]); }
  };

  const fetchBrands = async () => {
    try {
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
        subcategoryId: filterSubcategory || undefined,
        subcategoryItemId: filterItem || undefined,
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
    setMovementsLoading(true);
    try {
      const params = { page, limit: 30 };
      if (type) params.type = type;
      const { data } = await adminApi.get('/stock/movements', { params });
      setMovements(data.movements || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Error fetching movements:', error);
      setMovements([]);
      setPagination({ page: 1, totalPages: 1, total: 0 });
    } finally {
      setMovementsLoading(false);
    }
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

  const showVariantsModal = async (product) => {
    setSelectedProductForVariants(product);
    setVariantsLoading(true);
    try {
      const { data } = await axios.get(`/products/${product.id}`);
      setSelectedProductForVariants(data);
    } catch (error) {
      console.error('Error fetching product variants:', error);
      alert('Erreur lors du chargement des variantes');
    } finally {
      setVariantsLoading(false);
    }
  };

  const criticalCount = alerts.filter(p => p.stock === 0).length;
  const lowCount = alerts.filter(p => p.stock > 0 && p.stock <= p.stockAlert).length;

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : '—';
  };

  const closeRestockModal = () => {
    setRestockModal(null);
    setRestockForm({ quantity: '', reason: '' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="w-full px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
              title="Retour au Tableau de Bord"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-semibold hidden lg:inline">Dashboard</span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Gestion du stock</h1>
              <p className="text-xs text-gray-500">Mouvements en temps réel · Alertes critiques · Catalogue produits</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-0 py-6">
        {/* KPI cards */}
        {!movementsLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 px-4">
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
            <div className="bg-white rounded-xl p-4 border border-green-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Package size={18} className="text-green-500" />
                <span className="text-xs text-gray-500">Ventes (total)</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {movements.filter(m => m.type === 'SALE').reduce((s, m) => s + Math.abs(m.quantity), 0)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={18} className="text-red-500" />
                <span className="text-xs text-gray-500">Retours (total)</span>
              </div>
              <p className="text-2xl font-bold text-red-600">
                {movements.filter(m => m.type === 'RETURN').reduce((s, m) => s + m.quantity, 0)}
              </p>
            </div>

          </div>
        )}

        {/* Tabs loading skeleton */}
        {movementsLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 px-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm animate-pulse">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 bg-gray-200 rounded"></div>
                  <div className="w-16 h-3 bg-gray-200 rounded"></div>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="mx-4 mb-6">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {[
            { id: 'products', label: 'Catalogue Produits' },
            { id: 'alerts', label: `Alertes (${alerts.length})` },
            { id: 'movements', label: 'Historique' },
            { id: 'stats', label: 'Stats ventes & projection' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}>
              {tab.label}
            </button>
          ))}
          </div>
        </div>

        {/* TAB: Products Catalog */}
        {activeTab === 'products' && (
          <div>
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 mx-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Search */}
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Rechercher (nom, code-barres)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setFilterSubcategory('');
                    setFilterItem('');
                    fetchSubcategories(e.target.value);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                {/* Subcategory Filter */}
                <select
                  value={filterSubcategory}
                  onChange={(e) => {
                    setFilterSubcategory(e.target.value);
                    setFilterItem('');
                    fetchSubcategoryItems(e.target.value);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  disabled={!filterCategory}
                >
                  <option value="">Toutes les sous-catégories</option>
                  {subcategories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>

                {/* Item Filter */}
                <select
                  value={filterItem}
                  onChange={(e) => setFilterItem(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  disabled={!filterSubcategory}
                >
                  <option value="">Tous les items</option>
                  {subcategoryItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
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
              </div>

              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-500">
                  {productPagination.total} produit(s) trouvé(s)
                </span>
                <button 
                  onClick={() => {
                    setFilterCategory('');
                    setFilterSubcategory('');
                    setFilterItem('');
                    setFilterBrand('');
                    setSearchTerm('');
                    setSubcategories([]);
                    setSubcategoryItems([]);
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
              <div className="flex justify-center py-12 bg-white rounded-xl border border-gray-100 mx-4">
                <div className="w-8 h-8 border-4 border-sky-700 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100 mx-4 text-gray-400">
                <Package size={40} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucun produit trouvé</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                <table className="w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        { label: 'Image', width: 'w-16' },
                        { label: 'Nom', width: 'min-w-[200px]' },
                        { label: 'Prix TTC', width: 'w-24' },
                        { label: 'Marque', width: 'w-32' },
                        { label: 'Stock', width: 'w-20' },
                        { label: 'Alerte', width: 'w-20' },
                        { label: 'Statut', width: 'w-28' },
                        { label: 'Actions', width: 'w-40' }
                      ].map((col, idx) => (
                        <th key={idx} className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.width}`}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map(product => (
                      <tr key={product.id} className={`hover:bg-gray-50 ${!product.active ? 'bg-gray-50 opacity-75' : ''} transition-colors align-top`}>
                        {/* Image - largeur fixe */}
                        <td className="px-4 py-3 whitespace-nowrap align-top">
                          <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = '/images/placeholder.svg' }} />
                            ) : (
                              <Package size={20} className="text-gray-400" />
                            )}
                          </div>
                        </td>
                        {/* Nom + code-barres */}
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2" title={product.name}>{product.name}</p>
                            <p className="text-xs text-gray-500 font-mono truncate" title={product.barcode || ''}>{product.barcode || '—'}</p>
                          </div>
                        </td>
                        {/* Prix */}
                        <td className="px-4 py-3 whitespace-nowrap align-top">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">{product.price?.toFixed(2) || '0.00'} DH</span>
                            {product.oldPrice && (
                              <span className="text-xs text-gray-400 line-through">{product.oldPrice.toFixed(2)} DH</span>
                            )}
                          </div>
                        </td>
                        {/* Marque */}
                        <td className="px-4 py-3 whitespace-nowrap align-top text-sm text-gray-500 truncate" title={product.brand || ''}>
                          {product.brand || '—'}
                        </td>
                        {/* Stock - centré */}
                        <td className="px-4 py-3 whitespace-nowrap align-top text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 text-sm font-bold rounded-full min-w-[3rem] ${
                            product.stock === 0 ? 'bg-red-100 text-red-700'
                            : product.stock <= product.stockAlert ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                          }`}>
                            {product.stock}
                          </span>
                        </td>
                        {/* Alerte */}
                        <td className="px-4 py-3 whitespace-nowrap align-top text-sm text-gray-500 text-center">
                          {product.stockAlert || 0}
                        </td>
                        {/* Statut */}
                        <td className="px-4 py-3 whitespace-nowrap align-top">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full text-center ${
                              product.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {product.active ? 'Actif' : 'Inactif'}
                            </span>
                            {product.stock === 0 && (
                              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 text-center">
                                Rupture
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3 whitespace-nowrap align-top">
                          <div className="flex items-center gap-1 flex-wrap">
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

                            {/* Variants button */}
                            <button
                              onClick={() => showVariantsModal(product)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Afficher les variantes"
                            >
                              <Layers size={16} />
                            </button>

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
                {productPagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4 pb-4">
                    <button
                      disabled={productPagination.page === 1}
                      onClick={() => fetchProducts(productPagination.page - 1)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    >
                      Précédent
                    </button>
                    <span className="px-3 py-1.5 text-sm text-gray-600">
                      Page {productPagination.page} / {productPagination.totalPages}
                    </span>
                    <button
                      disabled={productPagination.page === productPagination.totalPages}
                      onClick={() => fetchProducts(productPagination.page + 1)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    >
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
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100 mx-4 text-gray-400">
                <Package size={40} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucun produit en stock critique</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                <table className="w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        { label: 'Produit', width: 'min-w-[200px]' },
                        { label: 'Stock actuel', width: 'w-24' },
                        { label: 'Seuil alerte', width: 'w-28' },
                        { label: 'Statut', width: 'w-28' },
                        { label: 'Action', width: 'w-32' }
                      ].map((col, idx) => (
                        <th key={idx} className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.width}`}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {alerts.map(product => (
                      <tr key={product.id} className={`hover:bg-gray-50 ${product.stock === 0 ? 'bg-red-50' : ''} transition-colors align-top`}>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                              {product.image && (
                                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]" title={product.name}>{product.name}</p>
                              <p className="text-xs text-gray-400 truncate max-w-[180px]">{product.brand || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap align-top text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 text-sm font-bold rounded-full min-w-[3rem] ${
                            product.stock === 0 ? 'text-red-600' : 'text-orange-600'
                          }`}>
                            {product.stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap align-top text-sm text-gray-500 text-center">
                          {product.stockAlert}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap align-top">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full text-center ${
                            product.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {product.stock === 0 ? 'Rupture' : 'Stock faible'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap align-top">
                          <button
                            onClick={() => { setRestockModal(product); setRestockForm({ quantity: '', reason: '' }); }}
                            className="flex items-center gap-1 text-xs text-sky-700 border border-sky-200 rounded-lg px-2 py-1 hover:bg-sky-50 whitespace-nowrap"
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

            {movementsLoading ? (
              <div className="flex justify-center py-12 mx-4">
                <div className="w-8 h-8 border-4 border-sky-700 border-t-transparent rounded-full animate-spin" />
              </div>
) : movements.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100 mx-4 text-gray-400">
                <p className="text-sm">Aucun mouvement trouvé</p>
              </div>
            ) : (
              <>
<div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                  <table className="w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        {[
                          { label: 'Date', width: 'w-40' },
                          { label: 'Produit', width: 'min-w-[200px]' },
                          { label: 'Type', width: 'w-24' },
                          { label: 'Quantité', width: 'w-24' },
                          { label: 'Raison', width: 'min-w-[200px]' }
                        ].map((col, idx) => (
                          <th key={idx} className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.width}`}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {movements.map(m => (
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors align-top">
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap align-top">
                            {new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            <br />
                            <span className="text-gray-400">{new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 flex-shrink-0 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                                {m.product?.image && (
                                  <img src={m.product.image} alt={m.product.name} className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="text-sm font-semibold text-gray-900 truncate max-w-[150px] block" title={m.product?.name}>{m.product?.name || 'Produit inconnu'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap align-top">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              m.type === 'SALE' ? 'bg-red-100 text-red-700'
                              : m.type === 'RETURN' ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                            }`}>
                              {m.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap align-top text-center">
                            <span className={`inline-flex items-center justify-center px-2 py-1 text-sm font-bold rounded ${
                              m.quantity < 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
                            }`}>
                              {m.quantity > 0 ? '+' : ''}{m.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 truncate align-top max-w-[200px]" title={m.reason || ''}>
                            {m.reason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4 pb-4">
                    <button
                      disabled={pagination.page === 1}
                      onClick={() => fetchMovements(pagination.page - 1, typeFilter)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    >
                      Précédent
                    </button>
                    <span className="px-3 py-1.5 text-sm text-gray-600">
                      Page {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() => fetchMovements(pagination.page + 1, typeFilter)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB: Stats */}
        {activeTab === 'stats' && (
          <div className="px-4">
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
              <BarChart2 size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-sm">Statistiques des ventes et projections disponibles prochainement.</p>
            </div>
          </div>
        )}
      </div>

      {/* Restock Modal */}
      {restockModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">
                Réapprovisionner – {restockModal.name}
              </h3>
              <button onClick={closeRestockModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRestock} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité à ajouter
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockForm.quantity}
                  onChange={(e) => setRestockForm({...restockForm, quantity: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  placeholder="Ex: 50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raison (optionnel)
                </label>
                <input
                  type="text"
                  value={restockForm.reason}
                  onChange={(e) => setRestockForm({...restockForm, reason: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  placeholder="Ex: Nouvelle commande fournisseur"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRestockModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-sky-700 text-white rounded-lg hover:bg-sky-800"
                >
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