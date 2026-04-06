// frontend/src/components/PromotionSlider.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import api from '../api/axios';

const PromotionSlider = () => {
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedOffer, setExpandedOffer] = useState(null);
  const [hoveredOffer, setHoveredOffer] = useState(null);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || document.documentElement.getAttribute('data-theme') === 'dark';
  });

  // Écouter les changements de thème
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkTheme(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchPromotions();
  }, []);

  useEffect(() => {
    if (promotions.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % promotions.length);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [promotions.length]);

 // frontend/src/components/PromotionSlider.jsx
// Modifiez fetchPromotions

const fetchPromotions = async () => {
  try {
    setLoading(true);
    console.log('🔍 Fetching promotions from:', '/promotions/active');
    
    const response = await api.get('/promotions/active');
    console.log('📦 Response status:', response.status);
    console.log('📦 Response data:', response.data);
    console.log('📦 Response data length:', response.data?.length);
    
    setPromotions(response.data);
  } catch (error) {
    console.error('❌ Erreur chargement promotions:');
    console.error('  - Status:', error.response?.status);
    console.error('  - Message:', error.response?.data?.error);
    console.error('  - Full error:', error);
  } finally {
    setLoading(false);
  }
};

  const handleImpression = async (promotionId) => {
    try {
      await api.post(`/promotions/${promotionId}/view`);
    } catch (error) {
      console.error('Erreur enregistrement vue:', error);
    }
  };

  const handleClick = async (promotionId, promo) => {
    try {
      await api.post(`/promotions/${promotionId}/click`);
    } catch (_) {}
    navigate(`/promotion/${promotionId}`);
  };

  const getIconComponent = (iconName) => {
    if (!iconName) return LucideIcons.Tag;
    const Icon = LucideIcons[iconName];
    return Icon || LucideIcons.Tag;
  };

  // Fonction pour déterminer si une couleur est claire ou foncée
  const isLightColor = (color) => {
    if (!color) return false;
    let hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
  };

  // Enregistrer une vue lors de l'affichage de la promotion
  useEffect(() => {
    if (promotions.length > 0 && promotions[currentIndex]) {
      handleImpression(promotions[currentIndex].id);
    }
  }, [currentIndex, promotions]);

  if (loading) {
    return (
      <div className="w-full py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700"></div>
      </div>
    );
  }

  if (promotions.length === 0) {
    return null; // Ne rien afficher si pas de promotions
  }

  const currentPromo = promotions[currentIndex];
  const IconComponent = getIconComponent(currentPromo.iconName);

  return (
    <div className={`promotion-slider-section w-full py-6 md:py-8 ${isDarkTheme ? 'bg-gradient-to-b from-gray-900 to-gray-800' : 'bg-gradient-to-b from-gray-50 to-white'}`}>
      <div className="max-w-7xl mx-auto px-4">
        {/* Titre de section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full mb-4 shadow-sm" style={isDarkTheme ? { background: 'linear-gradient(to right, rgba(249, 115, 22, 0.2), rgba(239, 68, 68, 0.2))' } : { background: 'linear-gradient(to right, #fff7ed, #fef2f2)' }}>
            <LucideIcons.BadgePercent size={20} className={isDarkTheme ? 'text-orange-400' : 'text-orange-600'} />
            <span className={`text-sm font-semibold uppercase tracking-wide ${isDarkTheme ? 'text-orange-300' : 'text-orange-700'}`}>
              Offres du moment
            </span>
            <LucideIcons.Flame size={16} className={isDarkTheme ? 'text-orange-400' : 'text-orange-500'} />
          </div>
          <h2 className={`text-2xl md:text-3xl lg:text-4xl font-bold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
            Ne ratez pas ces
            <span className="relative ml-2">
              <span className="absolute inset-0 blur-lg opacity-50" style={isDarkTheme ? { background: 'linear-gradient(to right, rgba(239, 68, 68, 0.3), rgba(249, 115, 22, 0.3))' } : { background: 'linear-gradient(to right, #fecaca, #fed7aa)' }}></span>
              <span className="relative bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                offres exceptionnelles
              </span>
            </span>
          </h2>
        </div>

        {/* Carrousel */}
        <div className="relative">
          <div className="relative rounded-2xl overflow-hidden shadow-xl">
            <div 
              className="absolute inset-0 opacity-95"
              style={{ backgroundColor: isDarkTheme ? '#1f2937' : '#ffffff' }}
            />
            
            <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 md:p-8 lg:p-10">
              {/* Côté gauche */}
              <div className={`flex flex-col justify-center space-y-4 z-10 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-full w-fit border border-white/20">
                  <IconComponent size={14} className="text-white" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {currentPromo.badge || 'PROMO'}
                  </span>
                </div>

                {/* Titre */}
                <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
                  {currentPromo.title}
                </h3>

                {/* Sous-titre */}
                {currentPromo.subtitle && (
                  <p className={`text-lg md:text-xl font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                    {currentPromo.subtitle}
                  </p>
                )}

                {/* Description produit */}
                {currentPromo.productName && (
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl backdrop-blur-sm flex items-center justify-center ${isDarkTheme ? 'bg-white/20' : 'bg-gray-200'}`}>
                      <LucideIcons.Star size={20} className="text-yellow-400" />
                    </div>
                    <div>
                      <p className={`text-xl font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
                        {currentPromo.productName}
                      </p>
                      {currentPromo.rating && (
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <LucideIcons.Star
                              key={i}
                              size={12}
                              className={i < currentPromo.rating ? 'text-yellow-400 fill-yellow-400' : isDarkTheme ? 'text-white/40' : 'text-gray-400'}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Prix */}
                <div className="flex items-center gap-3 flex-wrap">
                  {currentPromo.price && (
                    <span className={`text-3xl md:text-4xl font-bold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
                      {currentPromo.price} DH
                    </span>
                  )}
                  {currentPromo.oldPrice && (
                    <span className={`text-base line-through ${isDarkTheme ? 'text-white/60' : 'text-gray-400'}`}>
                      {currentPromo.oldPrice} DH
                    </span>
                  )}
                  {currentPromo.discountValue > 0 && (
                    <span className={`px-3 py-1 ${currentPromo.badgeColor || 'bg-red-500'} rounded-full text-sm font-bold shadow-lg text-white`}>
                      -{currentPromo.discountValue}%
                    </span>
                  )}
                </div>

                {/* Stock restant */}
                {currentPromo.stock && currentPromo.stock < 50 && (
                  <div className="flex items-center gap-2">
                    <LucideIcons.AlertCircle size={16} className={isDarkTheme ? 'text-yellow-400' : 'text-yellow-600'} />
                    <span className={`text-sm ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      Plus que {currentPromo.stock} exemplaires
                    </span>
                  </div>
                )}

                {/* Boutons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => handleClick(currentPromo.id, currentPromo)}
                    className={`inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-xl hover:scale-105 transition-all duration-300 shadow-lg ${
                      isDarkTheme 
                        ? 'bg-white text-gray-900 hover:bg-gray-100' 
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {currentPromo.ctaText || 'Profiter maintenant'}
                    <LucideIcons.ChevronRight size={18} />
                  </button>
                  {currentPromo.features && currentPromo.features.length > 0 && (
                    <button
                      onClick={() => setExpandedOffer(expandedOffer === currentPromo.id ? null : currentPromo.id)}
                      className={`inline-flex items-center gap-2 px-6 py-3 backdrop-blur-sm font-medium rounded-xl transition-all duration-300 ${
                        isDarkTheme
                          ? 'bg-white/20 text-white hover:bg-white/30'
                          : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                      }`}
                    >
                      <LucideIcons.Eye size={18} />
                      En savoir plus
                    </button>
                  )}
                </div>

                {/* Section déroulante */}
                {expandedOffer === currentPromo.id && currentPromo.features && currentPromo.features.length > 0 && (
                  <div className={`mt-4 pt-4 border-t ${isDarkTheme ? 'border-white/20' : 'border-gray-300'}`}>
                    <p className={`text-sm font-medium mb-2 ${isDarkTheme ? 'text-white/90' : 'text-gray-700'}`}>Points forts :</p>
                    <div className="flex flex-wrap gap-2">
                      {currentPromo.features.map((feature, idx) => (
                        <span key={idx} className={`px-3 py-1 rounded-full text-xs ${isDarkTheme ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-800'}`}>
                          {feature}
                        </span>
                      ))}
                    </div>
                    <div className={`flex items-center gap-4 mt-3 text-xs ${isDarkTheme ? 'text-white/70' : 'text-gray-600'}`}>
                      <div className="flex items-center gap-1">
                        <LucideIcons.Truck size={12} />
                        <span>Livraison offerte</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <LucideIcons.Shield size={12} />
                        <span>Paiement sécurisé</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Côté droit - Image */}
              <div className="flex items-center justify-center">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => handleClick(currentPromo.id, currentPromo)}
                >
                  <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl scale-75 group-hover:scale-110 transition-transform duration-500" />
                  <img
                    src={currentPromo.bannerImage || currentPromo.productImage || '/images/placeholder.jpg'}
                    alt={currentPromo.title}
                    className="relative w-56 h-56 md:w-72 md:h-72 object-cover rounded-2xl drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => { e.target.src = '/images/placeholder.jpg'; }}
                  />
                  {currentPromo.discountValue > 0 && (
                    <div 
                      className="absolute -top-4 -right-4 w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: currentPromo.badgeColor || '#ef4444' }}
                    >
                      <span className="text-white font-bold text-lg">-{currentPromo.discountValue}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation buttons */}
          {promotions.length > 1 && (
            <>
              <button
                onClick={() => setCurrentIndex((prev) => (prev - 1 + promotions.length) % promotions.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 backdrop-blur-sm rounded-full shadow-lg transition-all z-10"
                style={isDarkTheme ? { backgroundColor: 'rgba(55, 65, 81, 0.9)' } : { backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
              >
                <LucideIcons.ChevronLeft size={22} className={isDarkTheme ? 'text-gray-300' : 'text-gray-700'} />
              </button>
              <button
                onClick={() => setCurrentIndex((prev) => (prev + 1) % promotions.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 backdrop-blur-sm rounded-full shadow-lg transition-all z-10"
                style={isDarkTheme ? { backgroundColor: 'rgba(55, 65, 81, 0.9)' } : { backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
              >
                <LucideIcons.ChevronRight size={22} className={isDarkTheme ? 'text-gray-300' : 'text-gray-700'} />
              </button>
            </>
          )}
        </div>

        {/* Pagination */}
        {promotions.length > 1 && (
          <div className="promotion-slider-pagination flex justify-center gap-2 mt-6">
            {promotions.map((promo, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                onMouseEnter={(e) => {
                  setHoveredOffer(idx);
                  if (idx !== currentIndex && e.target) {
                    e.target.style.width = '1rem';
                    e.target.style.height = '0.5rem';
                  }
                }}
                onMouseLeave={(e) => {
                  setHoveredOffer(null);
                  if (idx !== currentIndex && e.target) {
                    e.target.style.width = '0.5rem';
                    e.target.style.height = '0.5rem';
                  }
                }}
                style={
                  idx === currentIndex
                    ? { width: '2rem', height: '0.625rem', background: 'linear-gradient(to right, #ef4444, #f97316)', borderRadius: '9999px' }
                    : {
                        width: '0.5rem',
                        height: '0.5rem',
                        backgroundColor: isDarkTheme ? '#4b5563' : '#d1d5db',
                        borderRadius: '9999px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }
                }
              >
                {hoveredOffer === idx && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs rounded whitespace-nowrap" style={{ backgroundColor: isDarkTheme ? '#374151' : '#1f2937', color: '#fff' }}>
                    {promo.title}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-in {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PromotionSlider;