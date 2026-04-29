import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { User, Phone, MapPin, Mail, Bell, Send, Upload, ArrowLeft, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const EditProfile = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm()
  const { t } = useTranslation()
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profileImage, setProfileImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [removeImage, setRemoveImage] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) { navigate('/login'); return }
      const response = await fetch('http://localhost:5000/api/user/profile', { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error()
      const data = await response.json()
      reset(data)
      setImagePreview(data.profileImage || null)
      setRemoveImage(false)
      setProfileImage(null)
      setLoading(false)
    } catch (error) {
      setApiError(t('profile.error_load'))
      setLoading(false)
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => { setProfileImage(reader.result); setImagePreview(reader.result) }
      reader.readAsDataURL(file)
    }
  }

  const onSubmit = async (data) => {
    try {
      setApiError(''); setSuccess(false)
      const token = localStorage.getItem('token')
      if (!token) { navigate('/login'); return }
      const payload = {
        firstName: data.firstName, lastName: data.lastName, phone: data.phone,
        whatsapp: data.whatsapp, address: data.address,
        notificationEmail: data.notificationEmail === 'on' || data.notificationEmail === true,
        notificationSMS: data.notificationSMS === 'on' || data.notificationSMS === true,
        notificationWhatsApp: data.notificationWhatsApp === 'on' || data.notificationWhatsApp === true,
        notificationPush: data.notificationPush === 'on' || data.notificationPush === true,
        ...(profileImage && { profileImage }),
        ...(removeImage && { profileImage: null }),
      }
      const response = await fetch('http://localhost:5000/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const text = await response.text()
      const result = text ? JSON.parse(text) : {}
      if (!response.ok) { setApiError(result.message || t('profile.error_save')); return }
      setSuccess(true)
      localStorage.setItem('user', JSON.stringify(result.user))
      await fetchProfile()
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      setApiError(t('common.generic_retry_error'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center">
        <p className="text-gray-600">{t('profile.loading')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sky-700 font-semibold mb-6 hover:text-sky-800">
          <ArrowLeft size={20} />{t('profile.back')}
        </button>
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('profile.title')}</h1>
            <p className="text-gray-500">{t('profile.subtitle')}</p>
          </div>
          {apiError && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-700">{apiError}</p></div>}
          {success && <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg"><p className="text-sm text-green-700">{t('profile.success')}</p></div>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 mb-4">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {imagePreview && !removeImage ? (
                    <img src={imagePreview} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="text-gray-400" />
                  )}
                </div>
                {imagePreview && !removeImage && (
                  <button type="button" onClick={() => { setRemoveImage(true); setImagePreview(null); setProfileImage(null) }}
                    className="absolute -bottom-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <label className="flex items-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg cursor-pointer transition-colors">
                <Upload size={16} />{t('profile.change_photo')}
                <input type="file" accept="image/*" onChange={(e) => { handleImageChange(e); setRemoveImage(false) }} className="hidden" />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.firstname')}</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input type="text" disabled {...register('firstName')}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-gray-300 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.lastname')}</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input type="text" disabled {...register('lastName')}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-gray-300 outline-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.email')}</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                <input type="email" {...register('email')} disabled
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-gray-300 bg-gray-100 text-gray-600 outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.phone')}</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input type="tel" placeholder="+212 XXX XX XX XX"
                    {...register('phone', { required: t('profile.phone') })}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'}`} />
                </div>
                {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.whatsapp')}</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-3.5 text-green-500" strokeWidth={1.8} />
                  <input type="tel" placeholder="+212 XXX XX XX XX" {...register('whatsapp')}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-gray-300 hover:border-gray-400 focus:border-sky-700 outline-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.address')}</label>
              <div className="relative">
                <MapPin size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                <input type="text" placeholder="123 Rue..."
                  {...register('address', { required: t('profile.address') })}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${errors.address ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'}`} />
              </div>
              {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address.message}</p>}
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Bell size={20} className="text-sky-700" />{t('profile.notifications_title')}
              </h3>
              <div className="space-y-3">
                {[
                  { key: 'notificationEmail', label: t('profile.notif_email'), desc: t('profile.notif_email_desc') },
                  { key: 'notificationSMS', label: t('profile.notif_sms'), desc: t('profile.notif_sms_desc') },
                  { key: 'notificationWhatsApp', label: t('profile.notif_whatsapp'), desc: t('profile.notif_whatsapp_desc') },
                  { key: 'notificationPush', label: t('profile.notif_push'), desc: t('profile.notif_push_desc') },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" {...register(key)}
                      className="w-5 h-5 rounded border-2 border-gray-300 text-sky-700 accent-sky-700 cursor-pointer" />
                    <div>
                      <p className="font-medium text-gray-900">{label}</p>
                      <p className="text-sm text-gray-600">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" disabled={isSubmitting}
              className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-6">
              {isSubmitting ? t('profile.saving') : t('profile.save')}
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EditProfile
