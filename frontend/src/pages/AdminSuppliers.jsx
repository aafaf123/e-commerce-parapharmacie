// frontend/src/pages/AdminSuppliers.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Plus, Edit, Trash2, Save, X, Search,
  Package, DollarSign, Phone, Mail, MapPin, Globe,
  AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, ArrowLeft,
  TrendingUp, AlertTriangle, Clock, FileText
} from 'lucide-react';
import adminApi from '../api/adminAxios';
import axios from '../api/axios';
import { usePermissions } from '../context/PermissionsContext';

const AdminSuppliers = () => {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const btn = (allowed, cls) => allowed ? cls : cls + ' opacity-40 cursor-not-allowed pointer-events-none';
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Nouveaux états pour les statistiques
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [pendingValidation, setPendingValidation] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    description: '',
    deliveryDays: 3,
    paymentTerms: '',
    autoDiscount: '',
    active: true
  });

  useEffect(() => {
    checkAuth();
    fetchSuppliers();
  }, [currentPage, searchTerm]);

  useEffect(() => {
    if (showStats) {
      fetchStats();
    }
  }, [showStats]);

  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token) {
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
    } catch (error) {
      navigate('/login');
      return;
    }
    
    adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit: 20 };
      if (searchTerm) params.search = searchTerm;
      
      const { data } = await adminApi.get('/suppliers', { params });
      setSuppliers(data.suppliers);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setError('Erreur lors du chargement des fournisseurs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = async () => {
    if (!supplierForm.name) {
      setError('Le nom du fournisseur est requis');
      return;
    }

    try {
      await adminApi.post('/suppliers', supplierForm);
      setSuccess('Fournisseur créé avec succès');
      setShowModal(false);
      resetForm();
      fetchSuppliers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la création');
    }
  };

  const handleUpdateSupplier = async () => {
    if (!supplierForm.name) {
      setError('Le nom du fournisseur est requis');
      return;
    }

    try {
      await adminApi.put(`/suppliers/${editingSupplier.id}`, supplierForm);
      setSuccess('Fournisseur modifié avec succès');
      setShowModal(false);
      setEditingSupplier(null);
      resetForm();
      fetchSuppliers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la modification');
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le fournisseur "${supplier.name}" ?`)) return;

    try {
      await adminApi.delete(`/suppliers/${supplier.id}`);
      setSuccess('Fournisseur supprimé avec succès');
      fetchSuppliers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setSupplierForm({
      name: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      website: '',
      description: '',
      deliveryDays: 3,
      paymentTerms: '',
      autoDiscount: '',
      active: true
    });
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const { data } = await adminApi.get('/suppliers/stats');
      setStats(data.summary);
      setPendingValidation(data.pendingValidation || []);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleValidateOrder = async (orderId) => {
    if (!confirm('Voulez-vous valider ce bon de commande ?')) return;
    
    try {
      await adminApi.put(`/purchase-orders/${orderId}/validate`);
      setSuccess('Bon de commande validé');
      fetchStats();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la validation');
    }
  };

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      website: supplier.website || '',
      description: supplier.description || '',
      deliveryDays: supplier.deliveryDays || 3,
      paymentTerms: supplier.paymentTerms || '',
      autoDiscount: supplier.autoDiscount?.toString() || '',
      active: supplier.active
    });
    setShowModal(true);
  };

  if (loading && suppliers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-sky-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
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
            <Truck size={28} className="text-sky-700" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestion des Fournisseurs</h1>
              <p className="text-sm text-gray-600">Gestion des fournisseurs et achats</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-2 py-6">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-red-600">
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <Check size={20} className="inline mr-2 text-green-600" />
            <span className="text-green-800">{success}</span>
          </div>
        )}

        {/* Barre de recherche et bouton ajout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="relative flex-1 sm:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un fournisseur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStats(!showStats)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showStats ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-100 text-gray-700 border border-gray-300'
              }`}
            >
              <TrendingUp size={18} />
              Statistiques
            </button>
            <button
              onClick={() => {
                resetForm();
                setEditingSupplier(null);
                setShowModal(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors"
            >
              <Plus size={18} />
              Nouveau fournisseur
            </button>
          </div>
        </div>

        {/* Section Statistiques */}
        {showStats && (
          <div className="mb-6 space-y-4">
            {loadingStats ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 size={32} className="animate-spin text-sky-700" />
              </div>
            ) : (
              <>
                {/* Cartes de statistiques */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <TrendingUp size={16} />
                      Mois en cours
                    </div>
                    <div className="text-2xl font-bold text-sky-700">
                      {stats?.currentMonthTotal?.toFixed(2) || 0} DH
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <TrendingUp size={16} />
                      Mois dernier
                    </div>
                    <div className="text-2xl font-bold text-gray-700">
                      {stats?.lastMonthTotal?.toFixed(2) || 0} DH
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <TrendingUp size={16} />
                      Total général
                    </div>
                    <div className="text-2xl font-bold text-green-700">
                      {stats?.totalGeneral?.toFixed(2) || 0} DH
                    </div>
                  </div>
                </div>

                {/* Alertes seuils de remise */}
                {stats?.thresholdAlerts && stats.thresholdAlerts.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2">
                      <AlertTriangle size={20} />
                      Alertes : Seuils de remise bientôt atteints
                    </div>
                    <div className="space-y-2">
                      {stats.thresholdAlerts.map((alert, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border border-amber-200">
                          <div>
                            <span className="font-medium">{alert.supplier}</span>
                            <span className="text-sm text-gray-600 ml-2">
                              ({alert.currentAmount?.toFixed(2) || 0} DH / {alert.threshold} DH)
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-amber-600 font-bold">{alert.percentage}%</span>
                            <span className="text-sm text-gray-600 ml-1">du seuil</span>
                            <span className="text-sm text-gray-600 ml-2">→ -{alert.discountPercentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bons en attente de validation */}
                {pendingValidation && pendingValidation.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-orange-800 font-semibold mb-2">
                      <Clock size={20} />
                      Bons en attente de validation ({pendingValidation.length})
                    </div>
                    <div className="space-y-2">
                      {pendingValidation.map((order) => (
                        <div key={order.id} className="flex items-center justify-between bg-white p-3 rounded border border-orange-200">
                          <div>
                            <span className="font-medium">{order.orderNumber}</span>
                            <span className="text-sm text-gray-600 ml-2">
                              {order.supplier?.name} - {order.totalAmount?.toFixed(2)} DH
                            </span>
                          </div>
                          <button
                            onClick={() => handleValidateOrder(order.id)}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            Valider
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tableau des fournisseurs */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Email / Téléphone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Produits</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{supplier.name}</div>
                      {supplier.website && (
                        <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 hover:underline">
                          <Globe size={12} className="inline mr-1" />
                          {supplier.website}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {supplier.contactName || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {supplier.email && <div className="flex items-center gap-1"><Mail size={12} />{supplier.email}</div>}
                      {supplier.phone && <div className="flex items-center gap-1"><Phone size={12} />{supplier.phone}</div>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {supplier._count.products} produit(s)
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        supplier.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {supplier.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => navigate(`/admin/suppliers/${supplier.id}/products`)}
                        className="text-sky-600 hover:text-sky-900 mr-3"
                        title="Voir les produits"
                      >
                        <Package size={18} />
                      </button>
                      <button
                        onClick={() => openEditModal(supplier)}
                        className="text-sky-600 hover:text-sky-900 mr-3"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(supplier)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-6 py-3 rounded-lg shadow-sm mt-6">
            <div className="text-sm text-gray-700">
              Affichage de {((pagination.page - 1) * pagination.limit) + 1} à{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} sur{' '}
              {pagination.total}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-700">
                Page {pagination.page} sur {pagination.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Fournisseur */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingSupplier(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du fournisseur *
                  </label>
                  <input
                    type="text"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    placeholder="Ex: Laboratoire CeraVe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Personne de contact
                  </label>
                  <input
                    type="text"
                    value={supplierForm.contactName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                    placeholder="Ex: Jean Dupont"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="email"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                      placeholder="contact@fournisseur.ma"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone
                  </label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="tel"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      placeholder="+212 5 XX XX XX XX"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adresse
                  </label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      value={supplierForm.address}
                      onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                      placeholder="Adresse complète"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site web
                  </label>
                  <div className="relative">
                    <Globe size={18} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      value={supplierForm.website}
                      onChange={(e) => setSupplierForm({ ...supplierForm, website: e.target.value })}
                      placeholder="https://..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Délai de livraison (jours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={supplierForm.deliveryDays}
                    onChange={(e) => setSupplierForm({ ...supplierForm, deliveryDays: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conditions de paiement
                  </label>
                  <input
                    type="text"
                    value={supplierForm.paymentTerms || ''}
                    onChange={(e) => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })}
                    placeholder="Ex: 30 jours fin de mois"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remise automatique (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={supplierForm.autoDiscount || ''}
                    onChange={(e) => setSupplierForm({ ...supplierForm, autoDiscount: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Ex: 5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={supplierForm.description}
                    onChange={(e) => setSupplierForm({ ...supplierForm, description: e.target.value })}
                    rows="3"
                    placeholder="Informations complémentaires..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={supplierForm.active}
                      onChange={(e) => setSupplierForm({ ...supplierForm, active: e.target.checked })}
                      className="w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500"
                    />
                    <span className="text-sm text-gray-700">Fournisseur actif</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingSupplier(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={editingSupplier ? handleUpdateSupplier : handleCreateSupplier}
                  className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Save size={18} />
                  {editingSupplier ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSuppliers;