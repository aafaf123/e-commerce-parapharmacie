import { useState } from 'react'
import { X, Phone, MessageCircle, Mail, Bell } from 'lucide-react'

const PhoneRequiredModal = ({ isOpen, onClose, onSubmit, user }) => {
  const [formData, setFormData] = useState({
    phone: '',
    whatsapp: '',
    notificationEmail: true,
    notificationSMS: false,
    notificationWhatsApp: false,
    notificationPush: true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.phone.trim()) {
      setError('Le numéro de téléphone est obligatoire')
      return
    }

    if (formData.whatsapp && !/^\+?[0-9]{8,15}$/.test(formData.whatsapp.replace(/[\s\-\(\)]/g, ''))) {
      setError('Format WhatsApp invalide (8-15 chiffres, ex: +212612345678)')
      return
    }

    if (!/^\+?[0-9]{8,15}$/.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      setError('Format téléphone invalide (8-15 chiffres, ex: +212612345678)')
      return
    }

    setLoading(true)
    try {
      await onSubmit(formData)
    } catch (err) {
      setError(err.message || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Complétez votre profil
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Bonjour {user?.firstName} !</strong><br />
              Pour finaliser votre inscription et recevoir les notifications importantes, 
              veuillez renseigner votre numéro de téléphone.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Téléphone obligatoire */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4 inline mr-1" />
                Numéro de téléphone *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+212612345678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Format international recommandé (ex: +212612345678)
              </p>
            </div>

            {/* WhatsApp optionnel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MessageCircle className="w-4 h-4 inline mr-1" />
                WhatsApp (optionnel)
              </label>
              <input
                type="tel"
                value={formData.whatsapp}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                placeholder="+212612345678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Laissez vide si vous n'avez pas WhatsApp
              </p>
            </div>

            {/* Préférences de notifications */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Bell className="w-4 h-4 mr-1" />
                Préférences de notifications
              </h3>
              
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notificationEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, notificationEmail: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Mail className="w-4 h-4 ml-2 mr-1 text-gray-500" />
                  <span className="text-sm text-gray-700">Notifications par email</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notificationSMS}
                    onChange={(e) => setFormData(prev => ({ ...prev, notificationSMS: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Phone className="w-4 h-4 ml-2 mr-1 text-gray-500" />
                  <span className="text-sm text-gray-700">Notifications par SMS</span>
                </label>

                {formData.whatsapp && (
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.notificationWhatsApp}
                      onChange={(e) => setFormData(prev => ({ ...prev, notificationWhatsApp: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <MessageCircle className="w-4 h-4 ml-2 mr-1 text-gray-500" />
                    <span className="text-sm text-gray-700">Notifications WhatsApp</span>
                  </label>
                )}

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notificationPush}
                    onChange={(e) => setFormData(prev => ({ ...prev, notificationPush: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled
                  />
                  <Bell className="w-4 h-4 ml-2 mr-1 text-gray-400" />
                  <span className="text-sm text-gray-500">Notifications du site (obligatoire)</span>
                </label>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Les notifications du site sont obligatoires pour le suivi de vos commandes
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Plus tard
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default PhoneRequiredModal