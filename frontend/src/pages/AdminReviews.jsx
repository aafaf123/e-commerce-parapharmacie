import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Trash2, Check, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import adminApi from '../api/adminAxios';

const AdminReviews = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => { fetchReviews(); }, [filter]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = filter === 'all' ? {} : { approved: filter === 'approved' };
      const { data } = await adminApi.get('/reviews', { params });
      setReviews(data.reviews);
    } catch { console.error('Error fetching reviews'); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id) => {
    try { await adminApi.put(`/reviews/${id}/approve`); fetchReviews(); }
    catch { alert(t('admin_reviews.error_approve')); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('admin_reviews.delete_confirm'))) return;
    try { await adminApi.delete(`/reviews/${id}`); fetchReviews(); }
    catch { alert(t('admin_reviews.error_delete')); }
  };

  const filters = [
    { key: 'pending', label: t('admin_reviews.filter_pending') },
    { key: 'approved', label: t('admin_reviews.filter_approved') },
    { key: 'all', label: t('admin_reviews.filter_all') },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 bg-gray-50 text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-gray-100 flex items-center gap-2 group"
              title={t('admin_reviews.back_dashboard')}
            >
              <ArrowLeft size={20} className={`${isAr ? 'rotate-180' : ''} group-hover:-translate-x-1 transition-transform`} />
              <span className="text-sm font-semibold hidden lg:inline">{t('admin_reviews.back_dashboard')}</span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <h1 className="text-xl font-bold text-gray-900">{t('admin_reviews.title')}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? 'bg-sky-700 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-sky-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{t('admin_reviews.no_reviews')}</div>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-gray-900">{review.name}</span>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                        ))}
                      </div>
                      {review.approved ? (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">{t('admin_reviews.approved_badge')}</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">{t('admin_reviews.pending_badge')}</span>
                      )}
                    </div>
                    <p className="text-sm text-sky-600 mb-2">{t('admin_reviews.product_label')} {review.product?.name}</p>
                    <p className="text-gray-700 text-sm">{review.comment}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(review.createdAt).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!review.approved && (
                      <button onClick={() => handleApprove(review.id)} className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors" title={t('admin_reviews.approve_title')}>
                        <Check size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(review.id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors" title={t('admin_reviews.delete_title')}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReviews;
