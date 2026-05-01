import { useNavigate } from 'react-router-dom'
import { Home, RefreshCw, ServerCrash } from 'lucide-react'

export default function ServerError({ onRetry }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <ServerCrash className="w-24 h-24 text-red-500" strokeWidth={1.2} />
        </div>
        <div className="text-7xl font-bold text-red-500 mb-2">500</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-3">Erreur serveur</h1>
        <p className="text-gray-500 mb-8">
          Une erreur inattendue s'est produite. Veuillez réessayer ou revenir à l'accueil.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => onRetry ? onRetry() : window.location.reload()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            <Home className="w-4 h-4" />
            Accueil
          </button>
        </div>
      </div>
    </div>
  )
}
