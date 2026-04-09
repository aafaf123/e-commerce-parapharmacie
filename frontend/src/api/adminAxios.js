// frontend/src/api/adminAxios.js
import axios from 'axios';

const adminApi = axios.create({
  baseURL: 'http://localhost:5000/api/admin',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour ajouter automatiquement le token
adminApi.interceptors.request.use(
  (config) => {
    // Utiliser le token normal d'abord (connexion unique)
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Fallback pour compatibilité avec l'ancien système
      const adminToken = localStorage.getItem('adminToken');
      if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur pour gérer les erreurs
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 || error.response?.status === 401) {
      // ADMIN routes seulement: clear admin tokens UNIQUEMENT
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      
      // Refresh AuthContext pour revalider le token user normal
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default adminApi;