// frontend/src/pages/AdminSupplierProducts.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Truck, Plus, Edit, Trash2, Save, X, Search, Package,
  DollarSign, AlertCircle, Check, Loader2, ArrowLeft, Link as LinkIcon, Percent, Ticket
} from 'lucide-react';
import adminApi from '../api/adminAxios';

const AdminSupplierProducts = () => {
  const navigate = useNavigate();
  const { supplierId } = useParams();
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState(null);
  const [linkedProducts, setLinkedProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // États pour les avoirs
  const [credits, setCredits] = useState([]);
  const [creditsSummary, setCreditsSummary] = useState(null);

  const [linkForm, setLinkForm] = useState({
    productId: '',
    price: '',
    reference: ''
  });

  const [creditForm, setCreditForm] = useState({
    amount: '',
    reason: '',
    expiresAt: ''
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (supplierId) {
      fetchSupplier();
      fetchLinkedProducts();
      fetchAllProducts();
      fetchCredits();
    }
  }, [supplierId]);

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

  const fetchSupplier = async () => {
    try {
      const { data } = await adminApi.get(`/suppliers/${supplierId}`);
      setSupplier(data.supplier);
    } catch (error) {
      console.error('Error fetching supplier:', error);
    }
  };

  const fetchLinkedProducts = async () => {
    try {
      const { data } = await adminApi.get(`/suppliers/${supplierId}/products`);
      setLinkedProducts(data);
    } catch (error) {
      console.error('Error fetching linked products:', error);
    }
  };

  const fetchAllProducts = async () => {
    try {
      const { data } = await adminApi.get('/products?limit=1000');
      setAllProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkProduct = async () => {
    if (!linkForm.productId || !linkForm.price) {
      setError('Sélectionnez un produit et entrez le prix');
      return;
    }

    try {
      await adminApi.post(`/suppliers/${supplierId}/link-product`, {
        productId: linkForm.productId,
        price: parseFloat(linkForm.price),
        reference: linkForm.reference
      });
      setSuccess('Produit lié avec succès');
      setShowModal(false);
      resetForm();
      fetchLinkedProducts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la liaison');
    }
  };

  const handleUnlinkProduct = async (productId) => {
    if (!confirm('Voulez-vous délier ce produit?')) return;

    try {
      await adminApi.delete(`/suppliers/${supplierId}/unlink-product/${productId}`);
      setSuccess('Produit délié');
      fetchLinkedProducts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la déliaison');
    }
  };

  const resetForm = () => {
    setLinkForm({
      productId: '',
      price: '',
      reference: ''
    });
    setSelectedProduct(null);
  };

  const fetchCredits = async () => {
    try {
      const { data } = await adminApi.get(`/suppliers/${supplierId}/credits`);
      setCredits(data.credits || []);
      setCreditsSummary(data.summary);
    } catch (error) {
      console.error('Error fetching credits:', error);
    }
  };

  const handleCreateCredit = async () => {
    if (!creditForm.amount || parseFloat(creditForm.amount) <= 0) {
      setError('Montant invalide');
      return;
    }
    if (!creditForm.expiresAt) {
      setError('Date d\'expiration requise');
      return;
    }

    try {
      const { data } = await adminApi.post(`/suppliers/${supplierId}/credits`, {
        amount: creditForm.amount,
        reason: creditForm.reason,
        expiresAt: creditForm.expiresAt
      });
      setSuccess('Avoir créé avec succès');
      setShowCreditModal(false);
      setCreditForm({ amount: '', reason: '', expiresAt: '' });
      fetchCredits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la création de l\'avoir');
    }
  };

  const handleDeleteCredit = async (creditId) => {
    if (!confirm('Voulez-vous supprimer cet avoir ?')) return;

    try {
      await adminApi.delete(`/suppliers/${supplierId}/credits/${creditId}`);
      setSuccess('Avoir supprimé');
      fetchCredits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const isCreditExpired = (expiresAt) => {
    return new Date(expiresAt) < new Date();
  };

  const openLinkModal = (product = null) => {
    if (product) {
      setSelectedProduct(product);
      setLinkForm({
        productId: product.productId,
        price: product.price?.toString() || '',
        reference: product.reference || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const getUnlinkedProducts = () => {
    const linkedIds = new Set(linkedProducts.map(p => p.productId));
    return allProducts.filter(p => !linkedIds.has(p.id));
  };

  const calculateMargin = (priceHT, priceTTC) => {
    if (!priceHT || !priceTTC) return 0;
    return ((priceTTC - priceHT) / priceHT * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-sky-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/suppliers')}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="h-8 w-px bg-gray-200"></div>
            <Truck size={28} className="text-sky-700" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{supplier?.name}</h1>
              <p className="text-sm text-gray-600">Produits fournis</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowCreditModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors text-sm"
              >
                <Ticket size={16} />
                Créer un avoir
              </button>
              <button
                onClick={() => navigate(`/admin/suppliers/${supplierId}/discounts`)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm"
              >
                <Percent size={16} />
                Remises
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
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

        {/* Section Avoirs */}
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-green-800 font-semibold">
              <Ticket size={20} />
              Avoirs disponibles
              {creditsSummary && (
                <span className="text-sm font-normal text-green-600 ml-2">
                  ({creditsSummary.available} / {creditsSummary.total} - {creditsSummary.totalAvailable?.toFixed(2)} DH)
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCreditModal(true)}
              className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
            >
              <Plus size={14} />
              Créer un avoir
            </button>
          </div>
          
          {credits.length === 0 ? (
            <p className="text-sm text-green-700">Aucun avoir pour ce fournisseur.</p>
          ) : (
            <div className="space-y-2">
              {credits.map(credit => (
                <div key={credit.id} className={`flex items-center justify-between p-3 rounded border ${
                  credit.used ? 'bg-gray-100 border-gray-300' : 
                  isCreditExpired(credit.expiresAt) ? 'bg-red-50 border-red-200' :
                  'bg-white border-green-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold text-lg ${
                      credit.used ? 'text-gray-400' : 
                      isCreditExpired(credit.expiresAt) ? 'text-red-600 line-through' :
                      'text-green-700'
                    }`}>
                      {credit.amount?.toFixed(2)} DH
                    </span>
                    <div className="text-sm">
                      {credit.reason && <div className="text-gray-600">{credit.reason}</div>}
                      <div className="text-gray-500">
                        Expire: {formatDate(credit.expiresAt)}
                        {credit.used && <span className="text-red-600 ml-2">- UTILISÉ</span>}
                        {!credit.used && isCreditExpired(credit.expiresAt) && <span className="text-red-600 ml-2">- EXPIRÉ</span>}
                      </div>
                    </div>
                  </div>
                  {!credit.used && !isCreditExpired(credit.expiresAt) && (
                    <button
                      onClick={() => handleDeleteCredit(credit.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="relative flex-1 sm:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <button
            onClick={() => openLinkModal()}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors"
          >
            <LinkIcon size={18} />
            Lier un produit
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix achat</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix vente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marge</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Référence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {linkedProducts
                  .filter(p => !searchTerm || p.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{item.product?.name}</div>
                        <div className="text-xs text-gray-500">Stock: {item.product?.stock}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.product?.category?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-green-600 font-medium">{item.price?.toFixed(2)} €</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.product?.priceTTC?.toFixed(2)} €
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-medium ${calculateMargin(item.price, item.product?.priceTTC) >= 20 ? 'text-green-600' : 'text-orange-600'}`}>
                          {calculateMargin(item.price, item.product?.priceTTC)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.reference || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => openLinkModal(item)}
                          className="text-sky-600 hover:text-sky-900 mr-3"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleUnlinkProduct(item.productId)}
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
          {linkedProducts.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Package size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Aucun produit lié à ce fournisseur</p>
              <button
                onClick={() => openLinkModal()}
                className="mt-4 text-sky-600 hover:text-sky-700"
              >
                Lier un premier produit
              </button>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedProduct ? 'Modifier le prix' : 'Lier un produit'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!selectedProduct && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Produit</label>
                  <select
                    value={linkForm.productId}
                    onChange={(e) => setLinkForm({ ...linkForm, productId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  >
                    <option value="">Sélectionner un produit</option>
                    {getUnlinkedProducts().map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {p.priceTTC?.toFixed(2)} €</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prix d'achat (HT) *
                </label>
                <div className="relative">
                  <DollarSign size={18} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={linkForm.price}
                    onChange={(e) => setLinkForm({ ...linkForm, price: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Référence fournisseur
                </label>
                <input
                  type="text"
                  value={linkForm.reference}
                  onChange={(e) => setLinkForm({ ...linkForm, reference: e.target.value })}
                  placeholder="Référence (optionnel)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>

              {linkForm.productId && linkForm.price && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">
                    Prix d'achat: <span className="font-medium">{parseFloat(linkForm.price).toFixed(2)} €</span>
                  </div>
                  {allProducts.find(p => p.id === linkForm.productId) && (
                    <>
                      <div className="text-sm text-gray-600">
                        Prix de vente: <span className="font-medium">{allProducts.find(p => p.id === linkForm.productId)?.priceTTC?.toFixed(2)} €</span>
                      </div>
                      <div className="text-sm">
                        Marge: <span className="font-medium">{calculateMargin(parseFloat(linkForm.price), allProducts.find(p => p.id === linkForm.productId)?.priceTTC)}%</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleLinkProduct}
                  className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-2"
                >
                  <Save size={18} />
                  {selectedProduct ? 'Mettre à jour' : 'Lier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Créer un avoir */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-green-200 bg-green-50">
              <h2 className="text-xl font-bold text-green-800">Créer un avoir</h2>
              <button onClick={() => setShowCreditModal(false)} className="text-green-600 hover:text-green-800">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant (DH) *
                </label>
                <div className="relative">
                  <DollarSign size={18} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={creditForm.amount}
                    onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motif (optionnel)
                </label>
                <textarea
                  value={creditForm.reason}
                  onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
                  placeholder="Raison de l'avoir..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date d'expiration *
                </label>
                <input
                  type="date"
                  value={creditForm.expiresAt}
                  onChange={(e) => setCreditForm({ ...creditForm, expiresAt: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowCreditModal(false);
                    setCreditForm({ amount: '', reason: '', expiresAt: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateCredit}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Ticket size={18} />
                  Créer l'avoir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSupplierProducts;