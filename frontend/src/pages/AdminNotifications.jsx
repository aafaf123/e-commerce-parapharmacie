import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../api/adminAxios';
import {
  ArrowLeft, CheckCircle, XCircle, AlertCircle, Info,
  Check, Bell, RefreshCw, ShoppingCart, Package, Trash2, Filter
} from 'lucide-react';

const TYPE_CONFIG = {
  ORDER_MODIFIED:  { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200', label: 'Modifiée' },
  ORDER_CANCELLED: { icon: XCircle,     color: 'text-red-500',    bg: 'bg-red-50 border-red-200',       label: 'Annulée' },
  NEW_ORDER:       { icon: CheckCircle, color: 'text-green-500',  bg: 'bg-green-50 border-green-200',   label: 'Nouvelle' },
  ORDER_STATUS:    { icon: ShoppingCart,color: 'text-blue-500',   bg: 'bg-blue-50 border-blue-200',     label: 'Statut' },
  default:         { icon: Info,        color: 'text-sky-500',    bg: 'bg-sky-50 border-sky-200',        label: 'Info' },
};

const AdminNotifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all | unread | ORDER_MODIFIED | ORDER_CANCELLED | NEW_ORDER
  const [markingAll, setMarkingAll] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    // Polling toutes les 15 secondes pour synchronisation temps réel
    intervalRef.current = setInterval(fetchNotifications, 15000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await adminApi.get('/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (id) => {
    try {
      await adminApi.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await adminApi.put('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await adminApi.delete(`/notifications/${id}`).catch(() => {});
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'all') return true;
    return n.type === filter;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Bell className="w-6 h-6 text-sky-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Notifications commandes</h1>
              <p className="text-sm text-gray-500">
                {unreadCount > 0 ? (
                  <span className="text-orange-600 font-medium">{unreadCount} non lue(s)</span>
                ) : (
                  'Tout est à jour'
                )}
                {' · '}{notifications.length} au total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Actualiser"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={markingAll}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                <Check className="w-4 h-4" />
                {markingAll ? 'Marquage...' : 'Tout lire'}
              </button>
            )}
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'all',             label: 'Toutes',    count: notifications.length },
            { key: 'unread',          label: 'Non lues',  count: unreadCount },
            { key: 'NEW_ORDER',       label: 'Nouvelles', count: notifications.filter(n => n.type === 'NEW_ORDER').length },
            { key: 'ORDER_MODIFIED',  label: 'Modifiées', count: notifications.filter(n => n.type === 'ORDER_MODIFIED').length },
            { key: 'ORDER_CANCELLED', label: 'Annulées',  count: notifications.filter(n => n.type === 'ORDER_CANCELLED').length },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-sky-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  filter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune notification</h3>
            <p className="text-gray-500 text-sm">
              {filter === 'unread' ? 'Toutes les notifications ont été lues.' : 'Aucune notification dans cette catégorie.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((notification) => {
              const cfg = TYPE_CONFIG[notification.type] || TYPE_CONFIG.default;
              const Icon = cfg.icon;
              return (
                <div
                  key={notification.id}
                  className={`bg-white border rounded-xl p-4 transition-all ${
                    !notification.read ? 'border-l-4 border-l-sky-500 shadow-sm' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${cfg.bg} flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 text-sm">{notification.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-sky-500 rounded-full flex-shrink-0" title="Non lue" />
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                          {new Date(notification.createdAt).toLocaleString('fr-FR', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm mb-2">{notification.message}</p>
                      {notification.data?.changes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {notification.data.changes.map((c, i) => (
                            <span key={i} className="text-xs bg-orange-50 border border-orange-200 rounded px-2 py-0.5 text-orange-800">
                              • {c}
                            </span>
                          ))}
                        </div>
                      )}
                      {notification.data?.orderNumber && (
                        <button
                          onClick={() => navigate(`/admin/orders?search=${notification.data.orderNumber}`)}
                          className="text-xs text-sky-600 hover:text-sky-800 font-medium hover:underline"
                        >
                          Voir commande #{notification.data.orderNumber} →
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                          title="Marquer comme lu"
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotifications;
