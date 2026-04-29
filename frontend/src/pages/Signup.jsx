import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { User, Phone, Mail, Lock, Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const GOOGLE_CLIENT_ID = '1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com'

const Signup = () => {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const { loginWithGoogle } = useAuth()
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const password = watch('password')

  useEffect(() => {
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID') {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => {
        window.google?.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async ({ credential }) => {
            setGoogleLoading(true)
            setApiError('')
            const result = await loginWithGoogle(credential)
            if (result.success) { navigate('/') } else { setApiError(result.error) }
            setGoogleLoading(false)
          },
          auto_select: false,
          itp_support: true
        })
        const googleBtnParent = document.getElementById('googleButton')
        if (googleBtnParent) {
          window.google?.accounts.id.renderButton(googleBtnParent, {
            theme: 'outline', size: 'large',
            width: googleBtnParent.offsetWidth || 400,
            text: 'signup_with', shape: 'rectangular',
          })
        }
      }
      document.body.appendChild(script)
    }
  }, [loginWithGoogle, navigate])

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
      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const text = await response.text()
      const result = text ? JSON.parse(text) : {}
      if (!response.ok) { setApiError(result.message || t('common.generic_retry_error')); return }
      localStorage.setItem('token', result.token)
      localStorage.setItem('user', JSON.stringify(result.user))
      setSuccess(true)
      setTimeout(() => navigate('/'), 2000)
    } catch (error) {
      setApiError(t('common.generic_retry_error'))
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.signup_success')}</h2>
          <p className="text-gray-600">{t('auth.redirecting')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('auth.signup_title')}</h1>
            <p className="text-gray-500">{t('auth.signup_subtitle')}</p>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-4">
              {t('auth.signup_employee_note')}
            </p>
          </div>

          {apiError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID' && (
              <>
                <div className="w-full flex justify-center py-1">
                  <div id="googleButton" className="w-full"></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{t('auth.or_fill_form')}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.firstname')}</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input type="text" placeholder="Jean"
                    {...register('firstName', { required: t('auth.firstname') + ' ' + t('common.error') })}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${errors.firstName ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'}`} />
                </div>
                {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.lastname')}</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input type="text" placeholder="Dupont"
                    {...register('lastName', { required: t('auth.lastname') + ' ' + t('common.error') })}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${errors.lastName ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'}`} />
                </div>
                {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.email')}</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                <input type="email" placeholder={t('auth.email_placeholder')}
                  {...register('email', { required: t('auth.email_required'), pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('auth.email_invalid') } })}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'}`} />
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

            <div className="bg-green-50 p-6 rounded-xl border border-green-100">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <h3 className="font-bold text-green-900">{t('auth.whatsapp_title')}</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-green-800 mb-2">{t('auth.whatsapp_number')}</label>
                  <input type="tel" placeholder="+212 XXX XX XX XX" {...register('whatsapp')}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-green-200 focus:border-green-500 outline-none transition-colors" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex-shrink-0 w-5 h-5">
                    <input type="checkbox" defaultChecked={true} {...register('notificationWhatsApp')}
                      className="peer w-5 h-5 cursor-pointer rounded border-2 border-green-400 bg-white checked:bg-green-600 checked:border-green-600 transition-all outline-none" />
                    <Check className="absolute inset-0 m-auto w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth={3} />
                  </div>
                  <span className="text-sm text-green-700 group-hover:text-green-900 transition-colors">{t('auth.whatsapp_consent')}</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.password')}</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                    {...register('password', { required: t('auth.password_required'), minLength: { value: 8, message: t('auth.password_min8') } })}
                    className={`w-full pl-10 pr-12 py-2.5 rounded-lg border-2 transition-colors outline-none ${errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'}`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.confirm_password')}</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input type={showConfirm ? 'text' : 'password'} placeholder="••••••••"
                    {...register('confirmPassword', { required: t('auth.confirm_required'), validate: (v) => v === password || t('auth.passwords_mismatch') })}
                    className={`w-full pl-10 pr-12 py-2.5 rounded-lg border-2 transition-colors outline-none ${errors.confirmPassword ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'}`} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <button type="submit" disabled={isSubmitting}
              className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-6">
              {isSubmitting ? t('auth.submitting') : t('auth.submit_signup')}
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            {t('auth.already_account')}{' '}
            <a href="/login" className="text-sky-700 font-semibold hover:text-sky-800">{t('nav.login')}</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Signup
