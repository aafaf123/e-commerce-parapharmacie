import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Eye, Check, X, ArrowLeft, Search, Filter } from 'lucide-react';
import adminApi from '../api/adminAxios';
import ProtectedRoute from '../components/ProtectedRoute';
import PermissionButton from '../components/PermissionButton';

const AdminReviews = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, approved
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchReviews();
  }, [filter, currentPage, searchTerm]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 20
      };
      
      if (filter !== 'all') {
        params.approved = filter === 'approved';
      }

      const { data } = await adminApi.get('/reviews', { params });
      setReviews(data.reviews || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Erreur lors du chargement des avis:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReview = async (reviewId) => {
    try {
      await adminApi.put(`/reviews/${reviewId}/approve`);
      fetchReviews();
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error);
      alert('Erreur lors de l\'approbation de l\'avis');
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet avis ?')) return;
    
    try {
      await adminApi.delete(`/reviews/${reviewId}`);
      fetchReviews();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression de l\'avis');
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        className={i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}
      />
    ));
  };

  const filteredReviews = reviews.filter(review => {
    if (!searchTerm) return true;
    return (
      review.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.comment?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des avis...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute module="reviews">
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-semibold hidden lg:inline">Dashboard</span>
              </button>
              <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestion des Avis</h1>
                <p className="text-gray-600">Modération des avis clients</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Filtres */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par produit, client ou commentaire..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'pending'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  En attente
                </button>
                <button
                  onClick={() => setFilter('approved')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'approved'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Approuvés
                </button>
              </div>
            </div>
          </div>

          {/* Liste des avis */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            {filteredReviews.length === 0 ? (
              <div className="text-center py-12">
                <Star className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun avis</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filter === 'all' ? 'Aucun avis trouvé.' : `Aucun avis ${filter === 'pending' ? 'en attente' : 'approuvé'}.`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredReviews.map((review) => (
                  <div key={review.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          {review.product?.image && (
                            <img
                              src={review.product.image}
                              alt={review.product.name}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          )}
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {review.product?.name || 'Produit supprimé'}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Par {review.user?.firstName} {review.user?.lastName}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          {renderStars(review.rating)}
                          <span className="text-sm text-gray-600">({review.rating}/5)</span>
                        </div>

                        {review.comment && (
                          <p className="text-gray-700 mb-3">{review.comment}</p>
                        )}

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{new Date(review.createdAt).toLocaleDateString('fr-FR')}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            review.approved
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {review.approved ? 'Approuvé' : 'En attente'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {!review.approved && (
                          <PermissionButton
                            module="reviews"
                            action="canEdit"
                            onClick={() => handleApproveReview(review.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Approuver"
                          >
                            <Check size={16} />
                          </PermissionButton>
                        )}
                        
                        <PermissionButton
                          module="reviews"
                          action="canDelete"
                          onClick={() => handleDeleteReview(review.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Supprimer"
                        >
                          <X size={16} />
                        </PermissionButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-6 py-3 rounded-lg shadow-sm mt-6">
              <div className="text-sm text-gray-700">
                Affichage de {((pagination.page - 1) * pagination.limit) + 1} à{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} sur{' '}
                {pagination.total} avis
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Précédent
                </button>
                <span className="text-sm text-gray-700">
                  Page {pagination.page} sur {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default AdminReviews;