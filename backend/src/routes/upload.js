import express from 'express';
import { uploadProfile, uploadProduct } from '../middleware/upload.js';
import { authenticateToken } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Upload image de profil
router.post('/profile', authenticateToken, uploadProfile.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie' });
    }
    // Retourner le chemin relatif pour accès via le serveur statique
    const imageUrl = `/uploads/profiles/${req.file.filename}`;
    res.json({ 
      url: imageUrl,
      publicId: req.file.filename
    });
  } catch (error) {
    console.error('Erreur upload profil:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Upload image de produit
router.post('/product', authenticateToken, uploadProduct.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie' });
    }
    // Retourner l'URL complète pour accès depuis le frontend
    const protocol = req.protocol;
    const host = req.get('host');
    const imageUrl = `${protocol}://${host}/uploads/products/${req.file.filename}`;
    res.json({ 
      url: imageUrl,
      publicId: req.file.filename
    });
  } catch (error) {
    console.error('Erreur upload produit:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Upload multiple images de produits
router.post('/products/multiple', authenticateToken, uploadProduct.array('images', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucune image fournie' });
    }
    const protocol = req.protocol;
    const host = req.get('host');
    const images = req.files.map(file => ({
      url: `${protocol}://${host}/uploads/products/${file.filename}`,
      publicId: file.filename
    }));
    res.json({ images });
  } catch (error) {
    console.error('Erreur upload multiple:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Supprimer une image (stockage local)
router.delete('/delete/:filename', authenticateToken, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(process.cwd(), 'uploads', 'products', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.json({ message: 'Image supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

export default router;
