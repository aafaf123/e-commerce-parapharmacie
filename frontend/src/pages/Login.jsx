// frontend/src/pages/Login.jsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Mail, Lock,UserCircle,UserRound,LogIn,Key,Fingerprint, Eye, EyeOff, ArrowRight, Shield, User } from 'lucide-react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const Login = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || null

  const onSubmit = async (data) => {
    setApiError('')
    setLoading(true)
    
    const result = await login(data.email, data.password)
    
    if (result.success) {
      const userRole = result.user.role
      const isAdminRole = userRole === 'ADMIN' || userRole === 'CAISSIER' || userRole === 'PREPARATEUR'

      if (redirectTo) {
        // Si un redirect est demandé, vérifier que l'utilisateur a les droits
        if (redirectTo.startsWith('/admin') && !isAdminRole) {
          navigate('/')
        } else {
          navigate(redirectTo)
        }
      } else if (isAdminRole) {
        navigate('/admin/admindashboard')
      } else {
        navigate('/')
      }
    } else {
      setApiError(result.error || 'Email ou mot de passe incorrect')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-sky-700 rounded-full shadow-lg mb-4">
              <Fingerprint size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Connectez-vous</h1>
            <p className="text-gray-500">
              {redirectTo?.startsWith('/admin')
                ? 'Connectez-vous pour accéder à l\'espace administrateur'
                : 'Accédez à votre compte ParaClick'}
            </p>
          </div>

          {redirectTo?.startsWith('/admin') && (
            <div className="mb-5 p-3 bg-sky-50 border border-sky-200 rounded-lg flex items-center gap-2">
              <Shield size={16} className="text-sky-600 flex-shrink-0" />
              <p className="text-sm text-sky-700">Connexion requise pour accéder au tableau de bord administrateur.</p>
            </div>
          )}

          {apiError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="email"
                  placeholder="votre@email.com"
                  {...register('email', {
                    required: 'Email requis',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Email invalide'
                    }
                  })}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${
                    errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'
                  }`}
                />
              </div>
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password', {
                    required: 'Mot de passe requis',
                    minLength: { value: 6, message: 'Minimum 6 caractères' }
                  })}
                  className={`w-full pl-10 pr-12 py-2.5 rounded-lg border-2 transition-colors outline-none ${
                    errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
            </div>

            <div className="text-right">
              <Link to="/forgot-password" className="text-sm text-sky-700 hover:text-sky-800">
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Connexion...</span>
                </>
              ) : (
                <>
                  <ArrowRight size={16} />
                  <span>Se connecter</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 mb-3">Pas encore de compte ?</p>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 w-full py-3 bg-sky-700 hover:bg-sky-800 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
            >
              <UserRound size={20} />
              <span>Créer un compte</span>
              <ArrowRight size={20} />
            </Link>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <User size={14} />
              <span>Connexion client</span>
              <span className="mx-2">•</span>
              <Shield size={14} />
              <span>Connexion admin automatique</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login