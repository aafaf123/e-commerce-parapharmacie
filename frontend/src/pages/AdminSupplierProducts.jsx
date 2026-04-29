// frontend/src/pages/AdminSupplierProducts.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Truck, Plus, Edit, Trash2, Save, X, Search, Package,
  DollarSign, AlertCircle, Check, Loader2, ArrowLeft, Link as LinkIcon, Percent, Ticket
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import adminApi from '../api/adminAxios';

const AdminSupplierProducts = () => {
  const navigate = useNavigate();
  const { supplierId } = useParams();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

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
  const [credits, setCredits] = useState([]);
  const [creditsSummary, setCreditsSummary] = useState(null);

  const [linkForm, setLinkForm] = useState({ productId: '', price: '', reference: '' });
  const [creditForm, setCreditForm] = useState({ amount: '', reason: '', expiresAt: '' });

  useEffect(() => { checkAuth(); }, []);
  useEffect(() => {
    if (supplierId) { fetchSupplier(); fetchLinkedProducts(); fetchAllProducts(); fetchCredits(); }
  }, [supplierId]);

  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token) { navigate('/login'); return; }
    try {
      const user = JSON.parse(userStr);
      if (!(user?.role === 'ADMIN' || user?.role === 'EMPLOYE')) { navigate('/'); return; }
    } catch { navigate('/login'); return; }
    adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const fetchSupplier = async () => {
    try { const { data } = await adminApi.get(`/suppliers/${supplierId}`); setSupplier(data.supplier); }
    catch { console.error('Error fetching supplier'); }
  };

  const fetchLinkedProducts = async () => {
    try { const { data } = await adminApi.get(`/suppliers/${supplierId}/products`); setLinkedProducts(data); }
    catch { console.error('Error fetching linked products'); }
  };

  const fetchAllProducts = async () => {
    try { const { data } = await adminApi.get('/products?limit=1000'); setAllProducts(data.products || []); }
    catch { console.error('Error fetching products'); }
    finally { setLoading(false); }
  };

  const fetchCredits = async () => {
    try {
      const { data } = await adminApi.get(`/suppliers/${supplierId}/credits`);
      setCredits(data.credits || []); setCreditsSummary(data.summary);
    } catch { console.error('Error fetching credits'); }
  };

  const handleLinkProduct = async () => {
    if (!linkForm.productId || !linkForm.price) { setError(t('admin_supplier_products.error_select')); return; }
    try {
      await adminApi.post(`/suppliers/${supplierId}/link-product`, {
        productId: linkForm.productId, price: parseFloat(linkForm.price), reference: linkForm.reference
      });
      setSuccess(t('admin_supplier_products.linked'));
      setShowModal(false); resetForm(); fetchLinkedProducts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || t('admin_supplier_products.error_link')); }
  };

  const handleUnlinkProduct = async (productId) => {
    if (!confirm(t('admin_supplier_products.unlink_confirm'))) return;
    try {
      await adminApi.delete(`/suppliers/${supplierId}/unlink-product/${productId}`);
      setSuccess(t('admin_supplier_products.unlinked'));
      fetchLinkedProducts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || t('admin_supplier_products.error_unlink')); }
  };

  const handleCreateCredit = async () => {
    if (!creditForm.amount || parseFloat(creditForm.amount) <= 0) { setError(t('admin_supplier_products.error_amount')); return; }
    if (!creditForm.expiresAt) { setError(t('admin_supplier_products.error_expiry')); return; }
    try {
      await adminApi.post(`/suppliers/${supplierId}/credits`, {
        amount: creditForm.amount, reason: creditForm.reason, expiresAt: creditForm.expiresAt
      });
      setSuccess(t('admin_supplier_products.credit_created'));
      setShowCreditModal(false); setCreditForm({ amount: '', reason: '', expiresAt: '' }); fetchCredits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || t('admin_supplier_products.error_credit_create')); }
  };

  const handleDeleteCredit = async (creditId) => {
    if (!confirm(t('admin_supplier_products.delete_credit_confirm'))) return;
    try {
      await adminApi.delete(`/suppliers/${supplierId}/credits/${creditId}`);
      setSuccess(t('admin_supplier_products.credit_deleted'));
      fetchCredits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || t('admin_supplier_products.error_credit_delete')); }
  };

  const resetForm = () => { setLinkForm({ productId: '', price: '', reference: '' }); setSelectedProduct(null); };

  const formatDate = (date) => { if (!date) return '-'; return new Date(date).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR'); };
  const isCreditExpired = (expiresAt) => new Date(expiresAt) < new Date();

  const openLinkModal = (product = null) => {
    if (product) {
      setSelectedProduct(product);
      setLinkForm({ productId: product.productId, price: product.price?.toString() || '', reference: product.reference || '' });
    } else { resetForm(); }
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
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-sky-700" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin/suppliers')} className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group">
              <ArrowLeft size={20} className={`${isAr ? 'rotate-180' : ''} group-hover:-translate-x-1 transition-transform`} />
            </button>
            <div className="h-8 w-px bg-gray-200"></div>
            <Truck size={28} className="text-sky-700" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{supplier?.name}</h1>
              <p className="text-sm text-gray-600">{t('admin_supplier_products.subtitle')}</p>
            </div>
            <div className={`${isAr ? 'mr-auto' : 'ml-auto'} flex items-center gap-2`}>
              <button onClick={() => setShowCreditModal(true)} className="flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors text-sm">
                <Ticket size={16} />{t('admin_supplier_products.create_credit')}
              </button>
              <button onClick={() => navigate(`/admin/suppliers/${supplierId}/discounts`)} className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm">
                <Percent size={16} />{t('admin_supplier_discounts.title')}
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
            <button onClick={() => setError('')} className={`${isAr ? 'mr-auto' : 'ml-auto'} text-red-600`}><X size={18} /></button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <Check size={20} className="inline mr-2 text-green-600" />
            <span className="text-green-800">{success}</span>
          </div>
        )}

        {/* Credits Section */}
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-green-800 font-semibold">
              <Ticket size={20} />
              {t('admin_supplier_products.credits_title')}
              {creditsSummary && (
                <span className="text-sm font-normal text-green-600 mx-2">
                  {t('admin_supplier_products.credits_summary', {
                    available: creditsSummary.available,
                    total: creditsSummary.total,
                    amount: creditsSummary.totalAvailable?.toFixed(2)
                  })}
                </span>
              )}
            </div>
            <button onClick={() => setShowCreditModal(true)} className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors">
              <Plus size={14} />{t('admin_supplier_products.create_credit')}
            </button>
          </div>
          {credits.length === 0 ? (
            <p className="text-sm text-green-700">{t('admin_supplier_products.no_credits')}</p>
          ) : (
            <div className="space-y-2">
              {credits.map(credit => (
                <div key={credit.id} className={`flex items-center justify-between p-3 rounded border ${credit.used ? 'bg-gray-100 border-gray-300' : isCreditExpired(credit.expiresAt) ? 'bg-red-50 border-red-200' : 'bg-white border-green-200'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold text-lg ${credit.used ? 'text-gray-400' : isCreditExpired(credit.expiresAt) ? 'text-red-600 line-through' : 'text-green-700'}`}>
                      {credit.amount?.toFixed(2)} DH
                    </span>
                    <div className="text-sm">
                      {credit.reason && <div className="text-gray-600">{credit.reason}</div>}
                      <div className="text-gray-500">
                        {t('admin_supplier_products.expires')} {formatDate(credit.expiresAt)}
                        {credit.used && <span className="text-red-600 mx-2">- {t('admin_supplier_products.used')}</span>}
                        {!credit.used && isCreditExpired(credit.expiresAt) && <span className="text-red-600 mx-2">- {t('admin_supplier_products.expired')}</span>}
                      </div>
                    </div>
                  </div>
                  {!credit.used && !isCreditExpired(credit.expiresAt) && (
                    <button onClick={() => handleDeleteCredit(credit.id)} className="text-red-600 hover:text-red-800 p-1" title={t('common.delete')}>
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
            <Search size={18} className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400`} />
            <input type="text" placeholder={t('admin_supplier_products.search_placeholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full ${isAr ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500`} />
          </div>
          <button onClick={() => openLinkModal()} className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors">
            <LinkIcon size={18} />{t('admin_supplier_products.link_product')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    t('admin_supplier_products.col_product'),
                    t('admin_supplier_products.col_category'),
                    t('admin_supplier_products.col_purchase_price'),
                    t('admin_supplier_products.col_sale_price'),
                    t('admin_supplier_products.col_margin'),
                    t('admin_supplier_products.col_reference'),
                    t('admin_supplier_products.col_actions'),
                  ].map(h => (
                    <th key={h} className={`px-6 py-3 text-${isAr ? 'right' : 'left'} text-xs font-medium text-gray-500 uppercase tracking-wider`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {linkedProducts
                  .filter(p => !searchTerm || p.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{item.product?.name}</div>
                        <div className="text-xs text-gray-500">{t('admin_supplier_products.stock_label')} {item.product?.stock}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.product?.category?.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-green-600 font-medium ltr">{item.price?.toFixed(2)} DH</div></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><span className="ltr">{item.product?.priceTTC?.toFixed(2)} DH</span></td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-medium ${calculateMargin(item.price, item.product?.priceTTC) >= 20 ? 'text-green-600' : 'text-orange-600'}`}>
                          {calculateMargin(item.price, item.product?.priceTTC)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.reference || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button onClick={() => openLinkModal(item)} className="text-sky-600 hover:text-sky-900 mr-3"><Edit size={18} /></button>
                        <button onClick={() => handleUnlinkProduct(item.productId)} className="text-red-600 hover:text-red-900"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {linkedProducts.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Package size={48} className="mx-auto mb-4 text-gray-300" />
              <p>{t('admin_supplier_products.no_products')}</p>
              <button onClick={() => openLinkModal()} className="mt-4 text-sky-600 hover:text-sky-700">
                {t('admin_supplier_products.link_first')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Link Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedProduct ? t('admin_supplier_products.modal_edit_title') : t('admin_supplier_products.modal_link_title')}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              {!selectedProduct && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_supplier_products.product_label')}</label>
                  <select value={linkForm.productId} onChange={(e) => setLinkForm({ ...linkForm, productId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700">
                    <option value="">{t('admin_supplier_products.select_product')}</option>
                    {getUnlinkedProducts().map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {p.priceTTC?.toFixed(2)} DH</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_supplier_products.purchase_price_label')}</label>
                <div className="relative">
                  <DollarSign size={18} className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 text-gray-400`} />
                  <input type="number" step="0.01" value={linkForm.price} onChange={(e) => setLinkForm({ ...linkForm, price: e.target.value })} placeholder="0.00" className={`w-full ${isAr ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700`} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_supplier_products.reference_label')}</label>
                <input type="text" value={linkForm.reference} onChange={(e) => setLinkForm({ ...linkForm, reference: e.target.value })} placeholder={t('admin_supplier_products.reference_placeholder')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700" />
              </div>
              {linkForm.productId && linkForm.price && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                  <div>{t('admin_supplier_products.purchase_price_preview')} <span className="font-medium" ltr>{parseFloat(linkForm.price).toFixed(2)} DH</span></div>
                  {allProducts.find(p => p.id === linkForm.productId) && (
                    <>
                      <div>{t('admin_supplier_products.sale_price_preview')} <span className="font-medium" ltr>{allProducts.find(p => p.id === linkForm.productId)?.priceTTC?.toFixed(2)} DH</span></div>
                      <div>{t('admin_supplier_products.margin_preview')} <span className="font-medium">{calculateMargin(parseFloat(linkForm.price), allProducts.find(p => p.id === linkForm.productId)?.priceTTC)}%</span></div>
                    </>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">{t('admin_supplier_products.cancel')}</button>
                <button onClick={handleLinkProduct} className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-2">
                  <Save size={18} />
                  {selectedProduct ? t('admin_supplier_products.update_btn') : t('admin_supplier_products.link_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-green-200 bg-green-50">
              <h2 className="text-xl font-bold text-green-800">{t('admin_supplier_products.modal_credit_title')}</h2>
              <button onClick={() => setShowCreditModal(false)} className="text-green-600 hover:text-green-800"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_supplier_products.amount_label')}</label>
                <div className="relative">
                  <DollarSign size={18} className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 text-gray-400`} />
                  <input type="number" step="0.01" min="0.01" value={creditForm.amount} onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })} placeholder="0.00" className={`w-full ${isAr ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-600`} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_supplier_products.reason_label')}</label>
                <textarea value={creditForm.reason} onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })} placeholder={t('admin_supplier_products.reason_placeholder')} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-600 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_supplier_products.expiry_label')}</label>
                <input type="date" value={creditForm.expiresAt} onChange={(e) => setCreditForm({ ...creditForm, expiresAt: e.target.value })} min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-600" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => { setShowCreditModal(false); setCreditForm({ amount: '', reason: '', expiresAt: '' }); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">{t('admin_supplier_products.cancel')}</button>
                <button onClick={handleCreateCredit} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2">
                  <Ticket size={18} />{t('admin_supplier_products.create_credit_btn')}
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

