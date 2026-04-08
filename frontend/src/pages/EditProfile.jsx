import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { User, Phone, MapPin, Mail, Bell, Send, Upload, ArrowLeft, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const EditProfile = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm()
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profileImage, setProfileImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [removeImage, setRemoveImage] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      const response = await fetch('http://localhost:5000/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Erreur lors du chargement du profil')
      }

      const data = await response.json()
      reset(data)
      // Toujours synchroniser imagePreview avec la DB (null inclus)
      setImagePreview(data.profileImage || null)
      setRemoveImage(false)
      setProfileImage(null)
      setLoading(false)
    } catch (error) {
      console.error('Fetch profile error:', error)
      setApiError('Erreur lors du chargement du profil')
      setLoading(false)
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfileImage(reader.result)
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const onSubmit = async (data) => {
    try {
      setApiError('')
      setSuccess(false)

      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: data.address,
        notificationEmail: data.notificationEmail === 'on',
        notificationSMS: data.notificationSMS === 'on',
        notificationPush: data.notificationPush === 'on',
        ...(profileImage && { profileImage }),
        ...(removeImage && { profileImage: null }),
      }

      const response = await fetch('http://localhost:5000/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const text = await response.text()
      const result = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setApiError(result.message || 'Erreur lors de la mise à jour')
        return
      }

      setSuccess(true)
      localStorage.setItem('user', JSON.stringify(result.user))
      // Resynchroniser depuis la DB pour confirmer la suppression définitive
      await fetchProfile()
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      setApiError('Erreur serveur. Veuillez réessayer.')
      console.error('Update profile error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center">
        <p className="text-gray-600">Chargement du profil...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sky-700 font-semibold mb-6 hover:text-sky-800"
        >
          <ArrowLeft size={20} />
          Retour
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Modifier mon profil</h1>
            <p className="text-gray-500">Mettez à jour vos informations personnelles</p>
          </div>

          {apiError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">Profil mis à jour avec succès !</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Photo de profil */}
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
                  <button
                    type="button"
                    onClick={() => { setRemoveImage(true); setImagePreview(null); setProfileImage(null) }}
                    className="absolute -bottom-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-colors"
                    title="Supprimer la photo"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <label className="flex items-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg cursor-pointer transition-colors">
                <Upload size={16} />
                Changer la photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { handleImageChange(e); setRemoveImage(false) }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Nom et Prénom */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prénom</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                  <input
                    type="text"
                    disabled
                    placeholder="Jean"
                    {...register('firstName')}
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
                    disabled
                    placeholder="Dupont"
                    {...register('lastName')}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border-2 transition-colors outline-none ${
                      errors.lastName ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400 focus:border-sky-700'
                    }`}
                  />
                </div>
                {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email (lecture seule) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3.5 text-gray-400" strokeWidth={1.8} />
                <input
                  type="email"
                  {...register('email')}
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-gray-300 bg-gray-100 text-gray-600 outline-none"
                />
              </div>
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

            {/* Préférences de notification */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Bell size={20} className="text-sky-700" />
                Préférences de notification
              </h3>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('notificationEmail')}
                    className="w-5 h-5 rounded border-gray-300 text-sky-700 focus:ring-sky-700"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Notifications par email</p>
                    <p className="text-sm text-gray-600">Recevez les mises à jour par email</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('notificationSMS')}
                    className="w-5 h-5 rounded border-gray-300 text-sky-700 focus:ring-sky-700"
                  />
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium text-gray-900">Notifications par SMS</p>
                      <p className="text-sm text-gray-600">Recevez les mises à jour par SMS</p>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('notificationPush')}
                    className="w-5 h-5 rounded border-gray-300 text-sky-700 focus:ring-sky-700"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Notifications push</p>
                    <p className="text-sm text-gray-600">Recevez les notifications en temps réel</p>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-6"
            >
              {isSubmitting ? 'Mise à jour...' : 'Enregistrer les modifications'}
              <Send size={16} />
            </button>

          </form>

        </div>
      </div>
    </div>
  )
}

export default EditProfile
