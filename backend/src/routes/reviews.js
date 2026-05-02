import express from 'express'
import prisma from '../prismaClient.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// GET /api/reviews/:productId — avis approuvés d'un produit
router.get('/:productId', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.productId, approved: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, rating: true, comment: true, createdAt: true }
    })
    res.json(reviews)
  } catch (error) {
    console.error('Get reviews error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// POST /api/reviews/:productId — soumettre un avis (authentifié)
router.post('/:productId', authenticateToken, async (req, res) => {
  try {
    const { name, rating, comment } = req.body
    if (!name || !comment || !rating) {
      return res.status(400).json({ message: 'Nom, note et commentaire requis' })
    }

    const product = await prisma.product.findUnique({ where: { id: req.params.productId } })
    if (!product) return res.status(404).json({ message: 'Produit non trouvé' })

    const review = await prisma.review.create({
      data: {
        productId: req.params.productId,
        clientId: req.userId || null,
        name: name.trim(),
        rating: parseInt(rating),
        comment: comment.trim(),
        approved: false
      }
    })

    res.status(201).json({ message: 'Avis soumis, en attente de modération', review })
  } catch (error) {
    console.error('Post review error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

export default router
