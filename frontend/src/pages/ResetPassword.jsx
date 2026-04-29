import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Lock, Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const ResetPassword = () => {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)
  const [tokenError, setTokenError] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const password = watch('password')

  useEffect(() => { if (!token) setTokenError(true) }, [token])

  const onSubmit = async (data) => {
    try {
      setApiError('')
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      })
      const text = await response.text()
      const result = text ? JSON.parse(text) : {}
      if (!response.ok) { setApiError(result.message || t('common.generic_retry_error')); return }
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (error) {
      setApiError(t('common.generic_retry_error'))
    }
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={32} className="text-red-600" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('reset_password.invalid_link')}</h2>
            <p className="text-gray-600 mb-6">{t('reset_password.invalid_desc')}</p>
            <button onClick={() => navigate('/forgot-password')} className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors">
              {t('reset_password.request_new')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-600" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('reset_password.success_title')}</h2>
            <p className="text-gray-600">{t('reset_password.success_desc')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('reset_password.title')}</h1>
            <p className="text-gray-500">{t('reset_password.subtitle')}</p>
          </div>
          {apiError && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-700">{apiError}</p></div>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('reset_password.new_password')}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('reset_password.confirm_password')}</label>
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
            <button type="submit" disabled={isSubmitting}
              className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-6">
              {isSubmitting ? t('reset_password.submitting') : t('reset_password.submit')}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
