// frontend/src/pages/AdminPurchaseOrders.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Eye, Trash2, Save, X, Search,
  Package, Mail, Loader2, ArrowLeft,
  Check, Truck, AlertCircle, Calendar
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import adminApi from '../api/adminAxios';

const AdminPurchaseOrders = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [orderForm, setOrderForm] = useState({
    supplierId: '', items: [], notes: '', expectedDate: ''
  });
  const [receiveForm, setReceiveForm] = useState({});

  const testEmailSupplier = async (email, name) => {
    if (!email) { alert(t('admin_purchase_orders.test_email_not_configured')); return; }
    if (!confirm(t('admin_purchase_orders.test_email_confirm', { email }))) return;
    try {
      const response = await adminApi.post('/test-email', { email, name });
      alert(response.data.message || 'Email envoyé!');
    } catch (err) {
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    }
  };

  useEffect(() => {
    checkAuth();
    fetchSuppliers();
    fetchProducts();
    fetchOrders();
  }, [currentPage, searchTerm, statusFilter]);

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

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit: 20 };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      const { data } = await adminApi.get('/purchase-orders', { params });
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch {
      setError(t('admin_purchase_orders.error_load'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data } = await adminApi.get('/suppliers?active=true&limit=100');
      setSuppliers(data.suppliers);
    } catch { console.error('Error fetching suppliers'); }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await adminApi.get('/products?limit=1000');
      setProducts(data.products || []);
    } catch { console.error('Error fetching products'); }
  };

  const handleCreateOrder = async () => {
    if (!orderForm.supplierId || orderForm.items.length === 0) {
      setError(t('admin_purchase_orders.error_fields')); return;
    }
    try {
      await adminApi.post('/purchase-orders', orderForm);
      setSuccess(t('admin_purchase_orders.created'));
      setShowModal(false); resetForm(); fetchOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || `Erreur ${err.response?.status || ''}`;
      alert('ERREUR: ' + msg);
      setError(msg);
    }
  };

  const handleSendOrder = async (order) => {
    if (!confirm(t('admin_purchase_orders.send_confirm', { num: order.orderNumber }))) return;
    try {
      await adminApi.post(`/purchase-orders/${order.id}/send`);
      setSuccess(t('admin_purchase_orders.sent'));
      fetchOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || t('admin_purchase_orders.error_send'));
    }
  };

  const handleReceiveOrder = async () => {
    if (!selectedOrder) return;
    try {
      const items = selectedOrder.items.map(item => ({
        itemId: item.id,
        receivedQty: receiveForm[item.id]?.receivedQty || item.quantity,
        expiryDate: receiveForm[item.id]?.expiryDate || null
      }));
      await adminApi.put(`/purchase-orders/${selectedOrder.id}/receive`, { items });
      setSuccess(t('admin_purchase_orders.received'));
      setShowReceiveModal(false); setSelectedOrder(null); setReceiveForm({});
      fetchOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || t('admin_purchase_orders.error_receive'));
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!confirm(t('admin_purchase_orders.delete_confirm', { num: order.orderNumber }))) return;
    try {
      await adminApi.delete(`/purchase-orders/${order.id}`);
      setSuccess(t('admin_purchase_orders.deleted'));
      fetchOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || t('admin_purchase_orders.error_delete'));
    }
  };

  const handlePrintOrder = (order) => {
    const locale = isAr ? 'ar-MA' : 'fr-FR';
    const printContent = `<!DOCTYPE html><html><head><title>${order.orderNumber}</title>
<style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.total{margin-top:20px;text-align:right;font-size:18px;font-weight:bold}</style>
</head><body>
<h1>${order.orderNumber}</h1>
<p><strong>${t('admin_purchase_orders.supplier_info')}</strong> ${order.supplier?.name || ''}</p>
<p><strong>${t('admin_purchase_orders.date_info')}</strong> ${new Date(order.orderDate).toLocaleDateString(locale)}</p>
<table><thead><tr><th>${t('admin_purchase_orders.col_supplier')}</th><th>${t('common.quantity_short')}</th><th>${t('admin_orders.unit_price')}</th><th>${t('common.total')}</th></tr></thead>
<tbody>${(order.items || []).map(item => `<tr><td>${item.product?.name || ''}</td><td>${item.quantity}</td><td>${item.unitPrice?.toFixed(2)} DH</td><td>${(item.quantity * item.unitPrice)?.toFixed(2)} DH</td></tr>`).join('')}</tbody></table>
<div class="total">${t('admin_purchase_orders.total_label')} ${order.totalAmount?.toFixed(2)} DH</div>
${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
</body></html>`;
    const w = window.open('', '_blank');
    w.document.write(printContent);
    w.document.close();
    w.print();
  };

  const resetForm = () => {
    setOrderForm({ supplierId: '', items: [], notes: '', expectedDate: '' });
  };

  const openReceiveModal = (order) => {
    setSelectedOrder(order);
    const initialReceive = {};
    order.items.forEach(item => {
      initialReceive[item.id] = { receivedQty: item.quantity, expiryDate: '' };
    });
    setReceiveForm(initialReceive);
    setShowReceiveModal(true);
  };

  const getStatusBadge = (status) => {
    const map = {
      BROUILLON:          { bg: 'bg-yellow-100', text: 'text-yellow-800', key: 'status_draft' },
      VALIDATION_ATTENTE: { bg: 'bg-orange-100', text: 'text-orange-800', key: 'status_awaiting' },
      'VALIDÉ':           { bg: 'bg-cyan-100',   text: 'text-cyan-800',   key: 'status_validated' },
      'ENVOYÉ':           { bg: 'bg-blue-100',   text: 'text-blue-800',   key: 'status_sent' },
      'REÇU_PARTIEL':     { bg: 'bg-orange-100', text: 'text-orange-800', key: 'status_partial_received' },
      'REÇU_TOTAL':       { bg: 'bg-green-100',  text: 'text-green-800',  key: 'status_total_received' },
      'ANNULÉ':           { bg: 'bg-red-100',    text: 'text-red-800',    key: 'status_cancelled' },
      PENDING:            { bg: 'bg-yellow-100', text: 'text-yellow-800', key: 'status_pending' },
      SENT:               { bg: 'bg-blue-100',   text: 'text-blue-800',   key: 'status_sent' },
      RECEIVED:           { bg: 'bg-green-100',  text: 'text-green-800',  key: 'status_received' },
      CANCELLED:          { bg: 'bg-red-100',    text: 'text-red-800',    key: 'status_cancelled' },
    };
    const cfg = map[status] || { bg: 'bg-gray-100', text: 'text-gray-800', key: null };
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${cfg.bg} ${cfg.text}`}>
        {cfg.key ? t(`admin_purchase_orders.${cfg.key}`) : status}
      </span>
    );
  };

  const addItemToOrder = (product, supplierId) => {
    const existingItem = orderForm.items.find(i => i.productId === product.id);
    if (existingItem) {
      setOrderForm({ ...orderForm, items: orderForm.items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i) });
    } else {
      const supplierPrice = product.suppliers?.find(s => s.supplierId === supplierId)?.price || product.priceHT || 0;
      setOrderForm({ ...orderForm, items: [...orderForm.items, { productId: product.id, productName: product.name, quantity: 1, unitPrice: supplierPrice }] });
    }
  };

  const updateItemQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      setOrderForm({ ...orderForm, items: orderForm.items.filter(i => i.productId !== productId) });
    } else {
      setOrderForm({ ...orderForm, items: orderForm.items.map(i => i.productId === productId ? { ...i, quantity } : i) });
    }
  };

  const getSupplierProducts = (supplierId) => {
    if (!supplierId) return [];
    return products.filter(p => p.suppliers?.some(s => s.supplierId === supplierId));
  };

  const calculateTotal = () => orderForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  if (loading && orders.length === 0) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-sky-700" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
              title={t('admin_purchase_orders.back_dashboard')}
            >
              <ArrowLeft size={20} className={`${isAr ? 'rotate-180' : ''} group-hover:-translate-x-1 transition-transform`} />
              <span className="text-sm font-semibold hidden lg:inline">{t('admin_purchase_orders.back_dashboard')}</span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <FileText size={28} className="text-sky-700" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('admin_purchase_orders.title')}</h1>
              <p className="text-sm text-gray-600">{t('admin_purchase_orders.subtitle')}</p>
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={18} className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400`} />
              <input
                type="text"
                placeholder={t('admin_purchase_orders.search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${isAr ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500`}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">{t('admin_purchase_orders.all_statuses')}</option>
              <option value="PENDING">{t('admin_purchase_orders.status_pending')}</option>
              <option value="SENT">{t('admin_purchase_orders.status_sent')}</option>
              <option value="PARTIALLY_RECEIVED">{t('admin_purchase_orders.status_partial')}</option>
              <option value="RECEIVED">{t('admin_purchase_orders.status_received')}</option>
            </select>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />{t('admin_purchase_orders.new_order')}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    t('admin_purchase_orders.col_order_num'),
                    t('admin_purchase_orders.col_supplier'),
                    t('admin_purchase_orders.col_date'),
                    t('admin_purchase_orders.col_total'),
                    t('admin_purchase_orders.col_status'),
                    t('admin_purchase_orders.col_actions'),
                  ].map(h => (
                    <th key={h} className={`px-6 py-3 text-${isAr ? 'right' : 'left'} text-xs font-medium text-gray-500 uppercase tracking-wider`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{order.orderNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span>{order.supplier?.name}</span>
                        {order.supplier?.email && <span className="text-xs text-gray-400">{order.supplier.email}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.orderDate).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><span className="ltr">{order.totalAmount?.toFixed(2)} DH</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(order.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {(order.status === 'BROUILLON' || order.status === 'VALIDATION_ATTENTE') && (
                          <>
                            <button onClick={() => handleSendOrder(order)} className="text-blue-600 hover:text-blue-900" title={t('admin_purchase_orders.send_title')}><Truck size={18} /></button>
                            <button onClick={() => handleDeleteOrder(order)} className="text-red-600 hover:text-red-900" title={t('admin_purchase_orders.delete_title')}><Trash2 size={18} /></button>
                          </>
                        )}
                        {(order.status === 'ENVOYÉ' || order.status === 'REÇU_PARTIEL') && (
                          <button onClick={() => openReceiveModal(order)} className="text-green-600 hover:text-green-900" title={t('admin_purchase_orders.receive_title')}><Package size={18} /></button>
                        )}
                        <button onClick={() => openReceiveModal(order)} className="text-gray-600 hover:text-gray-900" title={t('admin_purchase_orders.details_title')}><Eye size={18} /></button>
                        {order.supplier?.email && (
                          <button onClick={() => testEmailSupplier(order.supplier.email, order.supplier.name)} className={`text-purple-600 hover:text-purple-900 ${isAr ? 'mr-2' : 'ml-2'}`} title={t('admin_purchase_orders.test_email_title')}><Mail size={18} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-6 py-3 rounded-lg shadow-sm mt-6">
            <div className="text-sm text-gray-700">
              {t('admin_purchase_orders.pagination_info', {
                from: ((pagination.page - 1) * pagination.limit) + 1,
                to: Math.min(pagination.page * pagination.limit, pagination.total),
                total: pagination.total
              })}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                <ArrowLeft size={16} className={isAr ? 'rotate-180' : ''} />
              </button>
              <span className="text-sm text-gray-700">
                {t('admin_purchase_orders.page_of', { current: pagination.page, total: pagination.totalPages })}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                <ArrowLeft size={16} className={isAr ? '' : 'rotate-180'} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">{t('admin_purchase_orders.modal_new_title')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_purchase_orders.supplier_label')}</label>
                <select
                  value={orderForm.supplierId}
                  onChange={(e) => setOrderForm({ ...orderForm, supplierId: e.target.value, items: [] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                >
                  <option value="">{t('admin_purchase_orders.select_supplier')}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {orderForm.supplierId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_purchase_orders.add_products_label')}</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {getSupplierProducts(orderForm.supplierId).slice(0, 10).map(p => (
                      <button
                        key={p.id}
                        onClick={() => addItemToOrder(p, orderForm.supplierId)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm transition-colors"
                      >
                        + {p.name?.substring(0, 20)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {orderForm.items.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_purchase_orders.ordered_products_label')}</label>
                  <div className="space-y-2">
                    {orderForm.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <span className="font-medium">{item.productName}</span>
                          <span className="text-sm text-gray-500 mx-2">({item.unitPrice?.toFixed(2)} DH)</span>
                        </div>
                        <input
                          type="number" min="1" value={item.quantity}
                          onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value) || 1)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        />
                        <button onClick={() => updateItemQuantity(item.productId, 0)} className="text-red-600 hover:text-red-900"><X size={18} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-sky-50 rounded-lg">
                    <span className="font-bold">{t('admin_purchase_orders.total_label')} </span>
                    <span className="font-bold text-sky-700" ltr>{calculateTotal().toFixed(2)} DH</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_purchase_orders.expected_date_label')}</label>
                <input
                  type="date" value={orderForm.expectedDate}
                  onChange={(e) => setOrderForm({ ...orderForm, expectedDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_purchase_orders.notes_label')}</label>
                <textarea
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  rows="3" placeholder={t('admin_purchase_orders.notes_placeholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  {t('admin_purchase_orders.cancel')}
                </button>
                <button onClick={handleCreateOrder} className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-2">
                  <Save size={18} />{t('admin_purchase_orders.create_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReceiveModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{t('admin_purchase_orders.receive_modal_title')}</h2>
                <p className="text-sm text-gray-500">{selectedOrder.orderNumber}</p>
              </div>
              <button onClick={() => setShowReceiveModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><span className="font-medium">{t('admin_purchase_orders.supplier_info')}</span> {selectedOrder.supplier?.name}</p>
                <p><span className="font-medium">{t('admin_purchase_orders.date_info')}</span> {new Date(selectedOrder.orderDate).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</p>
                <p><span className="font-medium">{t('admin_purchase_orders.total_info')}</span> {selectedOrder.totalAmount?.toFixed(2)} DH</p>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin_purchase_orders.received_products_label')}</label>
              <div className="space-y-3">
                {selectedOrder.items.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-3 bg-white border rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium">{item.product?.name}</span>
                      <div className="text-sm text-gray-500">
                        {t('admin_purchase_orders.ordered_qty')} {item.quantity} × {item.unitPrice?.toFixed(2)} DH = {(item.quantity * item.unitPrice)?.toFixed(2)} DH
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="text-xs text-gray-500">{t('admin_purchase_orders.received_qty_label')}</label>
                        <input
                          type="number" min="0" max={item.quantity}
                          value={receiveForm[item.id]?.receivedQty || item.quantity}
                          onChange={(e) => setReceiveForm({ ...receiveForm, [item.id]: { ...receiveForm[item.id], receivedQty: parseInt(e.target.value) || 0 } })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">{t('admin_purchase_orders.expiry_label')}</label>
                        <input
                          type="date"
                          value={receiveForm[item.id]?.expiryDate || ''}
                          onChange={(e) => setReceiveForm({ ...receiveForm, [item.id]: { ...receiveForm[item.id], expiryDate: e.target.value } })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowReceiveModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  {t('admin_purchase_orders.cancel')}
                </button>
                <button onClick={handleReceiveOrder} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2">
                  <Check size={18} />{t('admin_purchase_orders.confirm_receive')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPurchaseOrders;

