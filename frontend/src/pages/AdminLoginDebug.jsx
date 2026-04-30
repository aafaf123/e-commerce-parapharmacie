// frontend/src/pages/AdminLoginDebug.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthNew } from '../context/AuthContextNew';

const AdminLoginDebug = () => {
  const navigate = useNavigate();
  const { adminLogin, user, isAuthenticated, loading } = useAuthNew();
  const [email, setEmail] = useState('admin@parapharmacie.ma');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [debug, setDebug] = useState('');

  useEffect(() => {
    console.log('🔍 Debug Info:');
    console.log('User:', user);
    console.log('IsAuthenticated:', isAuthenticated);
    console.log('Loading:', loading);
    console.log('Token:', localStorage.getItem('token'));
    console.log('LocalStorage User:', localStorage.getItem('user'));
    
    setDebug(`
User: ${JSON.stringify(user, null, 2)}
IsAuthenticated: ${isAuthenticated}
Loading: ${loading}
Token: ${localStorage.getItem('token')}
LocalStorage User: ${localStorage.getItem('user')}
    `);
  }, [user, isAuthenticated, loading]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    console.log('🔐 Tentative de connexion...');
    console.log('Email:', email);
    console.log('Password:', password);
    
    const result = await adminLogin(email, password);
    
    console.log('📊 Résultat:', result);
    
    if (result.success) {
      console.log('✅ Connexion réussie!');
      console.log('User:', result.user);
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 1000);
    } else {
      console.log('❌ Erreur:', result.error);
      setError(result.error || 'Erreur de connexion');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🔧 Admin Login Debug</h1>
      
      <form onSubmit={handleLogin} style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label>Email: </label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '300px', padding: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>Password: </label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '300px', padding: '5px' }}
          />
        </div>
        
        <button type="submit" style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Se connecter
        </button>
      </form>

      {error && (
        <div style={{ color: 'red', marginBottom: '20px', padding: '10px', border: '1px solid red' }}>
          ❌ Erreur: {error}
        </div>
      )}

      <div style={{ 
        backgroundColor: '#f0f0f0', 
        padding: '15px', 
        borderRadius: '5px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all'
      }}>
        <h3>📋 État actuel:</h3>
        {debug}
      </div>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#e8f4f8' }}>
        <h3>🔍 Vérifications:</h3>
        <ul>
          <li>Backend URL: http://localhost:5000</li>
          <li>Frontend URL: http://localhost:3000</li>
          <li>Token stocké: {localStorage.getItem('token') ? '✅ Oui' : '❌ Non'}</li>
          <li>User stocké: {localStorage.getItem('user') ? '✅ Oui' : '❌ Non'}</li>
          <li>Authentifié: {isAuthenticated ? '✅ Oui' : '❌ Non'}</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminLoginDebug;
