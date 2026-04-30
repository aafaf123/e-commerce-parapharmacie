// Routes d'authentification sécurisées - Séparation par type d'utilisateur
import express from 'express'
import { 
  ClientAuthService, 
  EmployeeAuthService, 
  AdminAuthService,
  requireClient,
  requireEmployee,
  requireAdmin
} from '../services/secureAuthService.js'

const router = express.Router()

// ==================== ROUTES CLIENT ====================

// POST /api/auth/client/login - Connexion client
router.post('/client/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' })
    }

    const result = await ClientAuthService.login(email, password)
    
    res.json({
      message: 'Connexion réussie',
      ...result
    })
  } catch (error) {
    console.error('Client login error:', error)
    res.status(401).json({ message: error.message })
  }
})

// POST /api/auth/client/register - Inscription client
router.post('/client/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, whatsapp, address } = req.body

    if (!firstName || !lastName || !email || !password || !phone) {
      return res.status(400).json({ message: 'Tous les champs obligatoires sont requis' })
    }

    const result = await ClientAuthService.register({
      firstName, lastName, email, password, phone, whatsapp, address
    })

    res.status(201).json({
      message: 'Inscription réussie',
      ...result
    })
  } catch (error) {
    console.error('Client register error:', error)
    res.status(400).json({ message: error.message })
  }
})

// GET /api/auth/client/profile - Profil client
router.get('/client/profile', requireClient, async (req, res) => {
  try {
    const profile = await ClientAuthService.getProfile(req.userId)
    
    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' })
    }

    res.json(profile)
  } catch (error) {
    console.error('Get client profile error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// ==================== ROUTES EMPLOYÉ ====================

// POST /api/auth/employee/login - Connexion employé
router.post('/employee/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' })
    }

    const result = await EmployeeAuthService.login(email, password)
    
    res.json({
      message: 'Connexion employé réussie',
      ...result
    })
  } catch (error) {
    console.error('Employee login error:', error)
    res.status(401).json({ message: error.message })
  }
})

// GET /api/auth/employee/profile - Profil employé
router.get('/employee/profile', requireEmployee, async (req, res) => {
  try {
    const profile = await EmployeeAuthService.getProfile(req.userId)
    
    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' })
    }

    res.json(profile)
  } catch (error) {
    console.error('Get employee profile error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// ==================== ROUTES ADMIN ====================

// POST /api/auth/admin/login - Connexion admin
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' })
    }

    const ipAddress = req.ip || req.connection.remoteAddress
    const userAgent = req.get('User-Agent')

    const result = await AdminAuthService.login(email, password, ipAddress, userAgent)
    
    res.json({
      message: 'Connexion admin réussie',
      ...result
    })
  } catch (error) {
    console.error('Admin login error:', error)
    res.status(401).json({ message: error.message })
  }
})

// GET /api/auth/admin/profile - Profil admin
router.get('/admin/profile', requireAdmin, async (req, res) => {
  try {
    const profile = await AdminAuthService.getProfile(req.userId)
    
    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' })
    }

    res.json(profile)
  } catch (error) {
    console.error('Get admin profile error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// ==================== ROUTES COMMUNES ====================

// POST /api/auth/logout - Déconnexion (tous types)
router.post('/logout', async (req, res) => {
  try {
    // Ici on pourrait invalider le token côté serveur si on utilisait une blacklist
    res.json({ message: 'Déconnexion réussie' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// GET /api/auth/verify - Vérifier le token (tous types)
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({ valid: false, message: 'Token manquant' })
    }

    const jwt = await import('jsonwebtoken')
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production')
    
    res.json({ 
      valid: true, 
      user: {
        id: decoded.id,
        email: decoded.email,
        type: decoded.type,
        isSuperAdmin: decoded.isSuperAdmin || false
      }
    })
  } catch (error) {
    res.status(401).json({ valid: false, message: 'Token invalide' })
  }
})

export default router