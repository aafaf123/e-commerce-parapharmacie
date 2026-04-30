// frontend/src/pages/AdminPurchaseOrders.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Eye, Edit, Trash2, Save, X, Search,
  Package, DollarSign, Phone, Mail, MapPin, Globe, Loader2, ArrowLeft,
  Check, Clock, Truck, AlertCircle, ShoppingCart, Calendar, Printer, Send,
  Bell, ChevronDown, ChevronUp, Download, MessageSquare
} from 'lucide-react';
import adminApi from '../api/adminAxios';

const AdminPurchaseOrders = () => {
  const navigate = useNavigate();
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
    supplierId: '',
    items: [],
    notes: '',
    expectedDate: ''
  });

  const [receiveForm, setReceiveForm] = useState({});
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [exchangeHistory, setExchangeHistory] = useState({});

  useEffect(() => {
    checkAuth();
    fetchSuppliers();
    fetchProducts();
    fetchOrders();
  }, [currentPage, searchTerm, statusFilter]);

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

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit: 20 };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      
      const { data } = await adminApi.get('/purchase-orders', { params });
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Erreur lors du chargement des commandes');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data } = await adminApi.get('/suppliers?active=true&limit=100');
      setSuppliers(data.suppliers);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await adminApi.get('/products?limit=1000');
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleCreateOrder = async () => {
    if (!orderForm.supplierId || orderForm.items.length === 0) {
      setError('Sélectionnez un fournisseur et au moins un produit');
      return;
    }

    try {
      await adminApi.post('/purchase-orders', orderForm);
      setSuccess('Bon de commande créé avec succès');
      setShowModal(false);
      resetForm();
      fetchOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || `Erreur ${err.response?.status || 'inconnue'}`;
      alert('ERREUR: ' + msg);
      setError(msg);
    }
  };

  const handleSendOrder = async (order) => {
    if (!confirm(`Envoyer le bon de commande ${order.orderNumber} au fournisseur?`)) return;

    try {
      await adminApi.post(`/purchase-orders/${order.id}/send`);
      setSuccess('Bon de commande envoyé');
      fetchOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de l\'envoi');
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
      setSuccess('Commande réceptionnée avec succès');
      setShowReceiveModal(false);
      setSelectedOrder(null);
      setReceiveForm({});
      fetchOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la réception');
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le bon de commande "${order.orderNumber}"?`)) return;

    try {
      await adminApi.delete(`/purchase-orders/${order.id}`);
      setSuccess('Bon de commande supprimé');
      fetchOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handlePrintOrder = (order) => {
    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Bon de commande ${order.orderNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; font-size: 24px; }
    .header { margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .info { margin-bottom: 20px; }
    .info p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
    .total { margin-top: 20px; text-align: right; font-size: 18px; font-weight: bold; }
    .footer { margin-top: 40px; font-size: 12px; color: #666; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Bon de Commande N° ${order.orderNumber}</h1>
  </div>
  <div class="info">
    <p><strong>Fournisseur:</strong> ${order.supplier?.name || ''}</p>
    <p><strong>Adresse:</strong> ${order.supplier?.address || ''}</p>
    <p><strong>Téléphone:</strong> ${order.supplier?.phone || ''}</p>
    <p><strong>Date:</strong> ${new Date(order.orderDate).toLocaleDateString('fr-FR')}</p>
    ${order.expectedDate ? `<p><strong>Date prévue:</strong> ${new Date(order.expectedDate).toLocaleDateString('fr-FR')}</p>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>Produit</th>
        <th>Quantité</th>
        <th>Prix unitaire</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${(order.items || []).map(item => `
        <tr>
          <td>${item.product?.name || ''}</td>
          <td>${item.quantity}</td>
          <td>${item.unitPrice?.toFixed(2)} DH</td>
          <td>${(item.quantity * item.unitPrice)?.toFixed(2)} DH</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="total">
    Total: ${order.totalAmount?.toFixed(2)} DH
  </div>
  ${order.notes ? `<div class="notes"><strong>Notes:</strong> ${order.notes}</div>` : ''}
  <div class="footer">
    <p>Document généré par ParaClick - ${new Date().toLocaleDateString('fr-FR')}</p>
  </div>
</body>
</html>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const resetForm = () => {
    setOrderForm({
      supplierId: '',
      items: [],
      notes: '',
      expectedDate: ''
    });
  };

  const openReceiveModal = (order) => {
    setSelectedOrder(order);
    const initialReceive = {};
    order.items.forEach(item => {
      initialReceive[item.id] = {
        receivedQty: item.quantity,
        expiryDate: ''
      };
    });
    setReceiveForm(initialReceive);
    setShowReceiveModal(true);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      BROUILLON: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Brouillon' },
      ENVOYÉ: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Envoyé' },
      VALIDÉ: { bg: 'bg-green-100', text: 'text-green-800', label: 'Validé' }
    };
    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getAlertIndicators = (order) => {
    const indicators = [];
    const now = new Date();
    
    // Livraison prévue dépassée
    if (order.expectedDate && new Date(order.expectedDate) < now && order.status !== 'VALIDÉ') {
      indicators.push({ icon: AlertCircle, color: 'text-orange-500', title: 'Livraison prévue dépassée' });
    }
    
    // Facture non reçue (commande envoyée depuis plus de 7 jours)
    if (order.status === 'ENVOYÉ' && order.sentDate) {
      const daysSinceSent = (now - new Date(order.sentDate)) / (1000 * 60 * 60 * 24);
      if (daysSinceSent > 7) {
        indicators.push({ icon: Bell, color: 'text-red-500', title: 'Facture non reçue' });
      }
    }
    
    // Paiement en retard (commande validée depuis plus de 30 jours)
    if (order.status === 'VALIDÉ' && order.receivedDate) {
      const daysSinceReceived = (now - new Date(order.receivedDate)) / (1000 * 60 * 60 * 24);
      if (daysSinceReceived > 30) {
        indicators.push({ icon: Clock, color: 'text-red-600', title: 'Paiement en retard' });
      }
    }
    
    return indicators;
  };

  const toggleRowExpansion = (orderId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedRows(newExpanded);
  };

  const exportQuarterlyPDF = () => {
    const quarter = prompt('Entrez le trimestre (ex: 2024-Q1, 2024-Q2, etc.):');
    if (!quarter) return;
    
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.orderDate);
      const year = orderDate.getFullYear();
      const month = orderDate.getMonth() + 1;
      const q = Math.ceil(month / 3);
      return `${year}-Q${q}` === quarter;
    });
    
    if (filteredOrders.length === 0) {
      alert('Aucune commande trouvée pour ce trimestre');
      return;
    }
    
    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Rapport Commandes ${quarter}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
    th { background-color: #f5f5f5; }
    .total { margin-top: 20px; text-align: right; font-size: 16px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Rapport Commandes Fournisseurs - ${quarter}</h1>
  <table>
    <thead>
      <tr>
        <th>N° Commande</th>
        <th>Fournisseur</th>
        <th>Date</th>
        <th>Date Prévue</th>
        <th>Date Réelle</th>
        <th>Total</th>
        <th>Statut</th>
      </tr>
    </thead>
    <tbody>
      ${filteredOrders.map(order => `
        <tr>
          <td>${order.orderNumber}</td>
          <td>${order.supplier?.name || ''}</td>
          <td>${new Date(order.orderDate).toLocaleDateString('fr-FR')}</td>
          <td>${order.expectedDate ? new Date(order.expectedDate).toLocaleDateString('fr-FR') : '-'}</td>
          <td>${order.receivedDate ? new Date(order.receivedDate).toLocaleDateString('fr-FR') : '-'}</td>
          <td>${order.totalAmount?.toFixed(2)} DH</td>
          <td>${order.status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="total">
    Total: ${filteredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0).toFixed(2)} DH
  </div>
</body>
</html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const addItemToOrder = (product, supplierId) => {
    const supplierProducts = products.filter(p => 
      p.suppliers?.some(s => s.supplierId === supplierId)
    );
    
    const existingItem = orderForm.items.find(i => i.productId === product.id);
    if (existingItem) {
      setOrderForm({
        ...orderForm,
        items: orderForm.items.map(i => 
          i.productId === product.id 
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      });
    } else {
      const supplierPrice = product.suppliers?.find(s => s.supplierId === supplierId)?.price || product.priceHT || 0;
      setOrderForm({
        ...orderForm,
        items: [...orderForm.items, {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: supplierPrice
        }]
      });
    }
  };

  const updateItemQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      setOrderForm({
        ...orderForm,
        items: orderForm.items.filter(i => i.productId !== productId)
      });
    } else {
      setOrderForm({
        ...orderForm,
        items: orderForm.items.map(i => 
          i.productId === productId ? { ...i, quantity } : i
        )
      });
    }
  };

  const getSupplierProducts = (supplierId) => {
    if (!supplierId) return [];
    return products.filter(p => 
      p.suppliers?.some(s => s.supplierId === supplierId)
    );
  };

  const calculateTotal = () => {
    return orderForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  if (loading && orders.length === 0) {
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
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
              title="Retour au Tableau de Bord"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-semibold hidden lg:inline">Dashboard</span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <FileText size={28} className="text-sky-700" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bons de Commande</h1>
              <p className="text-sm text-gray-600">Gestion des achats fournisseurs</p>
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Tous les statuts</option>
              <option value="BROUILLON">Brouillon</option>
              <option value="ENVOYÉ">Envoyé</option>
              <option value="VALIDÉ">Validé</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportQuarterlyPDF}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Download size={18} />
              Export PDF
            </button>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors"
            >
              <Plus size={18} />
              Nouveau bon
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Commande</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fournisseur</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Prévue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Réelle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => {
                  const indicators = getAlertIndicators(order);
                  const isExpanded = expandedRows.has(order.id);
                  
                  return (
                    <React.Fragment key={order.id}>
                      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRowExpansion(order.id)}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {order.orderNumber}
                            {indicators.map((indicator, idx) => {
                              const IconComponent = indicator.icon;
                              return (
                                <IconComponent 
                                  key={idx} 
                                  size={16} 
                                  className={indicator.color} 
                                  title={indicator.title}
                                />
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex flex-col">
                            <span>{order.supplier?.name}</span>
                            {order.supplier?.email && (
                              <span className="text-xs text-gray-400">{order.supplier.email}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(order.orderDate).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.expectedDate ? new Date(order.expectedDate).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.receivedDate ? new Date(order.receivedDate).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {order.totalAmount?.toFixed(2)} DH
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {order.status === 'BROUILLON' && (
                              <>
                                <button
                                  onClick={() => handleSendOrder(order)}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Envoyer au fournisseur"
                                >
                                  <Truck size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteOrder(order)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Supprimer"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}
                            {order.status === 'ENVOYÉ' && (
                              <button
                                onClick={() => openReceiveModal(order)}
                                className="text-green-600 hover:text-green-900"
                                title="Confirmer réception"
                              >
                                <Package size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => openReceiveModal(order)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Voir les détails"
                            >
                              <Eye size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="8" className="px-6 py-4 bg-gray-50">
                            <div className="space-y-4">
                              {/* Détails des produits */}
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Produits commandés</h4>
                                <div className="bg-white rounded border">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left">Produit</th>
                                        <th className="px-3 py-2 text-left">Qté</th>
                                        <th className="px-3 py-2 text-left">Prix unitaire</th>
                                        <th className="px-3 py-2 text-left">Reçu</th>
                                        <th className="px-3 py-2 text-left">Manquant</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(order.items || []).map((item, idx) => (
                                        <tr key={idx} className="border-t">
                                          <td className="px-3 py-2">{item.product?.name}</td>
                                          <td className="px-3 py-2">{item.quantity}</td>
                                          <td className="px-3 py-2">{item.unitPrice?.toFixed(2)} DH</td>
                                          <td className="px-3 py-2 text-green-600">{item.receivedQty || 0}</td>
                                          <td className="px-3 py-2 text-red-600">{item.quantity - (item.receivedQty || 0)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              
                              {/* Historique des échanges */}
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                                  <MessageSquare size={16} />
                                  Historique des échanges
                                </h4>
                                <div className="bg-white rounded border p-3 space-y-2 max-h-32 overflow-y-auto">
                                  <div className="text-xs text-gray-500">
                                    {new Date(order.createdAt).toLocaleString('fr-FR')} - Commande créée
                                  </div>
                                  {order.sentDate && (
                                    <div className="text-xs text-gray-500">
                                      {new Date(order.sentDate).toLocaleString('fr-FR')} - Commande envoyée au fournisseur
                                    </div>
                                  )}
                                  {order.receivedDate && (
                                    <div className="text-xs text-gray-500">
                                      {new Date(order.receivedDate).toLocaleString('fr-FR')} - Commande réceptionnée
                                    </div>
                                  )}
                                  {order.notes && (
                                    <div className="text-xs text-gray-600 bg-yellow-50 p-2 rounded">
                                      <strong>Notes:</strong> {order.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

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
                <ArrowLeft size={16} />
              </button>
              <span className="text-sm text-gray-700">
                Page {pagination.page} sur {pagination.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                <FileText size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal创建一个新订单 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
             <>
             <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">Nouveau bon de commande</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fournisseur *</label>
                <select
                  value={orderForm.supplierId}
                  onChange={(e) => setOrderForm({ ...orderForm, supplierId: e.target.value, items: [] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                >
                  <option value="">Sélectionner un fournisseur</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {orderForm.supplierId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ajouter des produits</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Produits commandés</label>
                  <div className="space-y-2">
                    {orderForm.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <span className="font-medium">{item.productName}</span>
                          <span className="text-sm text-gray-500 ml-2">
                             ({item.unitPrice?.toFixed(2)} DH)
                          </span>
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value) || 1)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        />
                        <button
                          onClick={() => updateItemQuantity(item.productId, 0)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-sky-50 rounded-lg">
                    <span className="font-bold">Total: </span>
                     <span className="font-bold text-sky-700">{calculateTotal().toFixed(2)} DH</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de livraison prévue</label>
                <input
                  type="date"
                  value={orderForm.expectedDate}
                  onChange={(e) => setOrderForm({ ...orderForm, expectedDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  rows="3"
                  placeholder="Notes supplémentaires..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateOrder}
                  className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-2"
                >
                  <Save size={18} />
                  Créer le bon de commande
                 </button>
               </div>
             </div>
             </> 
           </div>
        </div>
      )}

      {/* 收货Modal */}
      {showReceiveModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
             <>
             <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Réceptionner la commande</h2>
                <p className="text-sm text-gray-500">{selectedOrder.orderNumber}</p>
              </div>
              <button onClick={() => setShowReceiveModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><span className="font-medium">Fournisseur:</span> {selectedOrder.supplier?.name}</p>
                <p><span className="font-medium">Date:</span> {new Date(selectedOrder.orderDate).toLocaleDateString('fr-FR')}</p>
                 <p><span className="font-medium">Total:</span> {selectedOrder.totalAmount?.toFixed(2)} DH</p>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">Produits reçus</label>
              <div className="space-y-3">
                {selectedOrder.items.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-3 bg-white border rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium">{item.product?.name}</span>
                      <div className="text-sm text-gray-500">
                        Commandé: {item.quantity} × {item.unitPrice?.toFixed(2)} DH = {(item.quantity * item.unitPrice)?.toFixed(2)} DH
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Qté reçue</label>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={receiveForm[item.id]?.receivedQty || item.quantity}
                          onChange={(e) => setReceiveForm({
                            ...receiveForm,
                            [item.id]: {
                              ...receiveForm[item.id],
                              receivedQty: parseInt(e.target.value) || 0
                            }
                          })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">DLUO</label>
                        <input
                          type="date"
                          value={receiveForm[item.id]?.expiryDate || ''}
                          onChange={(e) => setReceiveForm({
                            ...receiveForm,
                            [item.id]: {
                              ...receiveForm[item.id],
                              expiryDate: e.target.value
                            }
                          })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowReceiveModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleReceiveOrder}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Check size={18} />
                  Confirmer la réception
                 </button>
               </div>
             </div>
             </> 
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPurchaseOrders;