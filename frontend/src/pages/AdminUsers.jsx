import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Filter, Edit, Eye, UserCheck, UserX, Trash2,
  ChevronLeft, ChevronRight, MoreVertical, Shield, Clock,
  Activity, BarChart3, Download, X, Crown
} from 'lucide-react';
import adminApi from '../api/adminAxios';

const AdminUsers = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditStats, setAuditStats] = useState(null);

  // Filtres et recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Edition utilisateur
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    role: 'CLIENT',
    isActive: true,
    notificationEmail: true,
    notificationSMS: false,
    notificationPush: true
  });

  const roles = [
    { value: 'CLIENT', label: 'Client', color: 'bg-blue-100 text-blue-800' },
    { value: 'CAISSIER', label: 'Caissier', color: 'bg-green-100 text-green-800' },
    { value: 'PREPARATEUR', label: 'Préparateur', color: 'bg-orange-100 text-orange-800' },
    { value: 'ADMIN', label: 'Administrateur', color: 'bg-red-100 text-red-800' }
  ];

  useEffect(() => {
    checkAuth();
    fetchUsers();
  }, [currentPage, searchTerm, roleFilter, statusFilter, sortBy, sortOrder]);

 // frontend/src/pages/AdminUsers.jsx
// Remplacer la fonction checkAuth

