import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Shield, User, UserRound, Fingerprint } from 'lucide-react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthNew } from '../context/AuthContextNew'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID


const Login = () => {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const { login, loginWithGoogle } = useAuthNew()
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || null

  const redirectAfterLogin = useCallback((userData) => {
    const role = userData.role || userData.type
    const isAdminRole = ['ADMIN', 'EMPLOYE', 'CAISSIER', 'PREPARATEUR'].includes(role)
    if (isAdminRole) {
      navigate('/admin/dashboard')
    } else if (redirectTo && !redirectTo.startsWith('/admin')) {
      navigate(redirectTo)
    } else {
      navigate('/')
    }
  }, [navigate, redirectTo])

  // Charger le script Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const existing = document.getElementById('google-gsi-script')
    if (existing) return
    const script = document.createElement('script')
    script.id = 'google-gsi-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    document.body.appendChild(script)
  }, [])

  const handleGoogleLogin = () => {
    if (!window.google) return setApiError('Google non chargé, réessayez dans un instant')
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        setGoogleLoading(true)
        setApiError('')
        const result = await loginWithGoogle(credential)
        if (result.success) redirectAfterLogin(result.user)
        else setApiError(result.error)
        setGoogleLoading(false)
      }
    })
    window.google.accounts.id.prompt()
  }

  const onSubmit = async (data) => {
    setApiError('')
    setLoading(true)
    // Nettoyer l'ancien état avant de se connecter
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    try {
      const loginResult = await login(data.email, data.password)
      if (loginResult.success) {
        redirectAfterLogin(loginResult.user)
      } else if (loginResult.accountDeleted) {
        setApiError('Ce compte a été supprimé définitivement. Vous pouvez créer un nouveau compte.')
      } else {
        setApiError(loginResult.error || 'Email ou mot de passe incorrect')
      }
    } catch {
      setApiError('Erreur de connexion')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4 py-8">
      {/* Bouton Retour à l'accueil */}
      <Link
        to="/"
        className="fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg shadow-md border border-gray-200 transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Retour à l'accueil</span>
      </Link>

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
            {/* Bouton Google */}
            {GOOGLE_CLIENT_ID && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium text-gray-700 disabled:opacity-50"
                >
                  {googleLoading ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {googleLoading ? 'Connexion...' : 'Continuer avec Google'}
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