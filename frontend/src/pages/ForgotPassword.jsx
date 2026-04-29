import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ForgotPassword = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  const { t } = useTranslation()
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const onSubmit = async (data) => {
    try {
      setApiError('')
      const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      const text = await response.text()
      const result = text ? JSON.parse(text) : {}
      if (!response.ok) { setApiError(result.message || t('forgot_password.error')); return }
      setSuccess(true)
    } catch (error) {
      setApiError(t('common.generic_retry_error'))
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={32} className="text-green-600" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('forgot_password.success_title')}</h2>
            <p className="text-gray-600 mb-6">{t('forgot_password.success_desc')}</p>
            <button onClick={() => navigate('/login')} className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg transition-colors">
              {t('forgot_password.back_login')}
            </button>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('forgot_password.title')}</h1>
            <p className="text-gray-500">{t('forgot_password.subtitle')}</p>
          </div>
          {apiError && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-700">{apiError}</p></div>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
            <button type="submit" disabled={isSubmitting}
              className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-6">
              {isSubmitting ? t('forgot_password.sending') : t('forgot_password.send')}
              <ArrowRight size={16} />
            </button>
          </form>
          <button onClick={() => navigate('/login')}
            className="w-full mt-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
            <ArrowLeft size={16} />
            {t('forgot_password.back_login')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
