import express from 'express';
import multer from 'multer';
import { uploadProfile, processProfileImage } from '../middleware/upload.js';
import { authenticateToken } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Multer en mémoire pour Cloudinary (pas de disque)
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Helper: upload buffer vers Cloudinary
function uploadToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', transformation: [{ width: 1000, height: 1000, crop: 'limit' }] },
      (error, result) => error ? reject(error) : resolve(result)
    ).end(buffer);
  });
}

// Upload image de profil (reste local)
router.post('/profile', authenticateToken, uploadProfile.single('image'), processProfileImage, (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucune image fournie' });
    res.json({ url: `/uploads/profiles/${req.file.filename}`, publicId: req.file.filename });
  } catch (error) {
    console.error('Erreur upload profil:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Upload image de produit → Cloudinary
router.post('/product', authenticateToken, memoryUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucune image fournie' });
    const result = await uploadToCloudinary(req.file.buffer, 'parapharmacie/products');
    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) {
    console.error('Erreur upload produit Cloudinary:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Upload multiple images de produits → Cloudinary
router.post('/products/multiple', authenticateToken, memoryUpload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Aucune image fournie' });
    const images = await Promise.all(
      req.files.map(async file => {
        const result = await uploadToCloudinary(file.buffer, 'parapharmacie/products');
        return { url: result.secure_url, publicId: result.public_id };
      })
    );
    res.json({ images });
  } catch (error) {
    console.error('Erreur upload multiple Cloudinary:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Supprimer une image Cloudinary
router.delete('/delete/:publicId', authenticateToken, async (req, res) => {
  try {
    const publicId = decodeURIComponent(req.params.publicId);
    // Si c'est un fichier local (ancien système), supprimer du disque
    if (!publicId.includes('/')) {
      const filePath = path.join(process.cwd(), 'uploads', 'products', publicId);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } else {
      await cloudinary.uploader.destroy(publicId);
    }
    res.json({ message: 'Image supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

export default router;