const checkAuth = () => {
  const token = localStorage.getItem('token');  // ← CHANGER: utiliser token normal
  const userStr = localStorage.getItem('user');
  
  if (!token) {
    navigate('/login');  // ← CHANGER: rediriger vers /login
    return;
  }
  
  try {
    const user = JSON.parse(userStr);
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'CAISSIER' || user?.role === 'PREPARATEUR';
    if (!isAdmin) {
      navigate('/');  // ← CHANGER: rediriger vers accueil
      return;
    }
  } catch (error) {
    navigate('/login');
    return;
  }
  
  adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/users', {
        params: {
          page: currentPage,
          limit: 20,
          search: searchTerm || undefined,
          role: roleFilter !== 'ALL' ? roleFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          sortBy,
          sortOrder
        }
      });
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching users:', error);
      if (error.response?.status === 403 || error.response?.status === 401) {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId) => {
    try {
      const { data } = await adminApi.get(`/users/${userId}`);
      setSelectedUser(data);
      setShowUserModal(true);
    } catch (error) {
      console.error('Error fetching user details:', error);
      alert('Erreur lors du chargement des détails utilisateur');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data } = await adminApi.get('/audit-logs', {
        params: { limit: 100 }
      });
      setAuditLogs(data.logs);
      setShowAuditModal(true);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      alert('Erreur lors du chargement du journal d\'activité');
    }
  };

  const fetchAuditStats = async () => {
    try {
      const { data } = await adminApi.get('/audit-logs/stats');
      setAuditStats(data);
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address,
      role: user.role,
      isActive: user.isActive,
      notificationEmail: user.notificationEmail,
      notificationSMS: user.notificationSMS,
      notificationPush: user.notificationPush
    });
    setShowEditModal(true);
  };

  const handleSaveUser = async () => {
    try {
      await adminApi.put(`/users/${editingUser.id}`, editForm);
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
      alert('Utilisateur modifié avec succès');
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Erreur lors de la modification');
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const action = currentStatus ? 'désactiver' : 'activer';
    if (!confirm(`Êtes-vous sûr de vouloir ${action} ce compte ?`)) return;

    try {
      await adminApi.put(`/users/${userId}/status`, { isActive: !currentStatus });
      fetchUsers();
      alert(`Compte ${action === 'désactiver' ? 'désactivé' : 'activé'} avec succès`);
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert('Erreur lors de la modification du statut');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${userEmail} ? Cette action est irréversible.`)) return;

    try {
      await adminApi.delete(`/users/${userId}`);
      fetchUsers();
      alert('Utilisateur supprimé avec succès');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handlePromoteToAdmin = async (user) => {
    const newRole = user.role === 'ADMIN' ? 'CLIENT' : 'ADMIN';
    const action = newRole === 'ADMIN' ? 'promouvoir en Administrateur' : 'rétrograder en Client';
    if (!confirm(`Êtes-vous sûr de vouloir ${action} ${user.firstName} ${user.lastName} ?`)) return;
    try {
      await adminApi.put(`/users/${user.id}`, { ...user, role: newRole });
      fetchUsers();
    } catch (error) {
      alert('Erreur lors du changement de rôle');
    }
  };

  const getRoleBadge = (role) => {
    const roleData = roles.find(r => r.value === role);
    return roleData ? (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${roleData.color}`}>
        {roleData.label}
      </span>
    ) : null;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des utilisateurs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
              <p className="text-gray-600">Administration des comptes clients et employés</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  fetchAuditLogs();
                  fetchAuditStats();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <Activity className="w-4 h-4" />
                Journal d'activité
              </button>
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Retour au tableau de bord
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filtres et recherche */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filtre par rôle */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tous les rôles</option>
              {roles.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>

            {/* Filtre par statut */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
            </select>

            {/* Tri */}
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('_');
                setSortBy(field);
                setSortOrder(order);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="createdAt_desc">Plus récent</option>
              <option value="createdAt_asc">Plus ancien</option>
              <option value="lastName_asc">Nom (A-Z)</option>
              <option value="lastName_desc">Nom (Z-A)</option>
              <option value="email_asc">Email (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total utilisateurs</p>
                <p className="text-2xl font-bold text-gray-900">{pagination?.total || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Actifs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.isActive).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Employés</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => ['ADMIN', 'CAISSIER', 'PREPARATEUR'].includes(u.role)).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Nouveaux ce mois</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => {
                    const userDate = new Date(u.createdAt);
                    const now = new Date();
                    return userDate.getMonth() === now.getMonth() &&
                           userDate.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Table des utilisateurs */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commandes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user._count.orders}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => fetchUserDetails(user.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-gray-600 hover:text-gray-900"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePromoteToAdmin(user)}
                        className={user.role === 'ADMIN' ? 'text-yellow-500 hover:text-yellow-700' : 'text-purple-600 hover:text-purple-900'}
                        title={user.role === 'ADMIN' ? 'Rétrograder en Client' : 'Promouvoir en Admin'}
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                        className={user.isActive ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}
                        title={user.isActive ? 'Désactiver' : 'Activer'}
                      >
                        {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                      {user.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-6 py-3 rounded-lg shadow-sm mt-6">
            <div className="text-sm text-gray-700">
              Affichage de {((pagination.page - 1) * pagination.limit) + 1} à{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} sur{' '}
              {pagination.total} résultats
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700">
                Page {pagination.page} sur {pagination.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Détails Utilisateur */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium text-gray-900">
                  Détails de l'utilisateur
                </h3>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informations personnelles */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Informations personnelles</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nom complet</label>
                      <p className="text-sm text-gray-900">{selectedUser.firstName} {selectedUser.lastName}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="text-sm text-gray-900">{selectedUser.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Téléphone</label>
                      <p className="text-sm text-gray-900">{selectedUser.phone}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Adresse</label>
                      <p className="text-sm text-gray-900">{selectedUser.address}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Rôle</label>
                      <div className="mt-1">{getRoleBadge(selectedUser.role)}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Statut</label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                        selectedUser.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedUser.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Statistiques */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Statistiques</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{selectedUser._count.orders}</div>
                      <div className="text-sm text-blue-800">Commandes</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{selectedUser._count.favorites}</div>
                      <div className="text-sm text-green-800">Favoris</div>
                    </div>
                  </div>

                  <h4 className="text-lg font-medium text-gray-900 mt-6 mb-4">Panier actuel</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    {selectedUser.cart && selectedUser.cart.length > 0 ? (
                      <div className="text-sm text-gray-600">
                        {selectedUser.cart.length} article(s) dans le panier
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Panier vide</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Historique des commandes */}
              <div className="mt-8">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Historique des commandes</h4>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {selectedUser.orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">#{order.orderNumber}</div>
                          <div className="text-sm text-gray-600">
                            {order.items.map(item => `${item.quantity}x ${item.product.name}`).join(', ')}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(order.createdAt)}
                            {order.timeSlotDate && ` • Créneau: ${new Date(order.timeSlotDate).toLocaleDateString('fr-FR')} ${order.timeSlotStart}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">{order.total.toFixed(2)} €</div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                            order.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                            order.status === 'PREPARING' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'RECEIVED' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedUser.orders.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      Aucune commande trouvée
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edition Utilisateur */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Modifier l'utilisateur
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSaveUser(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Prénom</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nom</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Téléphone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Adresse</label>
                  <textarea
                    value={editForm.address}
                    onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                    rows="3"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Rôle</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Notifications</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.notificationEmail}
                        onChange={(e) => setEditForm({...editForm, notificationEmail: e.target.checked})}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Email</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.notificationSMS}
                        onChange={(e) => setEditForm({...editForm, notificationSMS: e.target.checked})}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">SMS</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.notificationPush}
                        onChange={(e) => setEditForm({...editForm, notificationPush: e.target.checked})}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Push</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({...editForm, isActive: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Compte actif
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Journal d'activité */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-5/6 max-w-6xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium text-gray-900">
                  Journal d'activité
                </h3>
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Statistiques du journal */}
              {auditStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{auditStats.actionStats?.length || 0}</div>
                    <div className="text-sm text-blue-800">Types d'actions</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {auditStats.actionStats?.reduce((sum, stat) => sum + stat._count.action, 0) || 0}
                    </div>
                    <div className="text-sm text-green-800">Actions totales</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{auditStats.userStats?.length || 0}</div>
                    <div className="text-sm text-orange-800">Utilisateurs actifs</div>
                  </div>
                </div>
              )}

              {/* Table du journal */}
              <div className="bg-white shadow-sm rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Heure
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Utilisateur
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entité
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.user.firstName} {log.user.lastName}
                          <br />
                          <span className="text-xs text-gray-500">{log.user.email}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                            log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                            log.action === 'LOGIN' ? 'bg-purple-100 text-purple-800' :
                            log.action === 'ACTIVATE' ? 'bg-green-100 text-green-800' :
                            log.action === 'DEACTIVATE' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.entityType}
                          {log.entityId && <br />}
                          {log.entityId && <span className="text-xs">{log.entityId}</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {log.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;