import { z } from 'zod'

// Schémas de base réutilisables
const phoneRegex = /^(\+212|0)[5-7][0-9]{8}$/
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/

// Schémas d'authentification
export const loginSchema = z.object({
  email: z.string()
    .min(1, 'Email requis')
    .email('Format email invalide'),
  password: z.string()
    .min(1, 'Mot de passe requis')
})

export const signupSchema = z.object({
  firstName: z.string()
    .min(2, 'Prénom requis (min 2 caractères)')
    .max(50, 'Prénom trop long'),
  lastName: z.string()
    .min(2, 'Nom requis (min 2 caractères)')
    .max(50, 'Nom trop long'),
  email: z.string()
    .min(1, 'Email requis')
    .email('Format email invalide'),
  password: z.string()
    .min(8, 'Minimum 8 caractères')
    .regex(passwordRegex, 'Doit contenir: majuscule, minuscule, chiffre'),
  confirmPassword: z.string(),
  phone: z.string()
    .regex(phoneRegex, 'Format: +212XXXXXXXXX ou 0XXXXXXXXX'),
  whatsapp: z.string()
    .regex(phoneRegex, 'Format: +212XXXXXXXXX ou 0XXXXXXXXX')
    .optional()
    .or(z.literal('')),
  address: z.string()
    .min(10, 'Adresse requise (min 10 caractères)')
    .max(200, 'Adresse trop longue'),
  acceptTerms: z.boolean()
    .refine(val => val === true, 'Vous devez accepter les conditions')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
})

export const forgotPasswordSchema = z.object({
  email: z.string()
    .min(1, 'Email requis')
    .email('Format email invalide')
})

export const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Minimum 8 caractères')
    .regex(passwordRegex, 'Doit contenir: majuscule, minuscule, chiffre'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
})

// Schémas de profil
export const editProfileSchema = z.object({
  firstName: z.string()
    .min(2, 'Prénom requis (min 2 caractères)')
    .max(50, 'Prénom trop long'),
  lastName: z.string()
    .min(2, 'Nom requis (min 2 caractères)')
    .max(50, 'Nom trop long'),
  email: z.string().email(), // Lecture seule
  phone: z.string()
    .regex(phoneRegex, 'Format: +212XXXXXXXXX ou 0XXXXXXXXX'),
  whatsapp: z.string()
    .regex(phoneRegex, 'Format: +212XXXXXXXXX ou 0XXXXXXXXX')
    .optional()
    .or(z.literal('')),
  address: z.string()
    .min(10, 'Adresse requise (min 10 caractères)')
    .max(200, 'Adresse trop longue'),
  notificationEmail: z.boolean().optional(),
  notificationSMS: z.boolean().optional(),
  notificationWhatsApp: z.boolean().optional(),
  notificationPush: z.boolean().optional()
})

// Schémas admin
export const adminLoginSchema = z.object({
  email: z.string()
    .min(1, 'Email requis')
    .email('Format email invalide'),
  password: z.string()
    .min(1, 'Mot de passe requis')
})

export const createEmployeeSchema = z.object({
  firstName: z.string()
    .min(2, 'Prénom requis (min 2 caractères)')
    .max(50, 'Prénom trop long'),
  lastName: z.string()
    .min(2, 'Nom requis (min 2 caractères)')
    .max(50, 'Nom trop long'),
  email: z.string()
    .min(1, 'Email requis')
    .email('Format email invalide'),
  password: z.string()
    .min(8, 'Minimum 8 caractères')
    .regex(passwordRegex, 'Doit contenir: majuscule, minuscule, chiffre'),
  phone: z.string()
    .regex(phoneRegex, 'Format: +212XXXXXXXXX ou 0XXXXXXXXX')
    .optional()
    .or(z.literal(''))
})

// Schémas de produits
export const productSchema = z.object({
  name: z.string()
    .min(2, 'Nom requis (min 2 caractères)')
    .max(100, 'Nom trop long'),
  description: z.string()
    .min(10, 'Description requise (min 10 caractères)')
    .max(1000, 'Description trop longue'),
  price: z.number()
    .min(0.01, 'Prix doit être supérieur à 0 DH'),
  stock: z.number()
    .int('Stock doit être un entier')
    .min(0, 'Stock ne peut pas être négatif'),
  categoryId: z.string()
    .min(1, 'Catégorie requise'),
  brand: z.string()
    .min(1, 'Marque requise')
    .max(50, 'Marque trop longue')
    .optional()
    .or(z.literal('')),
  isActive: z.boolean().optional()
})

// Schémas de commandes
export const deliverySchema = z.object({
  address: z.string()
    .min(10, 'Adresse requise (min 10 caractères)')
    .max(200, 'Adresse trop longue'),
  phone: z.string()
    .regex(phoneRegex, 'Format: +212XXXXXXXXX ou 0XXXXXXXXX'),
  notes: z.string()
    .max(500, 'Notes trop longues')
    .optional()
    .or(z.literal(''))
})

// Schémas de recherche et filtres
export const searchSchema = z.object({
  query: z.string()
    .min(1, 'Terme de recherche requis')
    .max(100, 'Terme trop long'),
  category: z.string().optional(),
  minPrice: z.number().min(0, 'Prix minimum ne peut pas être négatif (DH)').optional(),
  maxPrice: z.number().min(0, 'Prix maximum ne peut pas être négatif (DH)').optional(),
  brand: z.string().optional()
})

// Schémas de contact et support
export const contactSchema = z.object({
  name: z.string()
    .min(2, 'Nom requis (min 2 caractères)')
    .max(100, 'Nom trop long'),
  email: z.string()
    .min(1, 'Email requis')
    .email('Format email invalide'),
  subject: z.string()
    .min(5, 'Sujet requis (min 5 caractères)')
    .max(100, 'Sujet trop long'),
  message: z.string()
    .min(10, 'Message requis (min 10 caractères)')
    .max(1000, 'Message trop long')
})

// Schémas de reviews
export const reviewSchema = z.object({
  rating: z.number()
    .int('Note doit être un entier')
    .min(1, 'Note minimum: 1')
    .max(5, 'Note maximum: 5'),
  comment: z.string()
    .min(10, 'Commentaire requis (min 10 caractères)')
    .max(500, 'Commentaire trop long')
})

// Schémas de catégories
export const categorySchema = z.object({
  name: z.string()
    .min(2, 'Nom requis (min 2 caractères)')
    .max(50, 'Nom trop long'),
  description: z.string()
    .max(200, 'Description trop longue')
    .optional()
    .or(z.literal(''))
})

// Schémas de promotions
export const promotionSchema = z.object({
  title: z.string()
    .min(5, 'Titre requis (min 5 caractères)')
    .max(100, 'Titre trop long'),
  description: z.string()
    .min(10, 'Description requise (min 10 caractères)')
    .max(500, 'Description trop longue'),
  discountPercentage: z.number()
    .min(1, 'Remise minimum: 1%')
    .max(99, 'Remise maximum: 99%'),
  startDate: z.string()
    .min(1, 'Date de début requise'),
  endDate: z.string()
    .min(1, 'Date de fin requise'),
  isActive: z.boolean().optional()
})