// frontend/src/pages/AdminSubcategories.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Edit, Trash2, Save, X, FolderTree, 
  ChevronDown, ChevronRight, Tag, Layers, AlertCircle,
  // Import de toutes les icônes possibles pour les sous-catégories
  Sparkle, Droplet, Wind, Waves, Smile, CircleDot, Bath, 
  Baby, Milk, Heart, Tablets, Activity, Zap, Moon, Bug, 
  Umbrella, Footprints, Armchair, Hand, Bone, Gauge,
  Package, ShoppingBag, Star, Truck, Shield, Clock, Calendar,
  Users, Settings, Bell, Search, Home, Menu, XCircle, CheckCircle
} from 'lucide-react';
import axios from '../api/axios';
import adminApi from '../api/adminAxios';

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
  XCircle: XCircle,
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

const AdminSubcategories = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // États pour les modales
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [expandedSubcategories, setExpandedSubcategories] = useState({});
  
  // Formulaires
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
      const { data } = await axios.get('/categories');
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

  const handleCreateSubcategory = async () => {
    if (!subcategoryForm.title || !subcategoryForm.categoryId) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      await adminApi.post('/categories/subcategories', subcategoryForm);
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
      await adminApi.put(`/categories/subcategories/${editingSubcategory.id}`, {
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
      await adminApi.delete(`/categories/subcategories/${subcategory.id}`);
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
      await adminApi.post(`/categories/subcategories/${selectedSubcategory.id}/items`, itemForm);
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
      await adminApi.put(`/categories/items/${editingItem.id}`, {
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
      await adminApi.delete(`/categories/items/${item.id}`);
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
                <h1 className="text-2xl font-bold text-gray-900">Gestion des Sous-catégories</h1>
                <p className="text-sm text-gray-600">
                  {subcategories.length} sous-catégorie(s) au total
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                resetSubcategoryForm();
                setEditingSubcategory(null);
                setShowSubcategoryModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors"
            >
              <Plus size={18} />
              Nouvelle sous-catégorie
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
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

        {/* Liste des sous-catégories */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-200">
            {subcategories.length === 0 ? (
              <div className="p-12 text-center">
                <FolderTree size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Aucune sous-catégorie</p>
                <button
                  onClick={() => setShowSubcategoryModal(true)}
                  className="mt-4 text-sky-700 hover:text-sky-800 font-medium"
                >
                  Créer une sous-catégorie
                </button>
              </div>
            ) : (
              subcategories.map((subcategory) => {
                const IconComponent = getIconComponent(subcategory.icon);
                return (
                  <div key={subcategory.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => toggleExpand(subcategory.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {expandedSubcategories[subcategory.id] ? (
                            <ChevronDown size={18} className="text-gray-500" />
                          ) : (
                            <ChevronRight size={18} className="text-gray-500" />
                          )}
                        </button>
                        
                        {/* Affichage de l'icône avec le composant Lucide */}
                        <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                          <IconComponent size={20} className="text-sky-700" />
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-gray-900">{subcategory.title}</h3>
                          <p className="text-sm text-gray-500">
                            Catégorie: {getCategoryName(subcategory.categoryId)} • 
                            Ordre: {subcategory.order} • 
                            {subcategory.items?.length || 0} item(s)
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedSubcategory(subcategory);
                            resetItemForm();
                            setEditingItem(null);
                            setShowItemModal(true);
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Ajouter un item"
                        >
                          <Plus size={18} />
                        </button>
                        
                        <button
                          onClick={() => openEditSubcategoryModal(subcategory)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit size={18} />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteSubcategory(subcategory)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Items de la sous-catégorie */}
                    {expandedSubcategories[subcategory.id] && subcategory.items && subcategory.items.length > 0 && (
                      <div className="ml-12 mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
                        {subcategory.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Tag size={14} className="text-gray-400" />
                              <span className="text-sm text-gray-700">{item.name}</span>
                              <span className="text-xs text-gray-400">(ordre: {item.order})</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditItemModal(item)}
                                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal Sous-catégorie */}
      {showSubcategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
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
          <div className="bg-white rounded-lg max-w-md w-full">
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

export default AdminSubcategories;