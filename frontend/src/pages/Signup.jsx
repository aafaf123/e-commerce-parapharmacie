import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { User, Phone, MapPin, Mail, Lock, Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ✅ Votre ID client Google configuré
const GOOGLE_CLIENT_ID = '1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com'

const Signup = () => {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const { loginWithGoogle } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const password = watch('password')

  // Vérifier si l'ID client Google est configuré
  useEffect(() => {
    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
      console.warn('⚠️ Google Client ID non configuré. Veuillez le remplacer dans Signup.jsx ligne 7')
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
      navigate('/')
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

  const onSubmit = async (data) => {
    try {
      setApiError('')
      
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        password: data.password,
      }

      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await response.text()
      const result = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setApiError(result.message || 'Erreur lors de l\'inscription')
        return
      }

      // Stocker le token et l'utilisateur
      localStorage.setItem('token', result.token)
      localStorage.setItem('user', JSON.stringify(result.user))
      
      setSuccess(true)
      setTimeout(() => navigate('/'), 2000)
    } catch (error) {
      setApiError('Erreur serveur. Veuillez réessayer.')
      console.error('Signup error:', error)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Inscription réussie !</h2>
          <p className="text-gray-600">Redirection en cours...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Créer un compte</h1>
            <p className="text-gray-500">Rejoignez ParaClick et commencez vos achats</p>
          </div>

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
                  <span>S'inscrire avec Google</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">ou remplir le formulaire</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prénom</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input
                    type="text"
                    placeholder="Jean"
                    {...register('firstName', { required: 'Prénom requis' })}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${
                      errors.firstName ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'
                    }`}
                  />
                </div>
                {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input
                    type="text"
                    placeholder="Dupont"
                    {...register('lastName', { required: 'Nom requis' })}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${
                      errors.lastName ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'
                    }`}
                  />
                </div>
                {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                <input
                  type="email"
                  placeholder="votre@email.com"
                  {...register('email', {
                    required: 'Email requis',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalide' }
                  })}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${
                    errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'
                  }`}
                />
              </div>
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
            </div>

            {/* Téléphone et Adresse */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input
                    type="tel"
                    placeholder="+213 XXX XX XX XX"
                    {...register('phone', { required: 'Téléphone requis' })}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${
                      errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'
                    }`}
                  />
                </div>
                {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input
                    type="text"
                    placeholder="123 Rue de la Paix"
                    {...register('address', { required: 'Adresse requise' })}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${
                      errors.address ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'
                    }`}
                  />
                </div>
                {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address.message}</p>}
              </div>
            </div>

            {/* Mot de passe et Confirmation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('password', {
                      required: 'Mot de passe requis',
                      minLength: { value: 8, message: 'Minimum 8 caractères' }
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('confirmPassword', {
                      required: 'Confirmation requise',
                      validate: (value) => value === password || 'Les mots de passe ne correspondent pas'
                    })}
                    className={`w-full pl-10 pr-12 py-2.5 rounded-lg border-2 transition-colors outline-none ${
                      errors.confirmPassword ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-6"
            >
              {isSubmitting ? 'Inscription...' : 'S\'inscrire'}
              <ArrowRight size={16} />
            </button>

          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Vous avez déjà un compte ?{' '}
            <a href="/login" className="text-sky-700 font-semibold hover:text-sky-800">
              Se connecter
            </a>
          </p>

        </div>
      </div>
    </div>
  )
}

export default Signup