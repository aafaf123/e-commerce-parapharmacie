// frontend/src/pages/AdminCategories.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Edit, Trash2, Save, X, FolderTree, 
  ChevronDown, ChevronRight, Tag, Layers, AlertCircle, ArrowLeft,
  // Import de toutes les icônes possibles pour les sous-catégories
  Sparkle, Droplet, Wind, Waves, Smile, CircleDot, Bath, 
  Baby, Milk, Heart, Tablets, Activity, Zap, Moon, Bug, 
  Umbrella, Footprints, Armchair, Hand, Bone, Gauge,
  Package, ShoppingBag, Star, Truck, Shield, Clock, Calendar,
  Users, Settings, Bell, Search, Home, Menu, CircleX, CheckCircle
} from 'lucide-react';
import axios from '../api/axios';
import adminApi from '../api/adminAxios';
import { usePermissionsStore } from '../stores';

// Helper : classe CSS selon permission
const btn = (allowed, activeClass) =>
  allowed ? activeClass : `${activeClass} opacity-40 cursor-not-allowed pointer-events-none`;

// Dictionnaire des icônes disponibles
const iconComponents = {
  // Icônes de base
  Sparkle: Sparkle,
  Droplet: Droplet,
  Wind: Wind,
  Waves: Waves,
  Smile: Smile,
  CircleDot: CircleDot,
  Bath: Bath,
  Baby: Baby,
  Milk: Milk,
  Heart: Heart,
  Tablets: Tablets,
  Activity: Activity,
  Zap: Zap,
  Moon: Moon,
  Bug: Bug,
  Umbrella: Umbrella,
  Footprints: Footprints,
  Armchair: Armchair,
  Hand: Hand,
  Bone: Bone,
  Gauge: Gauge,
  // Icônes supplémentaires
  Package: Package,
  ShoppingBag: ShoppingBag,
  Star: Star,
  Truck: Truck,
  Shield: Shield,
  Clock: Clock,
  Calendar: Calendar,
  Users: Users,
  Settings: Settings,
  Bell: Bell,
  Search: Search,
  Home: Home,
  Menu: Menu,
  CircleX: CircleX,
  CheckCircle: CheckCircle,
  // Icône par défaut
  default: Layers
};

// Fonction pour obtenir le composant icône
const getIconComponent = (iconName) => {
  if (!iconName) return iconComponents.default;
  const Icon = iconComponents[iconName];
  return Icon || iconComponents.default;
};

