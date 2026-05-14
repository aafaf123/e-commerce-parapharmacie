import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { User, Phone, Mail, Lock, Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthNew } from '../context/AuthContextNew'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

const Signup = () => {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const { loginWithGoogle } = useAuthNew()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)
  const [welcomeBack, setWelcomeBack] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const password = watch('password')

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

  const handleGoogleSignup = () => {
    if (!window.google) return setApiError('Google non chargé, réessayez dans un instant')
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        setGoogleLoading(true)
        setApiError('')
        const result = await loginWithGoogle(credential)
        if (result.success) navigate('/')
        else setApiError(result.error)
        setGoogleLoading(false)
      }
    })
    window.google.accounts.id.prompt()
  }

  const onSubmit = async (data) => {
    try {
      setApiError('')
      
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        whatsapp: data.whatsapp || '',
        notificationWhatsApp: data.whatsapp ? !!data.notificationWhatsApp : false,
      }

      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await response.text()
      const result = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setApiError(result.message || "Erreur lors de l'inscription")
        return
      }

      localStorage.setItem('token', result.token)
      // Fetch profil complet pour avoir phone, whatsapp, authProvider
      try {
        const profileRes = await fetch(`${API_URL}/user/profile`, { headers: { 'Authorization': `Bearer ${result.token}` } })
        if (profileRes.ok) {
          const profile = await profileRes.json()
          localStorage.setItem('user', JSON.stringify({ ...result.user, ...profile }))
        } else {
          localStorage.setItem('user', JSON.stringify(result.user))
        }
      } catch {
        localStorage.setItem('user', JSON.stringify(result.user))
      }
      setWelcomeBack(!!result.welcomeBack)
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
          {welcomeBack ? (
            <>
              <h2 className="text-2xl font-bold text-sky-700 mb-2">Bienvenue à nouveau !</h2>
              <p className="text-gray-600">Votre compte a été recréé avec succès. Redirection...</p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Inscription réussie !</h2>
              <p className="text-gray-600">Redirection en cours...</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Créer un compte client</h1>
            <p className="text-gray-500">Rejoignez ParaClick et commencez vos achats</p>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-4">
              Les comptes employés sont créés uniquement par l’administrateur.
            </p>
          </div>

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
                  onClick={handleGoogleSignup}
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
                  {googleLoading ? 'Connexion...' : "S'inscrire avec Google"}
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

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                <input
                  type="tel"
                  placeholder="+212 XXX XX XX XX"
                  {...register('phone', { required: 'Téléphone requis' })}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${
                    errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'
                  }`}
                />
              </div>
              {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>}
            </div>

            {/* WhatsApp - AJOUTÉ */}
            <div className="bg-green-50 p-6 rounded-xl border border-green-100">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <h3 className="font-bold text-green-900">Notifications WhatsApp</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-green-800 mb-2">Numéro WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="+212 XXX XX XX XX"
                    {...register('whatsapp')}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-green-200 focus:border-green-500 outline-none transition-colors"
                  />
                </div>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      defaultChecked={true}
                      {...register('notificationWhatsApp')}
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-green-300 checked:bg-green-600 checked:border-green-600 transition-all"
                    />
                    <Check className="absolute left-0.5 top-0.5 h-4 w-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={4} />
                  </div>
                  <span className="text-sm text-green-700 group-hover:text-green-900 transition-colors">
                    Je souhaite recevoir le statut de mes commandes et les promotions par WhatsApp
                  </span>
                </label>
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
              {isSubmitting ? 'Inscription...' : 'Créer mon compte client'}
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
