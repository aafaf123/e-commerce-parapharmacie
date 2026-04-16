// frontend/src/pages/AdminPromotions.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tag, Plus, Edit2, Trash2, Copy, Eye, EyeOff, ChevronDown, BarChart3,
  Calendar, Percent, DollarSign, ShoppingCart, TrendingUp, Filter, Search,
  AlertCircle, X, Check, Clock, Image, Star, Truck, Shield, Zap,
  Gift, Sparkles, Flame, Crown, BadgePercent , Upload
} from 'lucide-react';
import adminApi from '../api/adminAxios';

// Liste des icônes disponibles pour les promotions
const AVAILABLE_ICONS = [
  { name: 'Zap', icon: Zap, color: 'text-yellow-500' },
  { name: 'Sparkles', icon: Sparkles, color: 'text-green-500' },
  { name: 'Gift', icon: Gift, color: 'text-purple-500' },
  { name: 'Truck', icon: Truck, color: 'text-blue-500' },
  { name: 'Crown', icon: Crown, color: 'text-amber-500' },
  { name: 'Flame', icon: Flame, color: 'text-red-500' },
  { name: 'Star', icon: Star, color: 'text-yellow-500' },
  { name: 'Shield', icon: Shield, color: 'text-green-500' },
  { name: 'BadgePercent', icon: BadgePercent, color: 'text-orange-500' }
];

const AdminPromotions = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('promo-codes');
  const [loading, setLoading] = useState(false);
  const [promoCodes, setPromoCodes] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  
  // Dark mode detection
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || document.documentElement.getAttribute('data-theme') === 'dark';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkTheme(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token) {
      navigate('/login');
      return;
    }
    
    try {
      const user = JSON.parse(userStr);
      const isAdmin = user?.role === 'ADMIN' || user?.role === 'CAISSIER' || user?.role === 'PREPARATEUR';
      if (!isAdmin) {
        navigate('/');
        return;
      }
    } catch (error) {
      navigate('/login');
      return;
    }
    
    adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setCurrentPage(1);
  }, [navigate, activeTab]);

  useEffect(() => {
    if (activeTab === 'promo-codes') {
      fetchPromoCodes();
    } else {
      fetchPromotions();
    }
  }, [currentPage, activeTab, filter]);

  const fetchPromoCodes = async () => {
    setLoading(true);
    try {
      const activeFilter = filter === 'all' ? '' : `&active=${filter === 'active'}`;
      const { data } = await adminApi.get(
        `/promo-codes?page=${currentPage}&limit=${limit}${activeFilter}`
      );
      setPromoCodes(data.promoCodes);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
      setError('');
    } catch (err) {
      setError('Erreur lors du chargement des codes promo');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const activeFilter = filter === 'all' ? '' : `&active=${filter === 'active'}`;
      const { data } = await adminApi.get(
        `/promotions?page=${currentPage}&limit=${limit}${activeFilter}`
      );
      setPromotions(data.promotions);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
      setError('');
    } catch (err) {
      setError('Erreur lors du chargement des promotions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

 // frontend/src/pages/AdminPromotions.jsx
// Modifiez le payload dans handleCreatePromotion

const handleCreatePromotion = async (data) => {
  try {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    
    console.log('📅 Selected dates:', {
      startInput: data.startDate,
      endInput: data.endDate,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      now: new Date().toISOString()
    });
    
    // Vérifier si les dates sont dans le futur
    const now = new Date();
    if (endDate < now) {
      setError('La date de fin doit être dans le futur');
      return;
    }
    const payload = {
      title: data.title,
      description: data.description || null,
      subtitle: data.subtitle || null,
      bannerImage: data.bannerImage || null,
      discountType: data.discountType || 'percentage',
      discountValue: parseFloat(data.discountValue) || 0,
      oldPrice: data.oldPrice ? parseFloat(data.oldPrice) : null,
      price: data.price ? parseFloat(data.price) : null,
      stock: data.stock ? parseInt(data.stock) : null,
      rating: data.rating ? parseFloat(data.rating) : null,
      productId: data.productId || null,
      productName: data.productName || null,
      productImage: data.productImage || null,
      badge: data.badge || null,
      badgeColor: data.badgeColor || null,
      bgColor: data.bgColor || null,
      iconName: data.iconName || null,
      features: data.features ? data.features.split(',').map(f => f.trim()) : [],
      ctaText: data.ctaText || 'Profiter maintenant',
      active: data.active !== false,
      order: parseInt(data.order) || 0,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate)
      // ← NE PAS inclure applicableOn ici
    };
    
    await adminApi.post('/promotions', payload);
    setSuccess('Promotion créée avec succès');
    setShowForm(false);
    setFormData(null);
    fetchPromotions();
    setTimeout(() => setSuccess(''), 3000);
  } catch (err) {
    console.error('Erreur création promotion:', err);
    setError(err.response?.data?.message || 'Erreur lors de la création');
  }
};

  const handleUpdatePromotion = async (data) => {
    try {
      const payload = {
        title: data.title,
        description: data.description || null,
        subtitle: data.subtitle || null,
        bannerImage: data.bannerImage || null,
        discountType: data.discountType || 'percentage',
        discountValue: parseFloat(data.discountValue) || 0,
        oldPrice: data.oldPrice ? parseFloat(data.oldPrice) : null,
        price: data.price ? parseFloat(data.price) : null,
        stock: data.stock ? parseInt(data.stock) : null,
        rating: data.rating ? parseFloat(data.rating) : null,
        productId: data.productId || null,
        productName: data.productName || null,
        productImage: data.productImage || null,
        badge: data.badge || null,
        badgeColor: data.badgeColor || null,
        bgColor: data.bgColor || null,
        iconName: data.iconName || null,
        features: data.features ? data.features.split(',').map(f => f.trim()) : [],
        ctaText: data.ctaText || 'Profiter maintenant',
        active: data.active !== false,
        order: parseInt(data.order) || 0,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate)
      };
      
      await adminApi.put(`/promotions/${formData.id}`, payload);
      setSuccess('Promotion modifiée avec succès');
      setShowForm(false);
      setFormData(null);
      fetchPromotions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erreur modification promotion:', err);
      setError(err.response?.data?.error || 'Erreur lors de la modification');
    }
  };

  const handleDeletePromotion = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette promotion ?')) return;
    try {
      await adminApi.delete(`/promotions/${id}`);
      setSuccess('Promotion supprimée');
      fetchPromotions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const togglePromotionStatus = async (id, currentStatus) => {
    try {
      await adminApi.put(`/promotions/${id}`, { active: !currentStatus });
      setSuccess('Statut mis à jour');
      fetchPromotions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  const handleCreatePromoCode = async (data) => {
    try {
      await adminApi.post('/promo-codes', data);
      setSuccess('Code promo créé avec succès');
      setShowForm(false);
      setFormData(null);
      fetchPromoCodes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la création');
    }
  };

  const handleUpdatePromoCode = async (data) => {
    try {
      await adminApi.put(`/promo-codes/${formData.id}`, data);
      setSuccess('Code promo modifié avec succès');
      setShowForm(false);
      setFormData(null);
      fetchPromoCodes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la modification');
    }
  };

  const handleDeletePromoCode = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce code promo ?')) return;
    try {
      await adminApi.delete(`/promo-codes/${id}`);
      setSuccess('Code promo supprimé');
      fetchPromoCodes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const togglePromoCodeStatus = async (id, currentStatus) => {
    try {
      await adminApi.put(`/promo-codes/${id}`, { active: !currentStatus });
      setSuccess('Statut mis à jour');
      fetchPromoCodes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Code copié !');
    setTimeout(() => setSuccess(''), 2000);
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD'
    }).format(amount);
  };

  return (
    <div className={`min-h-screen ${isDarkTheme ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-10 shadow-sm ${isDarkTheme ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag size={28} className="text-purple-600" />
              <div>
                <h1 className={`text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>Gestion des Promotions</h1>
                <p className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>Codes promo et bannières promotionnelles</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className={`${isDarkTheme ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              ← Retour
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Messages */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${isDarkTheme ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
            <AlertCircle size={20} className={`${isDarkTheme ? 'text-red-400' : 'text-red-600'} flex-shrink-0 mt-0.5`} />
            <p className={isDarkTheme ? 'text-red-300' : 'text-red-800'}>{error}</p>
            <button onClick={() => setError('')} className={`ml-auto ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`}>
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className={`mb-6 p-4 rounded-lg ${isDarkTheme ? 'bg-green-900/30 border border-green-800' : 'bg-green-50 border border-green-200'}`}>
            <Check size={20} className={`inline mr-2 ${isDarkTheme ? 'text-green-400' : 'text-green-600'}`} />
            <span className={isDarkTheme ? 'text-green-300' : 'text-green-800'}>{success}</span>
          </div>
        )}

        {/* Tabs */}
        <div className={`flex gap-4 mb-6 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={() => {
              setActiveTab('promo-codes');
              setCurrentPage(1);
            }}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'promo-codes'
                ? 'border-purple-600 text-purple-600'
                : `border-transparent ${isDarkTheme ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
            }`}
          >
            <Tag size={18} className="inline mr-2" />
            Codes Promo
          </button>
          <button
            onClick={() => {
              setActiveTab('promotions');
              setCurrentPage(1);
            }}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'promotions'
                ? 'border-purple-600 text-purple-600'
                : `border-transparent ${isDarkTheme ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
            }`}
          >
            <Percent size={18} className="inline mr-2" />
            Bannières promotionnelles
          </button>
        </div>

        {/* Controls */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className={isDarkTheme ? 'text-gray-400' : 'text-gray-600'} />
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={`px-3 py-2 border rounded-lg text-sm ${
                isDarkTheme 
                  ? 'bg-gray-800 border-gray-700 text-gray-300' 
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              <option value="all">Tous</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
            </select>
          </div>

          <div className="flex-1 max-w-xs">
            <div className="relative">
              <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm ${
                  isDarkTheme 
                    ? 'bg-gray-800 border-gray-700 text-gray-300 placeholder-gray-500' 
                    : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                }`}
              />
            </div>
          </div>

          <button
            onClick={() => {
              setFormData(null);
              setPreviewImage('');
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            {activeTab === 'promo-codes' ? 'Nouveau Code' : 'Nouvelle Bannière'}
          </button>
        </div>

        {/* Promo Codes Tab */}
        {activeTab === 'promo-codes' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className={`inline-block w-12 h-12 border-4 rounded-full animate-spin ${isDarkTheme ? 'border-gray-700 border-t-purple-600' : 'border-purple-200 border-t-purple-600'}`}></div>
              </div>
            ) : promoCodes.length === 0 ? (
              <div className={`rounded-lg border p-12 text-center ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <Tag size={48} className="mx-auto text-gray-400 mb-4" />
                <p className={isDarkTheme ? 'text-gray-400 mb-2' : 'text-gray-600 mb-2'}>Aucun code promo</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Créer un code promo
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {promoCodes.map((promo) => (
                  <div key={promo.id} className={`rounded-lg border p-6 hover:shadow-md transition-shadow ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <code className={`text-lg font-mono font-bold px-3 py-1 rounded ${isDarkTheme ? 'text-purple-400 bg-purple-900/30' : 'text-purple-600 bg-purple-50'}`}>
                            {promo.code}
                          </code>
                          <button
                            onClick={() => copyToClipboard(promo.code)}
                            className={isDarkTheme ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}
                            title="Copier le code"
                          >
                            <Copy size={16} />
                          </button>
                          {!promo.active && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${isDarkTheme ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'}`}>
                              <EyeOff size={14} />
                              Désactivé
                            </span>
                          )}
                        </div>
                        {promo.description && (
                          <p className={isDarkTheme ? 'text-gray-400 text-sm' : 'text-gray-600 text-sm'}>{promo.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setFormData(promo);
                            setShowForm(true);
                          }}
                          className={isDarkTheme ? 'p-2 text-gray-500 hover:text-gray-300' : 'p-2 text-gray-400 hover:text-gray-600'}
                          title="Modifier"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeletePromoCode(promo.id)}
                          className="p-2 text-red-400 hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div>
                        <p className={`text-xs mb-1 ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>Réduction</p>
                        <p className={`text-lg font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
                          {promo.discountValue}{promo.discountType === 'percentage' ? '%' : ' DH'}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs mb-1 ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>Type</p>
                        <p className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-900'}`}>
                          {promo.applicableOn === 'global' ? 'Global' : promo.applicableOn === 'product' ? 'Produit' : 'Catégorie'}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs mb-1 ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>Utilisations</p>
                        <p className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-900'}`}>
                          {promo.usageCount}{promo.usageLimit ? `/${promo.usageLimit}` : ''}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs mb-1 ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>Expiration</p>
                        <p className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-900'}`}>
                          {promo.expiryDate ? formatDate(promo.expiryDate) : 'Sans limite'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      {promo.minPurchaseAmount > 0 && (
                        <span className={`text-xs ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>
                          Montant minimum: {formatCurrency(promo.minPurchaseAmount)}
                        </span>
                      )}
                      <button
                        onClick={() => togglePromoCodeStatus(promo.id, promo.active)}
                        className={`ml-auto px-3 py-1 rounded text-sm font-medium transition-colors ${
                          promo.active
                            ? isDarkTheme ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-green-50 text-green-700 hover:bg-green-100'
                            : isDarkTheme ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {promo.active ? 'Actif' : 'Inactif'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={`flex items-center justify-between mt-6 pt-6 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                  Affichage {(currentPage - 1) * limit + 1} à {Math.min(currentPage * limit, total)} sur {total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 border rounded-lg disabled:opacity-50 ${
                      isDarkTheme 
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Précédent
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-lg transition-colors ${
                          pageNum === currentPage
                            ? 'bg-purple-600 text-white'
                            : isDarkTheme 
                              ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' 
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 border rounded-lg disabled:opacity-50 ${
                      isDarkTheme 
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Promotions Tab */}
        {activeTab === 'promotions' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className={`inline-block w-12 h-12 border-4 rounded-full animate-spin ${isDarkTheme ? 'border-gray-700 border-t-purple-600' : 'border-purple-200 border-t-purple-600'}`}></div>
              </div>
            ) : promotions.length === 0 ? (
              <div className={`rounded-lg border p-12 text-center ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <Percent size={48} className="mx-auto text-gray-400 mb-4" />
                <p className={isDarkTheme ? 'text-gray-400 mb-2' : 'text-gray-600 mb-2'}>Aucune promotion</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Créer une promotion
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {promotions.map((promotion) => (
                  <div key={promotion.id} className={`rounded-lg border overflow-hidden hover:shadow-md transition-shadow ${isDarkTheme ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex flex-col md:flex-row">
                      {/* Image */}
                      <div className={`w-full md:w-48 h-32 md:h-auto flex items-center justify-center p-4 ${isDarkTheme ? 'bg-gradient-to-r from-purple-900/30 to-pink-900/30' : 'bg-gradient-to-r from-purple-50 to-pink-50'}`}>
                        {promotion.bannerImage ? (
                          <img
                            src={promotion.bannerImage}
                            alt={promotion.title}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Image size={48} className={isDarkTheme ? 'text-gray-600' : 'text-gray-300'} />
                        )}
                      </div>

                      {/* Contenu */}
                      <div className="flex-1 p-6">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className={`text-lg font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>{promotion.title}</h3>
                            {promotion.subtitle && (
                              <p className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>{promotion.subtitle}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setFormData(promotion);
                                setShowForm(true);
                              }}
                              className={isDarkTheme ? 'p-2 text-gray-500 hover:text-gray-300' : 'p-2 text-gray-400 hover:text-gray-600'}
                              title="Modifier"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDeletePromotion(promotion.id)}
                              className="p-2 text-red-400 hover:text-red-600"
                              title="Supprimer"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${isDarkTheme ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-700'}`}>
                            {promotion.discountValue}{promotion.discountType === 'percentage' ? '%' : ' DH'} de réduction
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${isDarkTheme ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'}`}>
                            {new Date(promotion.startDate) <= new Date() && new Date(promotion.endDate) >= new Date() ? 'En cours' : 'À venir'}
                          </span>
                          {!promotion.active && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${isDarkTheme ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'}`}>
                              <EyeOff size={14} />
                              Désactivée
                            </span>
                          )}
                        </div>

                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                          <div>
                            <p className={`text-xs mb-1 ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>Début</p>
                            <p className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-900'}`}>{formatDate(promotion.startDate)}</p>
                          </div>
                          <div>
                            <p className={`text-xs mb-1 ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>Fin</p>
                            <p className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-900'}`}>{formatDate(promotion.endDate)}</p>
                          </div>
                          <div>
                            <p className={`text-xs mb-1 ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>Produit</p>
                            <p className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-900'}`}>{promotion.productName || 'Tous produits'}</p>
                          </div>
                          <div>
                            <p className={`text-xs mb-1 ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>Ordre</p>
                            <p className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-900'}`}>{promotion.order}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          {promotion.stock && promotion.stock < 50 && (
                            <span className={isDarkTheme ? 'text-xs text-orange-400' : 'text-xs text-orange-600'}>Plus que {promotion.stock} exemplaires</span>
                          )}
                          <button
                            onClick={() => togglePromotionStatus(promotion.id, promotion.active)}
                            className={`ml-auto px-3 py-1 rounded text-sm font-medium transition-colors ${
                              promotion.active
                                ? isDarkTheme ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-green-50 text-green-700 hover:bg-green-100'
                                : isDarkTheme ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {promotion.active ? 'Activée' : 'Désactivée'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={`flex items-center justify-between mt-6 pt-6 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                  Affichage {(currentPage - 1) * limit + 1} à {Math.min(currentPage * limit, total)} sur {total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 border rounded-lg disabled:opacity-50 ${
                      isDarkTheme 
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Précédent
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-lg transition-colors ${
                          pageNum === currentPage
                            ? 'bg-purple-600 text-white'
                            : isDarkTheme 
                              ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' 
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 border rounded-lg disabled:opacity-50 ${
                      isDarkTheme 
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Formulaire Promotion */}
      {showForm && activeTab === 'promotions' && (
        <PromotionFormModal
          data={formData}
          onSubmit={formData ? handleUpdatePromotion : handleCreatePromotion}
          onClose={() => {
            setShowForm(false);
            setFormData(null);
          }}
          formatDate={formatDate}
          availableIcons={AVAILABLE_ICONS}
        />
      )}

      {/* Modal Formulaire Code Promo */}
      {showForm && activeTab === 'promo-codes' && (
        <PromoCodeFormModal
          data={formData}
          onSubmit={formData ? handleUpdatePromoCode : handleCreatePromoCode}
          onClose={() => {
            setShowForm(false);
            setFormData(null);
          }}
        />
      )}
    </div>
  );
};

// Composant Formulaire Promotion
// Composant Formulaire Promotion AMÉLIORÉ avec upload d'image
const PromotionFormModal = ({ data, onSubmit, onClose, formatDate, availableIcons }) => {
  const [formData, setFormData] = useState({
    title: data?.title || '',
    subtitle: data?.subtitle || '',
    description: data?.description || '',
    bannerImage: data?.bannerImage || '',
    productId: data?.productId || '',
    productName: data?.productName || '',
    productImage: data?.productImage || '',
    discountType: data?.discountType || 'percentage',
    discountValue: data?.discountValue || '',
    oldPrice: data?.oldPrice || '',
    price: data?.price || '',
    stock: data?.stock || '',
    rating: data?.rating || '',
    badge: data?.badge || 'PROMO',
    badgeColor: data?.badgeColor || '#ef4444',
    bgColor: data?.bgColor || '#ffffff',
    iconName: data?.iconName || 'Zap',
    features: data?.features ? (Array.isArray(data.features) ? data.features.join(', ') : data.features) : '',
    ctaText: data?.ctaText || 'Profiter maintenant',
active: data ? data.active : true,
    order: data?.order || 0,
    startDate: data?.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '',
    endDate: data?.endDate ? new Date(data.endDate).toISOString().split('T')[0] : ''
  });
  
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(data?.bannerImage || '');
  const [activeTab, setActiveTab] = useState('form'); // 'form' ou 'preview'

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Fonction d'upload d'image
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('L\'image ne doit pas dépasser 5MB');
      return;
    }

    setUploading(true);
    const formDataImg = new FormData();
    formDataImg.append('image', file);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Vous devez être connecté pour uploader une image');
        setUploading(false);
        return;
      }

      // Utiliser la route d'upload avec le token correctement
      const response = await fetch('http://localhost:5000/api/upload/product', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Ne pas définir Content-Type, fetch le fera automatiquement pour FormData
        },
        body: formDataImg
      });
      
      // Vérifier si la réponse est du JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Réponse non JSON:', text);
        throw new Error('Erreur serveur: réponse non JSON');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'upload');
      }

      const result = await response.json();
      if (result.url) {
        // Cloudinary retourne une URL complète, l'utiliser directement
        const imageUrl = result.url;
        setImagePreview(imageUrl);
        setFormData(prev => ({ ...prev, bannerImage: imageUrl }));
        setError('');
      } else {
        setError('Erreur lors de l\'upload: URL non retournée');
      }
    } catch (err) {
      console.error('Erreur upload:', err);
      setError(err.message || 'Erreur lors de l\'upload de l\'image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.title) {
      setError('Le titre est requis');
      return;
    }
    
    if (!formData.startDate || !formData.endDate) {
      setError('Les dates de début et fin sont requises');
      return;
    }
    
    onSubmit(formData);
  };

  const selectedIcon = availableIcons.find(icon => icon.name === formData.iconName);
  
  // Composant d'aperçu en direct
  const LivePreview = () => (
    <div className="bg-gray-100 rounded-xl p-4 sticky top-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Eye size={16} /> Aperçu en direct
        </h3>
        <span className="text-xs text-gray-500">Ce que verront les clients</span>
      </div>
      
      {/* Design stable - Cadre blanc avec photo qui change */}
      <div 
        className="rounded-2xl overflow-hidden shadow-lg transition-all duration-300"
        style={{ backgroundColor: formData.bgColor || '#ffffff' }}
      >
        {/* Zone image */}
        <div className="relative h-48 overflow-hidden bg-gray-100">
          {imagePreview ? (
            <>
              <img 
                src={imagePreview.startsWith('http') ? imagePreview : `http://localhost:5000${imagePreview}`} 
                alt={formData.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <Image size={48} className="text-gray-400" />
              <p className="text-xs text-gray-400 ml-2">Aucune image</p>
            </div>
          )}
          
          {/* Badge flottant */}
          <div className="absolute top-3 left-3">
            <span 
              className="px-3 py-1 rounded-full text-sm font-bold text-white shadow-md"
              style={{ backgroundColor: formData.badgeColor || '#ef4444' }}
            >
              {formData.badge || 'PROMO'}
            </span>
          </div>
          
          {/* Pourcentage de réduction */}
          {formData.discountValue && (
            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm rounded-full px-3 py-1">
              <span className="text-white font-bold text-sm">
                -{formData.discountValue}{formData.discountType === 'percentage' ? '%' : ' DH'}
              </span>
            </div>
          )}
        </div>
        
        {/* Contenu texte sur fond blanc */}
        <div className="p-5 bg-white">
          {/* Titre */}
          <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1">
            {formData.title || 'Titre de la promotion'}
          </h3>
          
          {/* Sous-titre */}
          {formData.subtitle && (
            <p className="text-sm text-gray-500 mb-2 line-clamp-1">
              {formData.subtitle}
            </p>
          )}
          
          {/* Prix (optionnel) */}
          {(formData.price || formData.oldPrice) && (
            <div className="flex items-center gap-2 mb-2">
              {formData.oldPrice && (
                <span className="text-sm text-gray-400 line-through">
                  {parseFloat(formData.oldPrice).toFixed(2)} DH
                </span>
              )}
              {formData.price && (
                <span className="text-xl font-bold text-red-600">
                  {parseFloat(formData.price).toFixed(2)} DH
                </span>
              )}
            </div>
          )}
          
          {/* Description */}
          {formData.description && (
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {formData.description}
            </p>
          )}
          
          {/* Points forts */}
          {formData.features && formData.features.split(',').length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {formData.features.split(',').slice(0, 2).map((feature, idx) => (
                <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  ✓ {feature.trim()}
                </span>
              ))}
              {formData.features.split(',').length > 2 && (
                <span className="text-xs text-gray-400">+{formData.features.split(',').length - 2}</span>
              )}
            </div>
          )}
          
          {/* Bouton CTA */}
          <button 
            className="w-full py-2.5 rounded-xl font-medium transition-all duration-200 transform hover:scale-[1.02]"
            style={{ 
              backgroundColor: formData.badgeColor || '#ef4444',
              color: 'white'
            }}
          >
            {formData.ctaText || 'Profiter maintenant'}
          </button>
        </div>
      </div>
      
      {/* Badge de statut */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {formData.startDate && formData.endDate ? (
            `${new Date(formData.startDate).toLocaleDateString('fr-FR')} → ${new Date(formData.endDate).toLocaleDateString('fr-FR')}`
          ) : (
            'Dates non définies'
          )}
        </span>
        {formData.active ? (
          <span className="flex items-center gap-1 text-green-600">
            <Check size={12} /> Active
          </span>
        ) : (
          <span className="flex items-center gap-1 text-gray-400">
            <EyeOff size={12} /> Inactive
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header avec onglets */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">
              {data ? '✏️ Modifier la promotion' : '✨ Créer une promotion'}
            </h2>
            <div className="flex gap-2 ml-4">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  activeTab === 'form' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Formulaire
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  activeTab === 'preview' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Aperçu
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-start gap-2">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Upload d'image */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-purple-400 transition">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image de la promotion
                </label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading}
                      className="hidden"
                      id="imageUpload"
                    />
                    <label
                      htmlFor="imageUpload"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition"
                    >
                      {uploading ? (
                        <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload size={18} />
                      )}
                      <span className="text-sm">
                        {uploading ? 'Upload en cours...' : 'Choisir une image'}
                      </span>
                    </label>
                    <p className="text-xs text-gray-400 mt-2">
                      JPG, PNG, GIF. Max 5MB
                    </p>
                  </div>
                  {imagePreview && (
                    <div className="relative w-20 h-20 flex-shrink-0">
                      <img 
                        src={imagePreview.startsWith('http') ? imagePreview : `http://localhost:5000${imagePreview}`} 
                        alt="Preview" 
                        className="w-full h-full object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => { 
                          setImagePreview(''); 
                          setFormData(prev => ({ ...prev, bannerImage: '' }));
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Ex: OFFRE FLASH - Hydratation Max"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sous-titre</label>
                  <input
                    type="text"
                    name="subtitle"
                    value={formData.subtitle}
                    onChange={handleChange}
                    placeholder="Ex: Jusqu'à épuisement des stocks"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="2"
                    placeholder="Description détaillée de la promotion..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Badge et couleur */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Badge</label>
                  <input
                    type="text"
                    name="badge"
                    value={formData.badge}
                    onChange={handleChange}
                    placeholder="PROMO, FLASH, EXCLUSIF..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couleur badge</label>
                  <input
                    type="color"
                    name="badgeColor"
                    value={formData.badgeColor}
                    onChange={handleChange}
                    className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Prix */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix promotionnel (DH)</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    step="0.01"
                    placeholder="64.95"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ancien prix (DH)</label>
                  <input
                    type="number"
                    name="oldPrice"
                    value={formData.oldPrice}
                    onChange={handleChange}
                    step="0.01"
                    placeholder="129.90"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Dates */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de début *</label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin *</label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Réduction - Uniquement pourcentage avec calcul automatique */}
                {formData.oldPrice && formData.price ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      <span className="font-medium">Taux de réduction calculé :</span>
                      <span className="ml-2 text-lg font-bold text-green-600">
                        {formData.oldPrice > 0 ? Math.round(((1 - formData.price / formData.oldPrice) * 100) * 100) / 100 : 0}%
                      </span>
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Ancien prix: {parseFloat(formData.oldPrice).toFixed(2)} DH → Nouveau prix: {parseFloat(formData.price).toFixed(2)} DH
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Remplissez l'ancien prix et le prix promotionnel pour calculer automatiquement le taux de réduction.
                  </p>
                )}

                {/* Points forts */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points forts (séparés par des virgules)</label>
                  <textarea
                    name="features"
                    value={formData.features}
                    onChange={handleChange}
                    rows="2"
                    placeholder="Hydratation 24h, Non comédogène, Texture légère"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Bouton CTA */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Texte du bouton</label>
                  <input
                    type="text"
                    name="ctaText"
                    value={formData.ctaText}
                    onChange={handleChange}
                    placeholder="Profiter maintenant"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Couleur de fond */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couleur de fond</label>
                  <input
                    type="color"
                    name="bgColor"
                    value={formData.bgColor}
                    onChange={handleChange}
                    className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Ordre et activation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordre d'affichage</label>
                  <input
                    type="number"
                    name="order"
                    value={formData.order}
                    onChange={handleChange}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    name="active"
                    id="active"
                    checked={formData.active}
                    onChange={handleChange}
                    className="w-4 h-4 text-purple-600 rounded border-gray-300"
                  />
                  <label htmlFor="active" className="text-sm text-gray-700">Promotion active</label>
                </div>
              </div>

              {/* Boutons formulaire */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  {data ? 'Mettre à jour' : 'Créer la promotion'}
                </button>
              </div>
            </form>
          ) : (
            <LivePreview />
          )}
        </div>
      </div>
    </div>
  );
};

// Composant Formulaire Code Promo
const PromoCodeFormModal = ({ data, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    code: data?.code || '',
    description: data?.description || '',
    discountType: data?.discountType || 'percentage',
    discountValue: data?.discountValue || '',
    minPurchaseAmount: data?.minPurchaseAmount || '',
    maxDiscountAmount: data?.maxDiscountAmount || '',
    usageLimit: data?.usageLimit || '',
    expiryDate: data?.expiryDate ? new Date(data.expiryDate).toISOString().split('T')[0] : '',
    applicableOn: data?.applicableOn || 'global',
    categoryId: data?.categoryId || '',
    productId: data?.productId || '',
    active: data?.active !== false
  });

  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.code) {
      setError('Le code est requis');
      return;
    }

    if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
      setError('La valeur de réduction doit être supérieure à 0');
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {data ? '✏️ Modifier le code promo' : '✨ Créer un code promo'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-start gap-2">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code promo *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="Ex: PROMO20"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 uppercase font-mono"
              />
              <button
                type="button"
                onClick={generateCode}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                title="Générer un code aléatoire"
              >
                <Zap size={18} />
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Ex: Réduction de 20% pour les nouveaux clients"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Type et valeur de réduction */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de réduction *
              </label>
              <select
                name="discountType"
                value={formData.discountType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              >
                <option value="percentage">Pourcentage (%)</option>
                <option value="fixed">Montant fixe (DH)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valeur *
              </label>
              <input
                type="number"
                name="discountValue"
                value={formData.discountValue}
                onChange={handleChange}
                placeholder="20"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Montant minimum et maximum */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant minimum (DH)
              </label>
              <input
                type="number"
                name="minPurchaseAmount"
                value={formData.minPurchaseAmount}
                onChange={handleChange}
                placeholder="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Réduction max (DH)
              </label>
              <input
                type="number"
                name="maxDiscountAmount"
                value={formData.maxDiscountAmount}
                onChange={handleChange}
                placeholder="Optionnel"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Limite d'utilisation et expiration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Limite d'utilisations
              </label>
              <input
                type="number"
                name="usageLimit"
                value={formData.usageLimit}
                onChange={handleChange}
                placeholder="Illimité si vide"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'expiration
              </label>
              <input
                type="date"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Applicable sur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Applicable sur
            </label>
            <select
              name="applicableOn"
              value={formData.applicableOn}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="global">Toute la commande</option>
              <option value="category">Catégorie spécifique</option>
              <option value="product">Produit spécifique</option>
            </select>
          </div>

          {/* Statut */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="active"
              id="active"
              checked={formData.active}
              onChange={handleChange}
              className="w-4 h-4 text-purple-600 rounded border-gray-300"
            />
            <label htmlFor="active" className="text-sm text-gray-700">
              Code promo actif
            </label>
          </div>

          {/* Boutons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              {data ? 'Mettre à jour' : 'Créer le code promo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPromotions;