const AdminCategories = () => {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissionsStore();
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // États pour les modales
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [expandedSubcategories, setExpandedSubcategories] = useState({});
  
  // Formulaires
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    icon: '',
    order: 0
  });

  const [subcategoryForm, setSubcategoryForm] = useState({
    title: '',
    icon: '',
    categoryId: '',
    order: 0
  });
  
  const [itemForm, setItemForm] = useState({
    name: '',
    order: 0
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    fetchCategories();
    fetchSubcategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await adminApi.get('/categories/admin/all');
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      setCategories([]);
    }
  };

  const fetchSubcategories = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await adminApi.get('/categories/subcategories');
      
      if (Array.isArray(response.data)) {
        setSubcategories(response.data);
      } else if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data.subcategories)) {
          setSubcategories(response.data.subcategories);
        } else if (Array.isArray(response.data.data)) {
          setSubcategories(response.data.data);
        } else {
          setSubcategories([]);
        }
      } else {
        setSubcategories([]);
      }
    } catch (error) {
      console.error('Erreur chargement sous-catégories:', error);
      setError(error.response?.data?.message || 'Erreur lors du chargement des sous-catégories');
      setSubcategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.name) {
      setError('Le nom est requis');
      return;
    }
    try {
      await axios.post('/categories/admin/main', categoryForm);
      setSuccess('Catégorie créée avec succès');
      setShowCategoryModal(false);
      resetCategoryForm();
      fetchCategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la création de la catégorie');
    }
  };

  const handleUpdateCategory = async () => {
    if (!categoryForm.name) {
      setError('Le nom est requis');
      return;
    }
    try {
      await axios.put(`/categories/admin/main/${editingCategory.id}`, categoryForm);
      setSuccess('Catégorie modifiée avec succès');
      setShowCategoryModal(false);
      setEditingCategory(null);
      resetCategoryForm();
      fetchCategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la modification de la catégorie');
    }
  };

  const handleDeleteCategory = async (category) => {
    const productsCount = category._count?.products || 0;
    const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    if (productsCount > 0) {
      if (!confirm(`ATTENTION: "${category.name}" contient ${productsCount} produit(s) qui seront aussi supprimés définitivement. Continuer quand même ?`)) return;
      try {
        await axios.delete(`/categories/admin/main/${category.id}?force=true`, getAuthHeader());
        setSuccess('Catégorie et ses produits supprimés avec succès');
        fetchCategories();
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        setError(error.response?.data?.message || 'Erreur lors de la suppression');
      }
      return;
    }
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${category.name}" ?`)) return;
    try {
      await axios.delete(`/categories/admin/main/${category.id}`, getAuthHeader());
      setSuccess('Catégorie supprimée avec succès');
      fetchCategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la suppression de la catégorie');
    }
  };

  const handleCreateSubcategory = async () => {
    if (!subcategoryForm.title || !subcategoryForm.categoryId) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      await adminApi.post('/categories/admin/subcategories', subcategoryForm);
      setSuccess('Sous-catégorie créée avec succès');
      setShowSubcategoryModal(false);
      resetSubcategoryForm();
      fetchSubcategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la création');
    }
  };

  const handleUpdateSubcategory = async () => {
    if (!subcategoryForm.title) {
      setError('Le titre est requis');
      return;
    }

    try {
      await adminApi.put(`/categories/admin/subcategories/${editingSubcategory.id}`, {
        title: subcategoryForm.title,
        icon: subcategoryForm.icon,
        order: subcategoryForm.order
      });
      setSuccess('Sous-catégorie modifiée avec succès');
      setShowSubcategoryModal(false);
      setEditingSubcategory(null);
      resetSubcategoryForm();
      fetchSubcategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la modification');
    }
  };

  const handleDeleteSubcategory = async (subcategory) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la sous-catégorie "${subcategory.title}" ?`)) return;
    
    try {
      await adminApi.delete(`/categories/admin/subcategories/${subcategory.id}`);
      setSuccess('Sous-catégorie supprimée avec succès');
      fetchSubcategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleCreateItem = async () => {
    if (!itemForm.name || !selectedSubcategory) {
      setError('Nom de l\'item requis');
      return;
    }

    try {
      await adminApi.post(`/categories/admin/subcategories/${selectedSubcategory.id}/items`, itemForm);
      setSuccess('Item ajouté avec succès');
      setShowItemModal(false);
      setSelectedSubcategory(null);
      resetItemForm();
      fetchSubcategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de l\'ajout');
    }
  };

  const handleUpdateItem = async () => {
    if (!itemForm.name) {
      setError('Nom de l\'item requis');
      return;
    }

    try {
      await adminApi.put(`/categories/admin/items/${editingItem.id}`, {
        name: itemForm.name,
        order: itemForm.order
      });
      setSuccess('Item modifié avec succès');
      setShowItemModal(false);
      setEditingItem(null);
      resetItemForm();
      fetchSubcategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la modification');
    }
  };

  const handleDeleteItem = async (item) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'item "${item.name}" ?`)) return;
    
    try {
      await adminApi.delete(`/categories/admin/items/${item.id}`);

      setSuccess('Item supprimé avec succès');
      fetchSubcategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const resetSubcategoryForm = () => {
    setSubcategoryForm({
      title: '',
      icon: '',
      categoryId: '',
      order: 0
    });
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      order: 0
    });
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      icon: '',
      order: 0
    });
  };

  const openEditCategoryModal = (category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      icon: category.icon || '',
      order: category.order || 0
    });
    setShowCategoryModal(true);
  };

  const openEditSubcategoryModal = (subcategory) => {
    setEditingSubcategory(subcategory);
    setSubcategoryForm({
      title: subcategory.title,
      icon: subcategory.icon || '',
      categoryId: subcategory.categoryId,
      order: subcategory.order
    });
    setShowSubcategoryModal(true);
  };

  const openEditItemModal = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      order: item.order
    });
    setShowItemModal(true);
  };

  const toggleExpand = (subcategoryId) => {
    setExpandedSubcategories(prev => ({
      ...prev,
      [subcategoryId]: !prev[subcategoryId]
    }));
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Inconnue';
  };

  // Vérifier que subcategories est un tableau avant de continuer
  if (!Array.isArray(subcategories)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <p className="text-gray-600">Erreur de chargement des données</p>
          <button
            onClick={() => fetchSubcategories()}
            className="mt-4 px-4 py-2 bg-sky-700 text-white rounded-lg"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
              title="Retour au Tableau de Bord"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-semibold hidden md:inline">Dashboard</span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Gestion des Catégories</h1>
              <p className="text-sm text-gray-600">
                {categories.length} catégorie(s) et {subcategories.length} sous-catégorie(s)
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <button
              onClick={() => setShowCategoryModal(true)}
              disabled={!canCreate('categories')}
              className={btn(canCreate('categories'), 'inline-flex items-center justify-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg font-medium transition-colors w-full sm:w-auto')}
            >
              <Plus size={18} />
              Nouvelle Catégorie
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
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
            <p className="text-green-800">{success}</p>
          </div>
        )}

      {/* Liste des catégories et sous-catégories */}
      {categories.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <FolderTree size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg mb-2">Aucune catégorie</p>
          <p className="text-gray-400 text-sm mb-4">Commencez par créer une catégorie</p>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-sky-700 hover:bg-sky-800 text-white rounded-lg font-medium transition-colors"
          >
            <Plus size={18} />
            Créer une catégorie
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Grouper les sous-catégories par catégorie parente */}
          {categories.map((category) => {
            const categorySubcategories = subcategories.filter(sc => sc.categoryId === category.id);
            return (
              <div key={category.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* En-tête de la catégorie */}
                  <div className="px-6 py-4 bg-gradient-to-r from-sky-50 to-blue-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-sky-700"
                             onClick={() => canEdit('categories') && openEditCategoryModal(category)} title="Modifier Catégorie">
                          <FolderTree size={20} className="text-white" />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                             <h2 className="text-lg font-bold text-gray-900">{category.name}</h2>
                             <button
                               onClick={() => canDelete('categories') && handleDeleteCategory(category)}
                               disabled={!canDelete('categories')}
                               className={btn(canDelete('categories'), 'text-red-500 hover:text-red-700')}
                               title="Supprimer la Catégorie"
                             >
                               <Trash2 size={14} />
                             </button>
                          </div>
                          <p className="text-sm text-gray-500">{categorySubcategories.length} sous-catégorie(s)</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (!canCreate('categories')) return;
                          setSubcategoryForm({ ...subcategoryForm, categoryId: category.id });
                          setShowSubcategoryModal(true);
                        }}
                        disabled={!canCreate('categories')}
                        className={btn(canCreate('categories'), 'inline-flex items-center gap-1 text-sm text-sky-700 hover:text-sky-800 font-medium px-3 py-2 bg-white hover:bg-sky-50 border border-sky-200 rounded-lg transition-colors')}
                      >
                        <Plus size={16} />
                        Ajouter sous-catégorie
                      </button>
                    </div>
                  </div>

                  {/* Grille des sous-catégories de cette catégorie */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categorySubcategories.map((subcategory) => {
                        const IconComponent = getIconComponent(subcategory.icon);
                        return (
                          <div key={subcategory.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                            {/* Header de la carte */}
                            <div className="p-3 border-b border-gray-100 bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <IconComponent size={18} className="text-sky-700" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900 truncate text-sm">{subcategory.title}</h3>
                                    <p className="text-xs text-gray-500">Ordre: {subcategory.order}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                                  <button
                                    onClick={() => canEdit('categories') && openEditSubcategoryModal(subcategory)}
                                    disabled={!canEdit('categories')}
                                    className={btn(canEdit('categories'), 'p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors')}
                                    title="Modifier"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => canDelete('categories') && handleDeleteSubcategory(subcategory)}
                                    disabled={!canDelete('categories')}
                                    className={btn(canDelete('categories'), 'p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors')}
                                    title="Supprimer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Section des items */}
                            <div className="p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-600">
                                  {subcategory.items?.length || 0} item(s)
                                </span>
                                <button
                                  onClick={() => {
                                    if (!canCreate('categories')) return;
                                    setSelectedSubcategory(subcategory);
                                    resetItemForm();
                                    setEditingItem(null);
                                    setShowItemModal(true);
                                  }}
                                  disabled={!canCreate('categories')}
                                  className={btn(canCreate('categories'), 'text-xs text-sky-700 hover:text-sky-800 font-medium px-2 py-1 bg-sky-50 hover:bg-sky-100 rounded transition-colors')}
                                >
                                  + Ajouter
                                </button>
                              </div>

                              {subcategory.items && subcategory.items.length > 0 ? (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                  {subcategory.items
                                    .sort((a, b) => a.order - b.order)
                                    .map((item) => (
                                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                          <Tag size={12} className="text-gray-400 flex-shrink-0" />
                                          <span className="text-sm text-gray-700 truncate">{item.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                                          <span className="text-xs text-gray-400 mr-0.5">#{item.order}</span>
                                          <button
                                            onClick={() => canEdit('categories') && openEditItemModal(item)}
                                            disabled={!canEdit('categories')}
                                            className={btn(canEdit('categories'), 'p-0.5 text-blue-600 hover:bg-blue-100 rounded')}
                                            title="Modifier"
                                          >
                                            <Edit size={10} />
                                          </button>
                                          <button
                                            onClick={() => canDelete('categories') && handleDeleteItem(item)}
                                            disabled={!canDelete('categories')}
                                            className={btn(canDelete('categories'), 'p-0.5 text-red-600 hover:bg-red-100 rounded')}
                                            title="Supprimer"
                                          >
                                            <Trash2 size={10} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <div className="text-center py-3 text-gray-400 text-xs">
                                  <Tag size={16} className="mx-auto mb-1 text-gray-300" />
                                  Aucun item
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
          })}
        </div>
      )}
      </div>

      {/* Modal Catégorie Principale */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </h2>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  resetCategoryForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de la catégorie *
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Ex: Visage, Corps..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icône (nom Lucide React)
                </label>
                <select
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                >
                  <option value="">-- Sélectionner une icône --</option>
                  <option value="Sparkle">✨ Sparkle</option>
                  <option value="Droplet">💧 Droplet</option>
                  <option value="Wind">🌬️ Wind</option>
                  <option value="Waves">🌊 Waves</option>
                  <option value="Smile">😊 Smile</option>
                  <option value="CircleDot">⚫ CircleDot</option>
                  <option value="Bath">🛁 Bath</option>
                  <option value="Baby">👶 Baby</option>
                  <option value="Milk">🥛 Milk</option>
                  <option value="Heart">❤️ Heart</option>
                  <option value="Tablets">💊 Tablets</option>
                  <option value="Activity">📈 Activity</option>
                  <option value="Zap">⚡ Zap</option>
                  <option value="Moon">🌙 Moon</option>
                  <option value="Bug">🐛 Bug</option>
                  <option value="Umbrella">☂️ Umbrella</option>
                  <option value="Footprints">👣 Footprints</option>
                  <option value="Armchair">🛋️ Armchair</option>
                  <option value="Hand">✋ Hand</option>
                  <option value="Bone">🦴 Bone</option>
                  <option value="Gauge">📊 Gauge</option>
                  <option value="Package">📦 Package</option>
                  <option value="ShoppingBag">🛍️ ShoppingBag</option>
                  <option value="Star">⭐ Star</option>
                  <option value="Truck">🚚 Truck</option>
                  <option value="Shield">🛡️ Shield</option>
                  <option value="Clock">⏰ Clock</option>
                  <option value="Calendar">📅 Calendar</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Choisissez une icône pour identifier visuellement la catégorie
                </p>
                {categoryForm.icon && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-gray-600">Aperçu:</span>
                    <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                      {(() => {
                        const PreviewIcon = getIconComponent(categoryForm.icon);
                        return <PreviewIcon size={18} className="text-sky-700" />;
                      })()}
                    </div>
                    <span className="text-xs text-gray-500">{categoryForm.icon}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ordre d'affichage
                </label>
                <input
                  type="number"
                  value={categoryForm.order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  resetCategoryForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-2"
              >
                <Save size={18} />
                {editingCategory ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sous-catégorie */}
      {showSubcategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSubcategory ? 'Modifier la sous-catégorie' : 'Nouvelle sous-catégorie'}
              </h2>
              <button
                onClick={() => {
                  setShowSubcategoryModal(false);
                  setEditingSubcategory(null);
                  resetSubcategoryForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie parente *
                </label>
                <select
                  value={subcategoryForm.categoryId}
                  onChange={(e) => setSubcategoryForm({ ...subcategoryForm, categoryId: e.target.value })}
                  disabled={!!editingSubcategory}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                  required
                >
                  <option value="">-- Sélectionner une catégorie --</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre *
                </label>
                <input
                  type="text"
                  value={subcategoryForm.title}
                  onChange={(e) => setSubcategoryForm({ ...subcategoryForm, title: e.target.value })}
                  placeholder="Ex: Soins Visage"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icône (nom Lucide React)
                </label>
                <select
                  value={subcategoryForm.icon}
                  onChange={(e) => setSubcategoryForm({ ...subcategoryForm, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                >
                  <option value="">-- Sélectionner une icône --</option>
                  <option value="Sparkle">✨ Sparkle</option>
                  <option value="Droplet">💧 Droplet</option>
                  <option value="Wind">🌬️ Wind</option>
                  <option value="Waves">🌊 Waves</option>
                  <option value="Smile">😊 Smile</option>
                  <option value="CircleDot">⚫ CircleDot</option>
                  <option value="Bath">🛁 Bath</option>
                  <option value="Baby">👶 Baby</option>
                  <option value="Milk">🥛 Milk</option>
                  <option value="Heart">❤️ Heart</option>
                  <option value="Tablets">💊 Tablets</option>
                  <option value="Activity">📈 Activity</option>
                  <option value="Zap">⚡ Zap</option>
                  <option value="Moon">🌙 Moon</option>
                  <option value="Bug">🐛 Bug</option>
                  <option value="Umbrella">☂️ Umbrella</option>
                  <option value="Footprints">👣 Footprints</option>
                  <option value="Armchair">🛋️ Armchair</option>
                  <option value="Hand">✋ Hand</option>
                  <option value="Bone">🦴 Bone</option>
                  <option value="Gauge">📊 Gauge</option>
                  <option value="Package">📦 Package</option>
                  <option value="ShoppingBag">🛍️ ShoppingBag</option>
                  <option value="Star">⭐ Star</option>
                  <option value="Truck">🚚 Truck</option>
                  <option value="Shield">🛡️ Shield</option>
                  <option value="Clock">⏰ Clock</option>
                  <option value="Calendar">📅 Calendar</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Choisissez une icône pour identifier visuellement la sous-catégorie
                </p>
                {subcategoryForm.icon && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-gray-600">Aperçu:</span>
                    <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                      {(() => {
                        const PreviewIcon = getIconComponent(subcategoryForm.icon);
                        return <PreviewIcon size={18} className="text-sky-700" />;
                      })()}
                    </div>
                    <span className="text-xs text-gray-500">{subcategoryForm.icon}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ordre d'affichage
                </label>
                <input
                  type="number"
                  value={subcategoryForm.order}
                  onChange={(e) => setSubcategoryForm({ ...subcategoryForm, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowSubcategoryModal(false);
                  setEditingSubcategory(null);
                  resetSubcategoryForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={editingSubcategory ? handleUpdateSubcategory : handleCreateSubcategory}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-2"
              >
                <Save size={18} />
                {editingSubcategory ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Item */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem ? 'Modifier l\'item' : `Ajouter un item à "${selectedSubcategory?.title}"`}
              </h2>
              <button
                onClick={() => {
                  setShowItemModal(false);
                  setSelectedSubcategory(null);
                  setEditingItem(null);
                  resetItemForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'item *
                </label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="Ex: Nettoyants, Hydratants, Anti-âge"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ordre d'affichage
                </label>
                <input
                  type="number"
                  value={itemForm.order}
                  onChange={(e) => setItemForm({ ...itemForm, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowItemModal(false);
                  setSelectedSubcategory(null);
                  setEditingItem(null);
                  resetItemForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={editingItem ? handleUpdateItem : handleCreateItem}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg flex items-center gap-2"
              >
                <Save size={18} />
                {editingItem ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategories;