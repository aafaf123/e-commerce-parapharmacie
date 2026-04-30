import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendWhatsAppOrderNotification } from '../services/whatsappService.js';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// POST /api/auth/login - Connexion utilisateur
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Vérifier si l'utilisateur est actif
    if (!user.isActive) {
      return res.status(403).json({ message: 'Compte désactivé' });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/auth/signup - Inscription utilisateur
router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, whatsapp, notificationWhatsApp, role } = req.body;

    if (!firstName || !lastName || !email || !password || !phone) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    if (role && role !== 'CLIENT') {
      return res.status(403).json({
        message: 'Les comptes employés sont créés uniquement par l’administrateur'
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        phone,
        whatsapp: whatsapp || null,
        notificationWhatsApp: whatsapp ? !!notificationWhatsApp : false,
        role: 'CLIENT'
      }
    });

    // Envoyer WhatsApp de bienvenue si le client l'a accepté
    if (user.whatsapp && user.notificationWhatsApp) {
      sendWhatsAppOrderNotification(user.whatsapp, { user, orderNumber: '' }, 'WELCOME').catch(() => {});
    }

    // Générer le token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Inscription réussie',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/auth/forgot-password - Demander réinitialisation
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Ne pas révéler si l'email existe ou non pour sécurité
      return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
    }

    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 heure

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    // TODO: Envoyer l'email avec le lien de réinitialisation
    // await sendPasswordResetEmail(user.email, resetToken);

    res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/auth/reset-password - Réinitialiser mot de passe
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token et nouveau mot de passe requis' });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token invalide ou expiré' });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour l'utilisateur
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/auth/delete-account-request - Demander suppression de compte
router.post('/delete-account-request', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Mot de passe incorrect' });
    }

    // Générer code de vérification 6 chiffres
    const deleteCode = Math.floor(100000 + Math.random() * 900000).toString();
    const deleteCodeExpiry = new Date(Date.now() + 600000); // 10 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        deleteCode,
        deleteCodeExpiry
      }
    });

    // TODO: Envoyer l'email avec le code de suppression
    console.log(`Code de suppression pour ${email}: ${deleteCode}`);

    res.json({ message: 'Code de vérification envoyé par email' });
  } catch (error) {
    console.error('Delete account request error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/auth/delete-account-confirm - Confirmer suppression de compte
router.post('/delete-account-confirm', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email et code requis' });
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
        deleteCode: code,
        deleteCodeExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ message: 'Code invalide ou expiré' });
    }

    // Supprimer toutes les données liées à l'utilisateur
    await prisma.$transaction(async (tx) => {
      // Supprimer les commandes et leurs items
      await tx.orderItem.deleteMany({
        where: {
          order: {
            userId: user.id
          }
        }
      });
      
      await tx.order.deleteMany({
        where: { userId: user.id }
      });

      // Supprimer les favoris
      await tx.favorite.deleteMany({
        where: { userId: user.id }
      });

      // Supprimer les notifications
      await tx.notification.deleteMany({
        where: { userId: user.id }
      });

      // Supprimer l'utilisateur
      await tx.user.delete({
        where: { id: user.id }
      });
    });

    res.json({ message: 'Compte supprimé définitivement' });
  } catch (error) {
    console.error('Delete account confirm error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
