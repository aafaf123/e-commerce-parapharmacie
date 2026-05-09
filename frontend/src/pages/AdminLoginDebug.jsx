import { useNavigate } from 'react-router-dom'

const AdminLoginDebug = () => {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Page de debug désactivée.</p>
        <button onClick={() => navigate('/admin/login')} className="px-4 py-2 bg-sky-700 text-white rounded-lg">
          Aller à la connexion
        </button>
      </div>
    </div>
  )
}

export default AdminLoginDebug
