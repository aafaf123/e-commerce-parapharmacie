import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, User, UserRound, Fingerprint } from 'lucide-react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ⚠️ IMPORTANT : Remplacez 'YOUR_GOOGLE_CLIENT_ID' par votre vrai ID client Google
// Ou mieux : utilisez une variable d'environnement comme ci-dessous
const GOOGLE_CLIENT_ID = '1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com'


const Login = () => {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const { login, loginWithGoogle } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || null

  // Vérifier si l'ID client Google est configuré
  useEffect(() => {
    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
      console.warn('⚠️ Google Client ID non configuré. Veuillez le remplacer dans Login.jsx ligne 8')
    }
  }, [])

  // Charger le script Google Identity Services
  useEffect(() => {
    // Ne charger le script que si l'ID client est valide
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID') {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => {
        window.google?.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        })
      }
      document.body.appendChild(script)
      return () => document.body.removeChild(script)
    }
  }, [])

  const handleGoogleCallback = async ({ credential }) => {
    setGoogleLoading(true)
    setApiError('')
    const result = await loginWithGoogle(credential)
    if (result.success) {
      redirectAfterLogin(result.user)
    } else {
      setApiError(result.error)
    }
    setGoogleLoading(false)
  }

  const handleGoogleClick = () => {
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID') {
      window.google?.accounts.id.prompt()
    } else {
      setApiError('Configuration Google en cours. Veuillez réessayer dans quelques instants.')
    }
  }

  const redirectAfterLogin = (userData) => {
    const isAdminRole = ['ADMIN', 'CAISSIER', 'PREPARATEUR'].includes(userData.role)
    if (redirectTo) {
      navigate(redirectTo.startsWith('/admin') && !isAdminRole ? '/' : redirectTo)
    } else if (isAdminRole) {
      navigate('/admin/admindashboard')
    } else {
      navigate('/')
    }
  }

  const onSubmit = async (data) => {
    setApiError('')
    setLoading(true)
    
    const result = await login(data.email, data.password)
    
    if (result.success) {
      redirectAfterLogin(result.user)
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
            {/* Bouton Google - visible seulement si ID client configuré */}
            {GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID' && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-lg transition-colors font-medium text-gray-700 disabled:opacity-50"
                >
                  {googleLoading ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                  )}
                  <span>Continuer avec Google</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">ou</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              </>
            )}

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