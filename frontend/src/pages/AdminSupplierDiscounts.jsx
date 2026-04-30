// frontend/src/pages/AdminSupplierDiscounts.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Truck, Plus, Edit, Trash2, Save, X, Search, Percent,
  DollarSign, AlertCircle, Check, Loader2, ArrowLeft, Tag, Calendar
} from 'lucide-react';
import adminApi from '../api/adminAxios';

const AdminSupplierDiscounts = () => {
  const navigate = useNavigate();
  const { supplierId } = useParams();
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState(null);
  const [discounts, setDiscounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [discountForm, setDiscountForm] = useState({
    name: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    minAmount: '',
    maxDiscount: '',
    endDate: ''
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (supplierId) {
      fetchSupplier();
      fetchDiscounts();
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

  const fetchDiscounts = async () => {
    try {
      const { data } = await adminApi.get(`/suppliers/${supplierId}/discounts`);
      setDiscounts(data);
    } catch (error) {
      console.error('Error fetching discounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDiscount = async () => {
    if (!discountForm.name || !discountForm.discountValue) {
      setError('Entrez le nom et la valeur de la remise');
      return;
    }

    try {
      await adminApi.post(`/suppliers/${supplierId}/discounts`, {
        name: discountForm.name,
        discountType: discountForm.discountType,
        discountValue: parseFloat(discountForm.discountValue),
        minAmount: discountForm.minAmount ? parseFloat(discountForm.minAmount) : 0,
        maxDiscount: discountForm.maxDiscount ? parseFloat(discountForm.maxDiscount) : null,
        endDate: discountForm.endDate || null
      });
      setSuccess('Remise créée avec succès');
      setShowModal(false);
      resetForm();
      fetchDiscounts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la création');
    }
  };

  const handleUpdateDiscount = async () => {
    if (!selectedDiscount) return;

    try {
      await adminApi.put(`/discounts/${selectedDiscount.id}`, {
        name: discountForm.name,
        discountType: discountForm.discountType,
        discountValue: parseFloat(discountForm.discountValue),
        minAmount: discountForm.minAmount ? parseFloat(discountForm.minAmount) : 0,
        maxDiscount: discountForm.maxDiscount ? parseFloat(discountForm.maxDiscount) : null,
        endDate: discountForm.endDate || null,
        active: true
      });
      setSuccess('Remise mise à jour');
      setShowModal(false);
      setSelectedDiscount(null);
      resetForm();
      fetchDiscounts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleDeleteDiscount = async (discountId) => {
    if (!confirm('Voulez-vous supprimer cette remise?')) return;

    try {
      await adminApi.delete(`/discounts/${discountId}`);
      setSuccess('Remise supprimée');
      fetchDiscounts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setDiscountForm({
      name: '',
      discountType: 'PERCENTAGE',
      discountValue: '',
      minAmount: '',
      maxDiscount: '',
      endDate: ''
    });
    setSelectedDiscount(null);
  };

  const openEditModal = (discount = null) => {
    if (discount) {
      setSelectedDiscount(discount);
      setDiscountForm({
        name: discount.name,
        discountType: discount.discountType,
        discountValue: discount.discountValue?.toString() || '',
        minAmount: discount.minAmount?.toString() || '',
        maxDiscount: discount.maxDiscount?.toString() || '',
        endDate: discount.endDate ? new Date(discount.endDate).toISOString().split('T')[0] : ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
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
              onClick={() => navigate(`/admin/suppliers/${supplierId}/products`)}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="h-8 w-px bg-gray-200"></div>
            <Percent size={28} className="text-sky-700" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Remises - {supplier?.name}</h1>
              <p className="text-sm text-gray-600">Gestion des remises et réductions</p>
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

        <div className="flex justify-between items-center gap-3 mb-6">
          <div className="text-sm text-gray-600">
            Créez des remises basées sur le montant d'achat mensuel
          </div>
          <button
            onClick={() => openEditModal()}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            Ajouter une remise
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valeur</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min. achat</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max. remise</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {discounts.map((discount) => (
                  <tr key={discount.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{discount.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {discount.discountType === 'PERCENTAGE' ? 'Pourcentage' : 'Montant fixe'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-green-600 font-medium">
                        {discount.discountType === 'PERCENTAGE' 
                          ? `${discount.discountValue}%` 
                          : `${discount.discountValue} €`}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {discount.minAmount > 0 ? `${discount.minAmount} €` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {discount.maxDiscount ? `${discount.maxDiscount} €` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {discount.endDate 
                        ? new Date(discount.endDate).toLocaleDateString('fr-FR') 
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        discount.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {discount.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openEditModal(discount)}
                        className="text-sky-600 hover:text-sky-900 mr-3"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteDiscount(discount.id)}
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
          {discounts.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Tag size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Aucune remise définie</p>
              <button
                onClick={() => openEditModal()}
                className="mt-4 text-sky-600 hover:text-sky-700"
              >
                Créer une remise
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Comment ça marche?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>- Créez une remise: ex "5% de remise si achat &gt; 1000€"</li>
            <li>- Le système calcule automatiquement vos achats mensuels chez ce fournisseur</li>
            <li>- Si le total dépasse le montant minimum, un avoir est généré</li>
            <li>- La prochaine commande peut déduire cet avoir</li>
          </ul>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedDiscount ? 'Modifier la remise' : 'Nouvelle remise'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom de la remise *</label>
                <input
                  type="text"
                  value={discountForm.name}
                  onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
                  placeholder="Ex: Remise volume 5%"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de remise</label>
                <select
                  value={discountForm.discountType}
                  onChange={(e) => setDiscountForm({ ...discountForm, discountType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                >
                  <option value="PERCENTAGE">Pourcentage (%)</option>
                  <option value="FIXED">Montant fixe (€)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valeur de la remise *</label>
                <div className="relative">
                  {discountForm.discountType === 'PERCENTAGE' ? (
                    <Percent size={18} className="absolute left-3 top-2.5 text-gray-400" />
                  ) : (
                    <DollarSign size={18} className="absolute left-3 top-2.5 text-gray-400" />
                  )}
                  <input
                    type="number"
                    step={discountForm.discountType === 'PERCENTAGE' ? '1' : '0.01'}
                    value={discountForm.discountValue}
                    onChange={(e) => setDiscountForm({ ...discountForm, discountValue: e.target.value })}
                    placeholder={discountForm.discountType === 'PERCENTAGE' ? '5' : '50'}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Montant minimum d'achat (€)</label>
                <input
                  type="number"
                  value={discountForm.minAmount}
                  onChange={(e) => setDiscountForm({ ...discountForm, minAmount: e.target.value })}
                  placeholder="1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Montant maximum de remise (€)</label>
                <input
                  type="number"
                  value={discountForm.maxDiscount}
                  onChange={(e) => setDiscountForm({ ...discountForm, maxDiscount: e.target.value })}
                  placeholder="Optionnel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin</label>
                <div className="relative">
                  <Calendar size={18} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="date"
                    value={discountForm.endDate}
                    onChange={(e) => setDiscountForm({ ...discountForm, endDate: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={selectedDiscount ? handleUpdateDiscount : handleCreateDiscount}
                  className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-2"
                >
                  <Save size={18} />
                  {selectedDiscount ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSupplierDiscounts;