import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendWhatsAppOrderNotification } from '../services/whatsappService.js';
import { sendAccountDeletionCode } from '../services/emailService.js';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });

    // Check if email was permanently deleted
    const deleted = await prisma.deletedAccount.findUnique({ where: { email } });
    if (deleted) {
      return res.status(403).json({
        message: 'Ce compte a été supprimé définitivement. Vous pouvez créer un nouveau compte.',
        accountDeleted: true
      });
    }

    // Try Client first, then Employee, then Admin
    let user = await prisma.client.findUnique({ where: { email } });
    let role = 'CLIENT';

    if (!user) {
      user = await prisma.employee.findUnique({ where: { email } });
      role = user ? 'EMPLOYE' : null;
    }
    if (!user) {
      user = await prisma.admin.findUnique({ where: { email } });
      role = user ? 'ADMIN' : null;
    }

    if (!user) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

    if (!user.isActive) return res.status(403).json({ message: 'Compte désactivé' });

    const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Connexion réussie',
      token,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, whatsapp, notificationWhatsApp, role } = req.body;

    if (!firstName || !lastName || !email || !password || !phone) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    if (role && role !== 'CLIENT') {
      return res.status(403).json({ message: "Les comptes employés sont créés uniquement par l'administrateur" });
    }

    // Check if email was previously deleted → welcome back message
    const deleted = await prisma.deletedAccount.findUnique({ where: { email } });
    const isReturning = !!deleted;

    // Check if email already in use
    const existing = await prisma.client.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Cet email est déjà utilisé' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const client = await prisma.client.create({
      data: {
        firstName, lastName, email,
        password: hashedPassword,
        phone,
        whatsapp: whatsapp || null,
        notificationWhatsApp: whatsapp ? !!notificationWhatsApp : false,
      }
    });

    // If returning user, remove from deleted list
    if (isReturning) {
      await prisma.deletedAccount.delete({ where: { email } });
    }

    if (client.whatsapp && client.notificationWhatsApp) {
      sendWhatsAppOrderNotification(client.whatsapp, { user: client, orderNumber: '' }, 'WELCOME').catch(() => {});
    }

    const token = jwt.sign({ id: client.id, email: client.email, role: 'CLIENT' }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: isReturning ? 'Bienvenue à nouveau !' : 'Inscription réussie',
      welcomeBack: isReturning,
      token,
      user: { id: client.id, firstName: client.firstName, lastName: client.lastName, email: client.email, role: 'CLIENT' }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email requis' });

    const client = await prisma.client.findUnique({ where: { email } });
    if (!client) return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    await prisma.client.update({ where: { id: client.id }, data: { resetToken, resetTokenExpiry } });

    res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: 'Token et nouveau mot de passe requis' });

    const client = await prisma.client.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } }
    });

    if (!client) return res.status(400).json({ message: 'Token invalide ou expiré' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.client.update({
      where: { id: client.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null }
    });

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/auth/delete-account-request
router.post('/delete-account-request', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });

    const client = await prisma.client.findUnique({ where: { email } });
    if (!client) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const isPasswordValid = await bcrypt.compare(password, client.password);
    if (!isPasswordValid) return res.status(401).json({ message: 'Mot de passe incorrect' });

    const deleteCode = Math.floor(100000 + Math.random() * 900000).toString();
    const deleteCodeExpiry = new Date(Date.now() + 600000);

    await prisma.client.update({ where: { id: client.id }, data: { deleteCode, deleteCodeExpiry } });

    const userName = `${client.firstName} ${client.lastName}`.trim() || 'Client';
    const emailSent = await sendAccountDeletionCode(client.email, userName, deleteCode);

    if (!emailSent) return res.status(500).json({ message: "Erreur lors de l'envoi de l'email" });

    res.json({ message: 'Code de vérification envoyé par email' });
  } catch (error) {
    console.error('Delete account request error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/auth/delete-account-confirm
router.post('/delete-account-confirm', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Email et code requis' });

    const client = await prisma.client.findFirst({
      where: { email, deleteCode: code, deleteCodeExpiry: { gt: new Date() } }
    });

    if (!client) return res.status(400).json({ message: 'Code invalide ou expiré' });

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { order: { clientId: client.id } } });
      await tx.order.deleteMany({ where: { clientId: client.id } });
      await tx.favorite.deleteMany({ where: { clientId: client.id } });
      await tx.notification.deleteMany({ where: { clientId: client.id } });
      await tx.review.deleteMany({ where: { clientId: client.id } });
      await tx.searchHistory.deleteMany({ where: { clientId: client.id } });
      await tx.client.delete({ where: { id: client.id } });
      // Record deleted email so we can inform on future login/signup
      await tx.deletedAccount.upsert({
        where: { email },
        update: { deletedAt: new Date() },
        create: { email, deletedAt: new Date() }
      });
    });

    res.json({ message: 'Compte supprimé définitivement' });
  } catch (error) {
    console.error('Delete account confirm error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
