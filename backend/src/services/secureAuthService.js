// Services d'authentification sécurisés - Séparation par type d'utilisateur
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// ==================== SERVICE CLIENT ====================
export class ClientAuthService {
  static async login(email, password) {
    // Recherche UNIQUEMENT dans la table Client
    const client = await prisma.client.findUnique({ 
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        authProvider: true
      }
    })

    if (!client || !client.isActive) {
      throw new Error('Email ou mot de passe incorrect')
    }

    const isPasswordValid = await bcrypt.compare(password, client.password)
    if (!isPasswordValid) {
      throw new Error('Email ou mot de passe incorrect')
    }

    const token = jwt.sign(
      { id: client.id, email: client.email, type: 'CLIENT' },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    return {
      token,
      user: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        type: 'CLIENT',
        authProvider: client.authProvider
      }
    }
  }

  static async register(userData) {
    const { firstName, lastName, email, password, phone, whatsapp, address } = userData

    // Vérifier si l'email existe déjà (dans toutes les tables)
    const [existingClient, existingEmployee, existingAdmin] = await Promise.all([
      prisma.client.findUnique({ where: { email } }),
      prisma.employee.findUnique({ where: { email } }),
      prisma.admin.findUnique({ where: { email } })
    ])

    if (existingClient || existingEmployee || existingAdmin) {
      throw new Error('Cet email est déjà utilisé')
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const client = await prisma.client.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        phone,
        whatsapp: whatsapp || null,
        address: address || null,
        authProvider: 'local'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true
      }
    })

    const token = jwt.sign(
      { id: client.id, email: client.email, type: 'CLIENT' },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    return { token, user: { ...client, type: 'CLIENT' } }
  }

  static async getProfile(clientId) {
    return await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        whatsapp: true,
        profileImage: true,
        notificationEmail: true,
        notificationSMS: true,
        notificationWhatsApp: true,
        notificationPush: true,
        authProvider: true,
        createdAt: true
      }
    })
  }
}

// ==================== SERVICE EMPLOYÉ ====================
export class EmployeeAuthService {
  static async login(email, password) {
    // Recherche UNIQUEMENT dans la table Employee
    const employee = await prisma.employee.findUnique({ 
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        phone: true,
        employeeId: true,
        department: true,
        position: true,
        isActive: true
      }
    })

    if (!employee || !employee.isActive) {
      throw new Error('Email ou mot de passe incorrect')
    }

    const isPasswordValid = await bcrypt.compare(password, employee.password)
    if (!isPasswordValid) {
      throw new Error('Email ou mot de passe incorrect')
    }

    // Charger les permissions
    const permissions = await prisma.employeePermission.findMany({
      where: { employeeId: employee.id }
    })

    const token = jwt.sign(
      { id: employee.id, email: employee.email, type: 'EMPLOYEE' },
      JWT_SECRET,
      { expiresIn: '8h' } // Plus court pour les employés
    )

    return {
      token,
      user: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        employeeId: employee.employeeId,
        department: employee.department,
        position: employee.position,
        type: 'EMPLOYEE',
        permissions
      }
    }
  }

  static async getProfile(employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        employeeId: true,
        department: true,
        position: true,
        hireDate: true,
        createdAt: true
      }
    })

    if (!employee) return null

    const permissions = await prisma.employeePermission.findMany({
      where: { employeeId }
    })

    return { ...employee, permissions }
  }
}

// ==================== SERVICE ADMIN ====================
export class AdminAuthService {
  static async login(email, password, ipAddress, userAgent) {
    // Recherche UNIQUEMENT dans la table Admin
    const admin = await prisma.admin.findUnique({ 
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        phone: true,
        isSuperAdmin: true,
        isActive: true,
        loginAttempts: true,
        lockedUntil: true
      }
    })

    if (!admin || !admin.isActive) {
      throw new Error('Email ou mot de passe incorrect')
    }

    // Vérifier si le compte est verrouillé
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      throw new Error('Compte temporairement verrouillé. Réessayez plus tard.')
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password)
    
    if (!isPasswordValid) {
      // Incrémenter les tentatives de connexion
      const newAttempts = (admin.loginAttempts || 0) + 1
      const updateData = { loginAttempts: newAttempts }
      
      // Verrouiller après 5 tentatives
      if (newAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      }
      
      await prisma.admin.update({
        where: { id: admin.id },
        data: updateData
      })
      
      throw new Error('Email ou mot de passe incorrect')
    }

    // Réinitialiser les tentatives en cas de succès
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date()
      }
    })

    // Log de sécurité
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        userType: 'ADMIN',
        action: 'LOGIN',
        entityType: 'Admin',
        entityId: admin.id,
        ipAddress,
        userAgent,
        description: `Connexion admin: ${admin.email}`
      }
    })

    const token = jwt.sign(
      { id: admin.id, email: admin.email, type: 'ADMIN', isSuperAdmin: admin.isSuperAdmin },
      JWT_SECRET,
      { expiresIn: '4h' } // Plus court pour les admins
    )

    return {
      token,
      user: {
        id: admin.id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        phone: admin.phone,
        type: 'ADMIN',
        isSuperAdmin: admin.isSuperAdmin
      }
    }
  }

  static async getProfile(adminId) {
    return await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isSuperAdmin: true,
        lastLoginAt: true,
        createdAt: true
      }
    })
  }
}

// ==================== MIDDLEWARE D'AUTHENTIFICATION SÉCURISÉ ====================
export const authenticateToken = (allowedTypes = ['CLIENT', 'EMPLOYEE', 'ADMIN']) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization
      const token = authHeader && authHeader.split(' ')[1]

      if (!token) {
        return res.status(401).json({ message: 'Token d\'accès requis' })
      }

      const decoded = jwt.verify(token, JWT_SECRET)
      
      // Vérifier le type d'utilisateur autorisé
      if (!allowedTypes.includes(decoded.type)) {
        return res.status(403).json({ message: 'Accès non autorisé pour ce type d\'utilisateur' })
      }

      // Vérifier que l'utilisateur existe toujours
      let user = null
      switch (decoded.type) {
        case 'CLIENT':
          user = await prisma.client.findUnique({ 
            where: { id: decoded.id },
            select: { id: true, isActive: true }
          })
          break
        case 'EMPLOYEE':
          user = await prisma.employee.findUnique({ 
            where: { id: decoded.id },
            select: { id: true, isActive: true }
          })
          break
        case 'ADMIN':
          user = await prisma.admin.findUnique({ 
            where: { id: decoded.id },
            select: { id: true, isActive: true }
          })
          break
      }

      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Utilisateur non trouvé ou désactivé' })
      }

      req.userId = decoded.id
      req.userType = decoded.type
      req.userEmail = decoded.email
      req.isSuperAdmin = decoded.isSuperAdmin || false
      
      next()
    } catch (error) {
      console.error('Auth middleware error:', error)
      return res.status(401).json({ message: 'Token invalide' })
    }
  }
}

// ==================== MIDDLEWARE SPÉCIFIQUES ====================
export const requireClient = authenticateToken(['CLIENT'])
export const requireEmployee = authenticateToken(['EMPLOYEE'])
export const requireAdmin = authenticateToken(['ADMIN'])
export const requireEmployeeOrAdmin = authenticateToken(['EMPLOYEE', 'ADMIN'])
export const requireSuperAdmin = async (req, res, next) => {
  await authenticateToken(['ADMIN'])(req, res, () => {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ message: 'Accès réservé aux super-administrateurs' })
    }
    next()
  })
}

export default {
  ClientAuthService,
  EmployeeAuthService,
  AdminAuthService,
  authenticateToken,
  requireClient,
  requireEmployee,
  requireAdmin,
  requireEmployeeOrAdmin,
  requireSuperAdmin
}