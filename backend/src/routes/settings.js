import express from 'express'
import { PrismaClient } from '@prisma/client'
import { verifyAdmin } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

// GET /api/settings - Récupérer tous les paramètres
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.settings.findMany()

    // Convertir en objet clé-valeur
    const settingsObj = {}
    settings.forEach((setting) => {
      settingsObj[setting.key] = setting.value
    })

    res.json(settingsObj)
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/settings/:key - Récupérer un paramètre par clé
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params

    const setting = await prisma.settings.findUnique({
      where: { key },
    })

    if (!setting) {
      return res.status(404).json({ error: 'Paramètre non trouvé' })
    }

    res.json({ key: setting.key, value: setting.value })
  } catch (error) {
    console.error('Erreur lors de la récupération du paramètre:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PUT /api/settings/:key - Mettre à jour ou créer un paramètre (Admin uniquement)
router.put('/:key', verifyAdmin, async (req, res) => {
  try {
    const { key } = req.params
    const { value, description } = req.body

    const setting = await prisma.settings.upsert({
      where: { key },
      update: { 
        value: String(value),
        ...(description && { description })
      },
      create: { 
        key, 
        value: String(value),
        description: description || ''
      },
    })

    res.json({ message: 'Paramètre mis à jour avec succès', setting })
  } catch (error) {
    console.error('Erreur lors de la mise à jour du paramètre:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router

