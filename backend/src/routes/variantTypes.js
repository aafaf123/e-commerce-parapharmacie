import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const verifyAdmin = async (req, res, next) => {
  // Simplified admin check - in production use proper middleware
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  next();
};

// GET all variant types
router.get('/', async (req, res) => {
  try {
    const types = await prisma.variantType.findMany({
      where: { active: true },
      orderBy: { order: 'asc' }
    });
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST variant type
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { name, label, active } = req.body;
    if (!name || !label) {
      return res.status(400).json({ error: 'Nom et label requis' });
    }
    
    // Check if name already exists
    const existing = await prisma.variantType.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: 'Ce type existe déjà' });
    }
    
    // Get max order
    const maxOrder = await prisma.variantType.aggregate({ _max: { order: true } });
    
    const type = await prisma.variantType.create({
      data: {
        name,
        label,
        active: active !== false,
        order: (maxOrder._max.order || 0) + 1
      }
    });
    
    res.status(201).json(type);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT variant type
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { name, label, active, order } = req.body;
    const type = await prisma.variantType.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(label && { label }),
        ...(active !== undefined && { active }),
        ...(order !== undefined && { order })
      }
    });
    res.json(type);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE variant type
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await prisma.variantType.delete({ where: { id: req.params.id } });
    res.json({ message: 'Type supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET variant values for a type
router.get('/:id/values', async (req, res) => {
  try {
    const values = await prisma.variantValue.findMany({
      where: { variantTypeId: req.params.id, active: true },
      orderBy: { order: 'asc' }
    });
    res.json(values);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST variant value
router.post('/:typeId/values', verifyAdmin, async (req, res) => {
  try {
    const { value, active } = req.body;
    if (!value) {
      return res.status(400).json({ error: 'Valeur requise' });
    }
    
    // Check if value already exists for this type
    const existing = await prisma.variantValue.findFirst({
      where: {
        variantTypeId: req.params.typeId,
        value: { equals: value, mode: 'insensitive' }
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Cette valeur existe déjà pour ce type' });
    }
    
    // Get max order
    const maxOrder = await prisma.variantValue.aggregate({
      where: { variantTypeId: req.params.typeId },
      _max: { order: true }
    });
    
    const val = await prisma.variantValue.create({
      data: {
        variantTypeId: req.params.typeId,
        value,
        active: active !== false,
        order: (maxOrder._max.order || 0) + 1
      }
    });
    
    res.status(201).json(val);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT variant value
router.put('/values/:id', verifyAdmin, async (req, res) => {
  try {
    const { value, active, order } = req.body;
    const val = await prisma.variantValue.update({
      where: { id: req.params.id },
      data: {
        ...(value && { value }),
        ...(active !== undefined && { active }),
        ...(order !== undefined && { order })
      }
    });
    res.json(val);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE variant value
router.delete('/values/:id', verifyAdmin, async (req, res) => {
  try {
    await prisma.variantValue.delete({ where: { id: req.params.id } });
    res.json({ message: 'Valeur supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;