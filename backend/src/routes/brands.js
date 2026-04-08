import express from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import cloudinary from 'cloudinary';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Accès refusé' });
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

// GET /api/brands - Liste marques
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const { active } = req.query;
    const where = {};
    if (active !== undefined) where.active = active === 'true';
    
    const brands = await prisma.brand.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });
    
    res.json(brands);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/brands - Créer marque (case-insensitive, retourne marque existante si déjà créée)
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { name, description, active } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom de la marque est requis' });
    }

    const normalizedName = name.trim();
    
    // Vérifier si une marque avec le même nom existe déjà (case-insensitive)
    const existingBrand = await prisma.brand.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive'
        }
      }
    });

    if (existingBrand) {
      // Si la marque existe déjà, la retourner avec un message
      return res.status(200).json({ 
        brand: existingBrand, 
        message: 'Cette marque existe déjà',
        existing: true
      });
    }
    
    // Créer une nouvelle marque avec le nom normalisé (première lettre en majuscule)
    const formattedName = normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1).toLowerCase();
    
    const brand = await prisma.brand.create({
      data: { 
        name: formattedName, 
        description, 
        active: active !== false 
      }
    });
    
    res.status(201).json({ 
      brand, 
      message: 'Marque créée avec succès',
      existing: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/brands/:id - Modifier marque
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { name, description, active } = req.body;
    
    const brand = await prisma.brand.update({
      where: { id: req.params.id },
      data: { name, description, active }
    });
    
    res.json(brand);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/brands/:id - Supprimer marque
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const productsCount = await prisma.product.count({
      where: { brandId: req.params.id }
    });
    
    if (productsCount > 0) {
      return res.status(400).json({ error: `Impossible de supprimer: ${productsCount} produit(s) associé(s)` });
    }
    
    const brand = await prisma.brand.findUnique({ where: { id: req.params.id } });
    if (brand?.logo) {
      try {
        const publicId = brand.logo.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`brands/${publicId}`);
      } catch (err) {
        console.error('Erreur suppression logo:', err);
      }
    }
    
    await prisma.brand.delete({ where: { id: req.params.id } });
    res.json({ message: 'Marque supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/brands/:id/logo - Upload logo
router.post('/:id/logo', verifyAdmin, upload.single('logo'), async (req, res) => {
  try {
    const brand = await prisma.brand.findUnique({ where: { id: req.params.id } });
    if (!brand) return res.status(404).json({ error: 'Marque non trouvée' });
    
    // Supprimer ancien logo
    if (brand.logo) {
      try {
        const publicId = brand.logo.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`brands/${publicId}`);
      } catch (err) {
        console.error('Erreur suppression ancien logo:', err);
      }
    }
    
    // Upload nouveau logo
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'brands' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });
    
    const updatedBrand = await prisma.brand.update({
      where: { id: req.params.id },
      data: { logo: result.secure_url }
    });
    
    res.json(updatedBrand);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
