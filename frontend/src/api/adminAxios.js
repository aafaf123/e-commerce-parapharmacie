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

// Flag pour éviter les redirections répétées
let isRedirecting = false;

// Intercepteur pour gérer les erreurs
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if ((error.response?.status === 403 || error.response?.status === 401) && !isRedirecting) {
      // Pour les employés, ne pas rediriger automatiquement en cas de 403
      // Ils peuvent avoir accès limité à certaines données
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.role === 'EMPLOYE') {
            // Pour les employés, laisser l'application gérer l'erreur au lieu de rediriger
            return Promise.reject(error);
          }
        } catch (e) {
          // Si erreur parsing, continuer avec la logique normale
        }
      }
      
      isRedirecting = true;
      // Nettoyer le localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      // Rediriger en douceur pour éviter les redirections rapides
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      // Réinitialiser le flag après une courte attente
      setTimeout(() => { isRedirecting = false; }, 1000);
    }
    return Promise.reject(error);
  }
);

export default adminApi;