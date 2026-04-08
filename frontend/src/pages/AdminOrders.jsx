import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Filter, Package, Clock, CheckCircle, XCircle,
  User, Phone, Mail, MapPin, Calendar, Printer, Eye, ChevronDown,
  AlertCircle, RefreshCw, Download
} from 'lucide-react';
import adminApi from '../api/adminAxios';
import { useAdminWebSocket } from '../context/AdminWebSocketContext';

const AdminOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    date: '',
    page: 1
  });
  const [pagination, setPagination] = useState(null);

  const { socket, isConnected } = useAdminWebSocket();

  const statusConfig = {
    RECEIVED: { label: 'Reçu', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Package },
    PREPARING: { label: 'En Préparation', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: Clock },
    READY: { label: 'Prêt', color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle },
    COMPLETED: { label: 'Récupéré', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: CheckCircle },
    CANCELLED: { label: 'Annulé', color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle },
    RETURNED: { label: 'Retourné', color: 'bg-purple-100 text-purple-700 border-purple-300', icon: RefreshCw }
  };

  // Check if order is urgent (within 2 hours of pickup time)
  const isOrderUrgent = (order) => {
    if (!order.timeSlotDate || !order.timeSlotStart) return false;
    const now = new Date();
    const pickupTime = new Date(order.timeSlotDate);
    const [hours, minutes] = order.timeSlotStart.split(':').map(Number);
    pickupTime.setHours(hours, minutes, 0, 0);
    const timeDiff = pickupTime - now;
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    return timeDiff > 0 && timeDiff <= twoHoursInMs;
  };

  const statusWorkflow = {
    RECEIVED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY', 'CANCELLED'],
    READY: ['COMPLETED', 'CANCELLED'],
    COMPLETED: ['RETURNED'],
    CANCELLED: [],
    RETURNED: []
  };

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (orderData) => {
      console.log('Nouvelle commande reçue:', orderData);
      setOrders(prevOrders => [orderData, ...prevOrders]);
    };

    const handleOrderStatusChanged = (orderData) => {
      console.log('Statut commande changé:', orderData);
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderData.id 
            ? { ...order, status: orderData.status, updatedAt: orderData.updatedAt }
            : order
        )
      );
      if (selectedOrder?.id === orderData.id) {
        setSelectedOrder(prev => ({ ...prev, status: orderData.status }));
      }
    };

    socket.on('admin_new_order', handleNewOrder);
    socket.on('admin_order_status_changed', handleOrderStatusChanged);

    return () => {
      socket.off('admin_new_order', handleNewOrder);
      socket.off('admin_order_status_changed', handleOrderStatusChanged);
    };
  }, [socket, selectedOrder]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.page) params.append('page', filters.page);
      params.append('limit', '20');

      const { data } = await adminApi.get(`/orders?${params.toString()}`);
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    // Confirmation dialog for RETURNED status (stock will be restored)
    if (newStatus === 'RETURNED') {
      if (!confirm('Êtes-vous sûr de vouloir marquer cette commande comme retournée ? Le stock des produits sera automatiquement réapprovisionné.')) {
        return;
      }
    }
    
    // Confirmation dialog for CANCELLED status
    if (newStatus === 'CANCELLED') {
      if (!confirm('Êtes-vous sûr de vouloir annuler cette commande ? Le stock des produits sera automatiquement réapprovisionné.')) {
        return;
      }
    }

    try {
      await adminApi.put(`/orders/${orderId}/status`, { status: newStatus });
      
      // Mettre à jour localement
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));

      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }

      alert('Statut mis à jour avec succès');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const handlePrintPickingList = (order) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fiche de Préparation - ${order.orderNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ccc; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f3f4f6; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FICHE DE PRÉPARATION</h1>
          <p>Commande N° ${order.orderNumber}</p>
          <p>Date: ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>

        <div class="section">
          <div class="section-title">INFORMATIONS CLIENT</div>
          <p><strong>Nom:</strong> ${order.user?.firstName} ${order.user?.lastName}</p>
          <p><strong>Téléphone:</strong> ${order.user?.phone}</p>
          <p><strong>Email:</strong> ${order.user?.email}</p>
        </div>

        <div class="section">
          <div class="section-title">CRÉNEAU DE RETRAIT</div>
          <p><strong>Date:</strong> ${new Date(order.timeSlotDate).toLocaleDateString('fr-FR')}</p>
          <p><strong>Heure:</strong> ${order.timeSlotStart} - ${order.timeSlotEnd}</p>
        </div>

        <div class="section">
          <div class="section-title">PRODUITS À PRÉPARER</div>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Quantité</th>
                <th>Prix unitaire</th>
                <th>Total</th>
                <th>✓</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td>${item.product.name}</td>
                  <td>${item.quantity}</td>
                  <td>${item.price.toFixed(2)} DH</td>
                  <td>${(item.quantity * item.price).toFixed(2)} DH</td>
                  <td style="width: 30px;"></td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <th colspan="3">TOTAL</th>
                <th>${order.total.toFixed(2)} DH</th>
                <th></th>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="section">
          <div class="section-title">NOTES</div>
          <p style="height: 60px; border: 1px solid #ddd; padding: 10px;"></p>
        </div>

        <div class="footer">
          <p>Pharmacie ParaClick - 123 Avenue Mohammed V, Casablanca</p>
          <p>Préparé par: ________________ Date: ________________</p>
        </div>

        <button onclick="window.print()" style="margin: 20px auto; display: block; padding: 10px 20px; background: #0369a1; color: white; border: none; border-radius: 5px; cursor: pointer;">
          Imprimer
        </button>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredOrders = orders.filter(order => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        order.orderNumber.toLowerCase().includes(searchLower) ||
        order.user?.firstName?.toLowerCase().includes(searchLower) ||
        order.user?.lastName?.toLowerCase().includes(searchLower) ||
        order.user?.email?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sky-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des commandes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestion des Commandes</h1>
                <p className="text-sm text-gray-600">{filteredOrders.length} commande(s)</p>
              </div>
            </div>

            <button
              onClick={fetchOrders}
              className="flex items-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors"
            >
              <RefreshCw size={18} />
              <span>Actualiser</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filtres */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Recherche */}
            <div className="relative">
              <Search size={20} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par N°, client, email..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-sky-700 focus:outline-none"
              />
            </div>

            {/* Filtre statut */}
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:border-sky-700 focus:outline-none"
            >
              <option value="">Tous les statuts</option>
              <option value="RECEIVED">Reçu</option>
              <option value="PREPARING">En Préparation</option>
              <option value="READY">Prêt</option>
              <option value="COMPLETED">Récupéré</option>
              <option value="CANCELLED">Annulé</option>
              <option value="RETURNED">Retourné</option>
            </select>

            {/* Filtre date */}
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value, page: 1 })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:border-sky-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Liste des commandes */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Aucune commande trouvée</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const StatusIcon = statusConfig[order.status]?.icon || Package;
              const nextStatuses = statusWorkflow[order.status] || [];

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className={`flex items-start justify-between mb-4 ${isOrderUrgent(order) ? 'bg-orange-50 -mx-2 -my-2 p-4 rounded-lg' : ''}`}>
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-sky-50 rounded-lg">
                        <Package size={24} className="text-sky-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-900">{order.orderNumber}</h3>
                          {isOrderUrgent(order) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full animate-pulse">
                              <Clock className="w-3 h-3" />
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {order.user?.firstName} {order.user?.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{order.user?.phone}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">{order.total.toFixed(2)} DH</p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 font-medium ${statusConfig[order.status]?.color}`}>
                      <StatusIcon size={16} />
                      {statusConfig[order.status]?.label}
                    </span>

                    {order.timeSlotDate && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar size={16} />
                        <span>
                          {new Date(order.timeSlotDate).toLocaleDateString('fr-FR')} à {order.timeSlotStart}
                        </span>
                      </div>
                    )}

                    <div className="text-sm text-gray-600">
                      {order.items.length} produit(s)
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                    {/* Boutons de changement de statut */}
                    {nextStatuses.map((nextStatus) => (
                      <button
                        key={nextStatus}
                        onClick={() => handleStatusChange(order.id, nextStatus)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          nextStatus === 'CANCELLED'
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : nextStatus === 'RETURNED'
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                        }`}
                      >
                        → {statusConfig[nextStatus]?.label}
                      </button>
                    ))}

                    <div className="flex-1"></div>

                    {/* Actions */}
                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowDetailModal(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Voir détails"
                    >
                      <Eye size={20} className="text-gray-600" />
                    </button>

                    <button
                      onClick={() => handlePrintPickingList(order)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Imprimer fiche"
                    >
                      <Printer size={20} className="text-gray-600" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              disabled={filters.page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <span className="px-4 py-2 text-gray-600">
              Page {filters.page} sur {pagination.totalPages}
            </span>
            <button
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              disabled={filters.page === pagination.totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        )}
      </div>

      {/* Modal Détail Commande */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Détail Commande {selectedOrder.orderNumber}
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle size={24} className="text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informations client */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <User size={20} className="text-sky-700" />
                  Informations Client
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Nom</p>
                    <p className="font-medium">{selectedOrder.user?.firstName} {selectedOrder.user?.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Téléphone</p>
                    <p className="font-medium">{selectedOrder.user?.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{selectedOrder.user?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Statut</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${statusConfig[selectedOrder.status]?.color}`}>
                      {statusConfig[selectedOrder.status]?.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Créneau */}
              {selectedOrder.timeSlotDate && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Calendar size={20} className="text-sky-700" />
                    Créneau de Retrait
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Date</p>
                      <p className="font-medium">{new Date(selectedOrder.timeSlotDate).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Heure</p>
                      <p className="font-medium">{selectedOrder.timeSlotStart} - {selectedOrder.timeSlotEnd}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Produits */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Package size={20} className="text-sky-700" />
                  Produits ({selectedOrder.items.length})
                </h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      {item.product.image && (
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.product.name}</p>
                        <p className="text-sm text-gray-600">Quantité: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{(item.quantity * item.price).toFixed(2)} DH</p>
                        <p className="text-sm text-gray-600">{item.price.toFixed(2)} DH / unité</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">TOTAL</span>
                  <span className="text-2xl font-bold text-sky-700">{selectedOrder.total.toFixed(2)} DH</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handlePrintPickingList(selectedOrder)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors"
                >
                  <Printer size={20} />
                  Imprimer Fiche de Préparation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
