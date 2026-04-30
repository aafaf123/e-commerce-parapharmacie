import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Shield, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../stores';
import { adminLoginSchema } from '../lib/validationSchemas';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(adminLoginSchema)
  });
  const [apiError, setApiError] = useState('');
  const { adminLogin } = useAuth();

  const onSubmit = async (data) => {
    try {
      setApiError('');

      const result = await adminLogin(data.email, data.password);
      
      if (!result.success) {
        throw new Error(result.error || 'Erreur de connexion');
      }

      if (result.user?.role === 'EMPLOYE') {
        navigate('/admin/employee');
      } else {
        navigate('/admin/dashboard');
      }
    } catch (err) {
      setApiError(err.message || 'Erreur de connexion');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
            <Shield size={40} className="text-sky-700" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Espace Administrateur</h1>
          <p className="text-sky-100">Connexion sécurisée</p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {apiError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email administrateur
              </label>
              <div className="relative">
                <Mail size={20} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="email"
                  {...register('email')}
                  placeholder="admin@parapharmacie.ma"
                  className={`w-full pl-11 pr-4 py-3 border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-sky-700'
                  }`}
                />
              </div>
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock size={20} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="password"
                  {...register('password')}
                  placeholder="••••••••"
                  className={`w-full pl-11 pr-4 py-3 border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-sky-700'
                  }`}
                />
              </div>
              {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
            </div>

            {/* Bouton de connexion */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Connexion...</span>
                </>
              ) : (
                <>
                  <Shield size={20} />
                  <span>Se connecter</span>
                </>
              )}
            </button>
          </form>

          {/* Retour */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Retour au site
            </button>
          </div>
        </div>

        {/* Info sécurité */}
        <div className="mt-6 text-center text-sky-100 text-sm">
          <p>🔒 Connexion sécurisée par SSL</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
