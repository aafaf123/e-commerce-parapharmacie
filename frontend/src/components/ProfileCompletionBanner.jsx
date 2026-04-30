import { useState } from 'react'
import { X, Phone, AlertCircle } from 'lucide-react'
import { useAuth } from '../stores'

const ProfileCompletionBanner = ({ onOpenModal }) => {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  // Ne pas afficher si l'utilisateur a un téléphone ou si la bannière est fermée
  if (!user || user.phone || dismissed) {
    return null
  }

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-amber-400 mr-3" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Profil incomplet
            </p>
            <p className="text-sm text-amber-700">
              Ajoutez votre numéro de téléphone pour recevoir les notifications importantes sur vos commandes.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenModal}
            className="bg-amber-600 text-white px-3 py-1 rounded text-sm hover:bg-amber-700 flex items-center"
          >
            <Phone className="w-4 h-4 mr-1" />
            Compléter
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-400 hover:text-amber-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfileCompletionBanner