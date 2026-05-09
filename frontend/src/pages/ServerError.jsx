const ServerError = ({ onRetry }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Une erreur est survenue</h1>
      <p className="text-gray-600 mb-6">Quelque chose s'est mal passé. Veuillez réessayer.</p>
      {onRetry && (
        <button onClick={onRetry} className="px-6 py-3 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg">
          Réessayer
        </button>
      )}
    </div>
  </div>
)

export default ServerError
