import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Filter, Edit, Eye, UserCheck, UserX, Trash2, Trash,
  ChevronLeft, ChevronRight, MoreVertical, Shield,
  Activity, BarChart3, Download, X, Crown, ArrowLeft, FileText,
  UserPlus, Check, AlertCircle, Pencil, Plus,Clock
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import adminApi from '../api/adminAxios';
import { usePermissionsStore } from '../stores';

const AdminUsers = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('clients');
  const { canCreate, canEdit, canDelete } = usePermissionsStore();
  const btn = (allowed, cls) => allowed ? cls : cls + ' opacity-40 cursor-not-allowed pointer-events-none';
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
    isActive: true,
    notificationEmail: true,
    notificationSMS: false,
    notificationPush: true
  });

  // Gestion des employés
  const [employees, setEmployees] = useState([]);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ firstName: '', lastName: '', phone: '', email: '', password: '' });
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [employeeError, setEmployeeError] = useState('');
  const [employeeSuccess, setEmployeeSuccess] = useState('');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [editEmployeeForm, setEditEmployeeForm] = useState({ firstName: '', lastName: '', phone: '', email: '', isActive: true });
  const [updatingEmployee, setUpdatingEmployee] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [modules, setModules] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  const systemRoles = [
    { value: 'ADMIN', label: 'Administrateur', color: 'bg-red-100 text-red-800', permissions: ['all'] },
    { value: 'EMPLOYE', label: 'Employé', color: 'bg-blue-100 text-blue-800', permissions: ['products_view', 'products_stock', 'orders_view', 'orders_process', 'slots_manage', 'stock_manage', 'categories_associate'] }
  ];

  const daysOfWeek = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  useEffect(() => {
    if (activeTab === 'clients') {
      fetchUsers();
    } else if (activeTab === 'roles') {
      fetchEmployees();
    }
  }, [currentPage, searchTerm, statusFilter, sortBy, sortOrder, activeTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/users', {
        params: {
          page: currentPage,
          limit: 20,
          search: searchTerm || undefined,
          role: 'CLIENT',
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          sortBy,
          sortOrder,
          includeCart: true
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

  const fetchEmployees = async () => {
    try {
      const { data } = await adminApi.get('/employees');
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // ============= GESTION DES CRÉNEAUX HORAIRES =============
  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const { data } = await adminApi.get('/time-slots/config');
      setSlots(data || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setSlotError('Erreur lors du chargement des créneaux');
    } finally {
      setLoadingSlots(false);
    }
  };

  const fetchBlockedSlots = async () => {
    try {
      const { data } = await adminApi.get('/time-slots/blocked');
      setBlockedSlots(data || []);
    } catch (error) {
      console.error('Error fetching blocked slots:', error);
    }
  };

  const createSlot = async (e) => {
    e.preventDefault();
    setSlotError('');
    setSlotSuccess('');
    
    if (!slotForm.startTime || !slotForm.endTime) {
      setSlotError('Les heures de début et fin sont requises');
      return;
    }

    try {
      await adminApi.post('/time-slots/config', slotForm);
      setSlotSuccess('Créneau créé avec succès');
      setSlotForm({
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '10:00',
        capacity: 5,
        intervalMinutes: 30,
        active: true
      });
      setShowSlotForm(false);
      fetchSlots();
    } catch (error) {
      setSlotError(error.response?.data?.message || 'Erreur création créneau');
    }
  };

  const updateSlot = async (e) => {
    e.preventDefault();
    setSlotError('');
    setSlotSuccess('');

    try {
      await adminApi.put(`/time-slots/config/${editingSlot.id}`, {
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        capacity: slotForm.capacity,
        intervalMinutes: slotForm.intervalMinutes,
        active: slotForm.active
      });
      setSlotSuccess('Créneau modifié avec succès');
      setEditingSlot(null);
      setShowSlotForm(false);
      setSlotForm({
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '10:00',
        capacity: 5,
        intervalMinutes: 30,
        active: true
      });
      fetchSlots();
    } catch (error) {
      setSlotError(error.response?.data?.message || 'Erreur modification créneau');
    }
  };

  const deleteSlot = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce créneau ?')) return;

    try {
      await adminApi.delete(`/time-slots/config/${id}`);
      setSlotSuccess('Créneau supprimé avec succès');
      fetchSlots();
    } catch (error) {
      setSlotError('Erreur suppression créneau');
    }
  };

  const openEditSlotModal = (slot) => {
    setEditingSlot(slot);
    setSlotForm({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
      intervalMinutes: slot.intervalMinutes,
      active: slot.active
    });
    setShowSlotForm(true);
  };

  const createBlockedSlot = async (e) => {
    e.preventDefault();
    setSlotError('');

    if (!blockedSlotForm.date || !blockedSlotForm.reason) {
      setSlotError('Date et raison sont requises');
      return;
    }

    try {
      await adminApi.post('/time-slots/blocked', blockedSlotForm);
      setSlotSuccess('Créneau bloqué avec succès');
      setBlockedSlotForm({
        date: new Date().toISOString().split('T')[0],
        startTime: '',
        endTime: '',
        reason: ''
      });
      setShowBlockedSlotForm(false);
      fetchBlockedSlots();
    } catch (error) {
      setSlotError(error.response?.data?.message || 'Erreur blocage créneau');
    }
  };

  const deleteBlockedSlot = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir débloquer ce créneau ?')) return;

    try {
      await adminApi.delete(`/time-slots/blocked/${id}`);
      setSlotSuccess('Créneau débloqué avec succès');
      fetchBlockedSlots();
    } catch (error) {
      setSlotError('Erreur déblocage créneau');
    }
  };

  const createEmployee = async (e) => {
    e.preventDefault();
    setEmployeeError('');
    if (!newEmployee.firstName || !newEmployee.lastName || !newEmployee.email || !newEmployee.password) {
      setEmployeeError('Tous les champs sont requis');
      return;
    }
    setCreatingEmployee(true);
    try {
      await adminApi.post('/employees', newEmployee);
      setEmployeeSuccess('Employé créé avec succès');
      setNewEmployee({ firstName: '', lastName: '', phone: '', email: '', password: '' });
      setShowEmployeeForm(false);
      fetchEmployees();
    } catch (error) {
      setEmployeeError(error.response?.data?.message || 'Erreur création');
    } finally {
      setCreatingEmployee(false);
    }
  };

  const deleteEmployee = async (id) => {
    if (!window.confirm('Désactiver cet employé ?')) return;
    try {
      await adminApi.delete(`/employees/${id}`);
      fetchEmployees();
    } catch (error) {
      alert('Erreur désactivation');
    }
  };

  const openEditEmployeeModal = (emp) => {
    setEditingEmployee(emp);
    setEditEmployeeForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      phone: emp.phone || '',
      email: emp.email,
      isActive: emp.isActive
    });
    setShowEditEmployeeModal(true);
  };

  const updateEmployee = async (e) => {
    e.preventDefault();
    setUpdatingEmployee(true);
    try {
      await adminApi.put(`/employees/${editingEmployee.id}`, editEmployeeForm);
      setShowEditEmployeeModal(false);
      fetchEmployees();
    } catch (error) {
      alert('Erreur mise à jour');
    } finally {
      setUpdatingEmployee(false);
    }
  };

  // Gestion des permissions
  const fetchEmployeePermissions = async (employeeId) => {
    setLoadingPermissions(true);
    try {
      const [modulesResponse, permissionsResponse] = await Promise.all([
        adminApi.get('/employees/permissions/modules'),
        adminApi.get(`/employees/${employeeId}/permissions`)
      ]);
      
      console.log('Modules response:', modulesResponse.data);
      console.log('Permissions response:', permissionsResponse.data);
      
      setModules(modulesResponse.data);
      
      // Utiliser l'employeeId directement et créer un objet employé simple
      const employee = employees.find(emp => emp.id === employeeId) || { id: employeeId };
      setEditingPermissions(employee);
      
      // Initialiser les permissions avec les valeurs actuelles
      const initialPermissions = {};
      modulesResponse.data.forEach(module => {
        initialPermissions[module.key] = permissionsResponse.data.permissions?.[module.key] || {
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false
        };
      });
      setPermissions(initialPermissions);
      setShowPermissionsModal(true);
    } catch (error) {
      console.error('Erreur lors du chargement des permissions:', error);
      alert('Erreur lors du chargement des permissions');
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handlePermissionChange = (moduleKey, permissionType, checked) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [permissionType]: checked
      }
    }));
  };

  const handleSelectAllForModule = (moduleKey, checked) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: {
        canView: checked,
        canCreate: checked,
        canEdit: checked,
        canDelete: checked
      }
    }));
  };

  const saveEmployeePermissions = async () => {
    if (!editingPermissions?.id) {
      alert('Erreur: ID employé manquant');
      return;
    }
    
    try {
      await adminApi.put(`/employees/${editingPermissions.id}/permissions`, { permissions });
      setShowPermissionsModal(false);
      setEditingPermissions(null);
      alert('Permissions mises à jour avec succès !');
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la sauvegarde des permissions');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data } = await adminApi.get('/audit-logs', {
        params: { limit: 100 }
      });
      setAuditLogs(data.logs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      alert('Erreur lors du chargement du journal d\'activité');
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address,
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
      alert('Client modifié avec succès');
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
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le client ${userEmail} ? Cette action est irréversible.`)) return;

    try {
      await adminApi.delete(`/users/${userId}`);
      fetchUsers();
      alert('Client supprimé avec succès');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const exportClientsToCSV = () => {
    if (users.length === 0) {
      alert('Aucun client à exporter');
      return;
    }

    const csvContent = [
      ['Nom Complet', 'Email', 'Téléphone', 'Adresse', 'Nombre de Commandes', 'Statut', 'Inscrit le'].join(','),
      ...users.map(u =>
        [
          `${u.firstName} ${u.lastName}`,
          u.email,
          u.phone || '-',
          u.address || '-',
          u._count.orders,
          u.isActive ? 'Actif' : 'Inactif',
          new Date(u.createdAt).toLocaleDateString('fr-FR')
        ].map(v => `"${v}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clients_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const exportClientsToPDF = () => {
    if (users.length === 0) {
      alert('Aucun client à exporter');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.setFontSize(16);
    doc.text('Liste des Clients', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 22, { align: 'center' });
    
    const tableData = users.map(u => [
      `${u.firstName} ${u.lastName}`,
      u.email,
      u.phone || '-',
      u._count.orders,
      u.isActive ? 'Actif' : 'Inactif',
      new Date(u.createdAt).toLocaleDateString('fr-FR')
    ]);

    autoTable(doc, {
      head: [['Nom Complet', 'Email', 'Téléphone', 'Commandes', 'Statut', 'Inscription']],
      body: tableData,
      startY: 28,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 100, 200],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        textColor: 50
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 }
      }
    });

    doc.save(`clients_${new Date().toISOString().split('T')[0]}.pdf`);
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

  if (loading && users.length === 0 && activeTab === 'clients') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
              title="Retour au Tableau de Bord"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-semibold hidden md:inline">Dashboard</span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
              <p className="text-gray-600">Administration des clients et équipe</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-8">
            <button
              onClick={() => {
                setActiveTab('clients');
                setCurrentPage(1);
                setSearchTerm('');
              }}
              className={`pb-4 px-2 font-medium border-b-2 transition-colors ${
                activeTab === 'clients'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users size={18} />
                Clients
              </div>
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`pb-4 px-2 font-medium border-b-2 transition-colors ${
                activeTab === 'roles'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield size={18} />
                Rôles du Système
              </div>
            </button>
            <button
              onClick={() => {
                setActiveTab('audit');
                fetchAuditLogs();
              }}
              className={`pb-4 px-2 font-medium border-b-2 transition-colors ${
                activeTab === 'audit'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity size={18} />
                Journal d'Activité
              </div>
            </button>
          </div>
        </div>

        {/* SECTION CLIENTS */}
        {activeTab === 'clients' && (() => {
          
          return (
            <>
              {/* Filtres et recherche */}
              <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Recherche par nom et email */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou email..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Filtre par statut */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
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
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="createdAt_desc">Plus récent</option>
                  <option value="createdAt_asc">Plus ancien</option>
                  <option value="lastName_asc">Nom (A-Z)</option>
                  <option value="lastName_desc">Nom (Z-A)</option>
                  <option value="email_asc">Email (A-Z)</option>
                  <option value="orderCount_desc">Plus de commandes</option>
                  <option value="orderCount_asc">Moins de commandes</option>
                </select>
              </div>
            </div>

            {/* Actions d'export */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex gap-3 flex-wrap">
              <button
                onClick={exportClientsToPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <FileText size={18} />
                Exporter en PDF
              </button>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total clients</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{pagination?.total || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <UserCheck className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Actifs</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">
                      {users.filter(u => u.isActive).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Activity className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Inactifs</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">
                      {users.filter(u => !u.isActive).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Nouveaux ce mois</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">
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

            {/* Table des clients */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Commandes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Panier Actuel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Inscription
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                          Aucun client trouvé
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                                  <span className="text-sm font-medium text-white">
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
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {user.isActive ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user._count.orders}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {user.cart && Array.isArray(user.cart) && user.cart.length > 0 ? (
                                <div>
                                  <span className="font-medium text-blue-600">
                                    {user.cart.length} article{user.cart.length > 1 ? 's' : ''}
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {user.cart.slice(0, 2).map((item, index) => (
                                      <div key={index}>
                                        {item.quantity}x {item.product?.name || 'Produit'}
                                      </div>
                                    ))}
                                    {user.cart.length > 2 && (
                                      <div className="text-gray-400">+{user.cart.length - 2} autre{user.cart.length - 2 > 1 ? 's' : ''}...</div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">Panier vide</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => fetchUserDetails(user.id)}
                                className="text-blue-600 hover:text-blue-900 p-1.5 hover:bg-blue-50 rounded"
                                title="Voir détails"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="text-gray-600 hover:text-gray-900 p-1.5 hover:bg-gray-100 rounded"
                                title="Modifier"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                                className={user.isActive ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}
                                title={user.isActive ? 'Désactiver' : 'Activer'}
                              >
                                {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, user.email)}
                                className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-50 rounded"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
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
          </>
          );
        })()}

        {/* SECTION RÔLES */}
        {activeTab === 'roles' && (() => {
          
          return (
            <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Gestion des employés</h3>
                  <p className="text-sm text-gray-500">Créez et gérez les comptes employés</p>
                </div>
                <button
                  onClick={() => { setShowEmployeeForm(true); setEmployeeError(''); setEmployeeSuccess(''); }}
                  className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg inline-flex items-center gap-2"
                >
                  <UserPlus size={18} />
                  Ajouter
                </button>
              </div>

              {employees.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Aucun employé enregistré.</p>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Nom</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Email</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Téléphone</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Statut</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Créé le</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(emp => (
                        <tr key={emp.id} className="border-t">
                          <td className="px-4 py-3">{emp.firstName} {emp.lastName}</td>
                          <td className="px-4 py-3">{emp.email}</td>
                          <td className="px-4 py-3">{emp.phone || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${emp.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {emp.isActive ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="px-4 py-3">{new Date(emp.createdAt).toLocaleDateString('fr-FR')}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => fetchEmployeePermissions(emp.id)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg mr-1"
                              title="Gérer les permissions"
                            >
                              <Shield size={16} />
                            </button>
                            
                            <button
                              onClick={() => openEditEmployeeModal(emp)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg mr-1"
                              title="Modifier"
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              onClick={() => deleteEmployee(emp.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Désactiver"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* SECTION JOURNAL D'ACTIVITÉ */}
        {activeTab === 'audit' && (() => {
          
          return (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Journal d'Activité Administratif</h3>
                    <p className="text-sm text-gray-500">Historique des actions administratives effectuées sur les comptes utilisateurs</p>
                  </div>
                </div>

                {/* Tableau des logs d'audit */}
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Date/Heure
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Utilisateur
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Action
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          IP
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                            Aucune activité trouvée
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(log.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {log.user?.email || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                                log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                                log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                                log.action === 'ACTIVATE' ? 'bg-green-100 text-green-800' :
                                log.action === 'DEACTIVATE' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="max-w-xs truncate" title={log.description}>
                                {log.description}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.ipAddress || 'N/A'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
        {activeTab === 'slots' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Messages */}
            {slotError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle size={18} />
                {slotError}
              </div>
            )}
            {slotSuccess && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                <Check size={18} />
                {slotSuccess}
              </div>
            )}

            {/* Créneaux par jour */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Configuration des créneaux horaires</h3>
                  <p className="text-sm text-gray-500">Gérez les créneaux disponibles pour chaque jour de la semaine</p>
                </div>
                <button
                  onClick={() => {
                    setEditingSlot(null);
                    setSlotForm({
                      dayOfWeek: 0,
                      startTime: '09:00',
                      endTime: '10:00',
                      capacity: 5,
                      intervalMinutes: 30,
                      active: true
                    });
                    setShowSlotForm(true);
                    setSlotError('');
                    setSlotSuccess('');
                  }}
                  className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  Ajouter
                </button>
              </div>

              {loadingSlots ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {daysOfWeek.map((day, dayIndex) => {
                    const daySlots = slots.filter(s => s.dayOfWeek === dayIndex);
                    return (
                      <div key={dayIndex} className="border rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">{day}</h4>
                        {daySlots.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">Aucun créneau</p>
                        ) : (
                          <div className="space-y-2">
                            {daySlots.map(slot => (
                              <div key={slot.id} className={`p-3 rounded-lg text-sm ${slot.active ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {slot.startTime} - {slot.endTime}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                      Capacité: {slot.capacity} | Intervalle: {slot.intervalMinutes}min
                                    </div>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => openEditSlotModal(slot)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                                      title="Modifier"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => deleteSlot(slot.id)}
                                      className="p-1.5 text-red-600 hover:bg-red-100 rounded"
                                      title="Supprimer"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${slot.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                                  {slot.active ? 'Actif' : 'Inactif'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Créneaux bloqués - Admin uniquement */}
            {(() => {
              const user = JSON.parse(localStorage.getItem('user') || '{}');
              return user.role === 'ADMIN' ? (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Créneaux bloqués</h3>
                      <p className="text-sm text-gray-500">Bloquez des créneaux pour les jours de fermeture ou événements spéciaux</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowBlockedSlotForm(true);
                        setSlotError('');
                        setSlotSuccess('');
                      }}
                      className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg inline-flex items-center gap-2"
                    >
                      <Plus size={18} />
                      Bloquer
                    </button>
                  </div>

                  {blockedSlots.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">Aucun créneau bloqué</p>
                  ) : (
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <table className="w-full min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Date</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Horaires</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Raison</th>
                            <th className="px-4 py-2 text-right font-semibold text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {blockedSlots.map(slot => (
                            <tr key={slot.id} className="border-t">
                              <td className="px-4 py-3">{new Date(slot.date).toLocaleDateString('fr-FR')}</td>
                              <td className="px-4 py-3">
                                {slot.startTime ? `${slot.startTime} - ${slot.endTime || 'fin'}` : 'Journée entière'}
                              </td>
                              <td className="px-4 py-3">{slot.reason}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => deleteBlockedSlot(slot.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Débloquer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Modal ajout employé */}
      {showEmployeeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Ajouter un employé</h3>
              <button onClick={() => { setShowEmployeeForm(false); setEmployeeError(''); setEmployeeSuccess(''); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            {employeeError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle size={18} />
                {employeeError}
              </div>
            )}
            {employeeSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                <Check size={18} />
                {employeeSuccess}
              </div>
            )}
            <form onSubmit={createEmployee}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Prénom</label>
                    <input type="text" value={newEmployee.firstName} onChange={e => setNewEmployee(p => ({...p, firstName: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Prénom" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nom</label>
                    <input type="text" value={newEmployee.lastName} onChange={e => setNewEmployee(p => ({...p, lastName: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Nom" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input type="email" value={newEmployee.email} onChange={e => setNewEmployee(p => ({...p, email: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="email@exemple.com" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Téléphone</label>
                  <input type="tel" value={newEmployee.phone} onChange={e => setNewEmployee(p => ({...p, phone: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="06 12 34 56 78" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mot de passe</label>
                  <input type="password" value={newEmployee.password} onChange={e => setNewEmployee(p => ({...p, password: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Mot de passe" />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => { setShowEmployeeForm(false); setEmployeeError(''); setEmployeeSuccess(''); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={creatingEmployee} className="flex-1 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg disabled:opacity-50">{creatingEmployee ? 'Création...' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal modifier employé */}
      {showEditEmployeeModal && editingEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Modifier l'employé</h3>
              <button onClick={() => setShowEditEmployeeModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={updateEmployee}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Prénom</label>
                    <input type="text" value={editEmployeeForm.firstName} onChange={e => setEditEmployeeForm(p => ({...p, firstName: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nom</label>
                    <input type="text" value={editEmployeeForm.lastName} onChange={e => setEditEmployeeForm(p => ({...p, lastName: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input type="email" value={editEmployeeForm.email} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Téléphone</label>
                  <input type="tel" value={editEmployeeForm.phone} onChange={e => setEditEmployeeForm(p => ({...p, phone: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Statut</label>
                  <select value={editEmployeeForm.isActive ? 'true' : 'false'} onChange={e => setEditEmployeeForm(p => ({...p, isActive: e.target.value === 'true'}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="true">Actif</option>
                    <option value="false">Inactif</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setShowEditEmployeeModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={updatingEmployee} className="flex-1 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg disabled:opacity-50">{updatingEmployee ? 'Enregistrement...' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Détails Client */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 sm:top-20 mx-auto p-4 sm:p-5 border w-full sm:w-11/12 md:w-4/5 max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium text-gray-900">
                  Détails du client
                </h3>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                      <p className="text-sm text-gray-900">{selectedUser.phone || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Adresse</label>
                      <p className="text-sm text-gray-900">{selectedUser.address || '-'}</p>
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
                  {selectedUser.orders && selectedUser.orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">#{order.orderNumber}</div>
                          <div className="text-sm text-gray-600">
                            {order.items.map(item => `${item.quantity}x ${item.product.name}`).join(', ')}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(order.createdAt)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">{order.total.toFixed(2)} DH</div>
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
                  {(!selectedUser.orders || selectedUser.orders.length === 0) && (
                    <div className="text-center text-gray-500 py-8">
                      Aucune commande trouvée
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edition Client */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 sm:top-20 mx-auto p-4 sm:p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Modifier le client
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

                <div className="flex justify-end space-x-3 pt-4 border-t">
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

      {showPermissionsModal && editingPermissions && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-5 mx-auto p-4 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-[95vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-medium text-gray-900">
                    Gérer les permissions
                  </h3>
                  <p className="text-gray-600 mt-1">
                    Employé: {editingPermissions.firstName} {editingPermissions.lastName} ({editingPermissions.email})
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setEditingPermissions(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {loadingPermissions ? (
                <div className="flex justify-center items-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2">Chargement...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Sélectionnez les pages auxquelles cet employé aura accès et les actions qu'il pourra effectuer.
                  </p>
                  
                  {modules.map((module) => (
                    <div key={module.key} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{module.label}</h4>
                          <p className="text-sm text-gray-500">{module.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const allSelected = permissions[module.key]?.canView && 
                                              permissions[module.key]?.canCreate && 
                                              permissions[module.key]?.canEdit && 
                                              permissions[module.key]?.canDelete;
                            handleSelectAllForModule(module.key, !allSelected);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {permissions[module.key]?.canView && 
                           permissions[module.key]?.canCreate && 
                           permissions[module.key]?.canEdit && 
                           permissions[module.key]?.canDelete ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={permissions[module.key]?.canView || false}
                            onChange={(e) => handlePermissionChange(module.key, 'canView', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Consulter</span>
                        </label>
                        
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={permissions[module.key]?.canCreate || false}
                            onChange={(e) => handlePermissionChange(module.key, 'canCreate', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Créer</span>
                        </label>
                        
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={permissions[module.key]?.canEdit || false}
                            onChange={(e) => handlePermissionChange(module.key, 'canEdit', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Modifier</span>
                        </label>
                        
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={permissions[module.key]?.canDelete || false}
                            onChange={(e) => handlePermissionChange(module.key, 'canDelete', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Supprimer</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-6 mt-8 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setEditingPermissions(null);
                  }}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={saveEmployeePermissions}
                  disabled={loadingPermissions}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;