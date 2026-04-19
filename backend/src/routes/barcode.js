import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * Route pour récupérer les infos d'un produit par code-barres
 * Utilise Open Beauty Facts (gratuit)
 */
router.get('/lookup/:barcode', authenticateToken, async (req, res) => {
  try {
    const { barcode } = req.params;
    
    console.log(`🔍 Recherche barcode: ${barcode}`);
    
    // 1. Interroger Open Beauty Facts
    const response = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${barcode}.json`);
    
    if (!response.ok) {
      return res.status(404).json({ message: 'Produit non répertorié dans la base mondiale' });
    }
    
    const data = await response.json();
    
    if (data.status === 0 || !data.product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    const p = data.product;
    
    // Mapping des données
    const productInfo = {
      name: p.product_name || p.product_name_fr || '',
      brand: p.brands || '',
      description: p.description || p.generic_name || '',
      composition: p.ingredients_text || '',
      category: p.categories_tags ? p.categories_tags[0]?.replace('en:', '') : '',
      image: null,
      barcode: barcode
    };

    // 2. Traitement de l'image (si présente)
    const externalImageUrl = p.image_url || p.image_front_url || p.image_small_url;
    
    if (externalImageUrl) {
      try {
        console.log(`🖼️ Téléchargement image: ${externalImageUrl}`);
        const imageRes = await fetch(externalImageUrl);
        const buffer = await imageRes.arrayBuffer();
        
        const uploadsDir = path.join(process.cwd(), 'uploads', 'products');
        const fileName = `product-${Date.now()}-${uuidv4().slice(0, 8)}.jpg`;
        const filePath = path.join(uploadsDir, fileName);
        
        fs.writeFileSync(filePath, Buffer.from(buffer));
        
        const protocol = req.protocol;
        const host = req.get('host');
        productInfo.image = `${protocol}://${host}/uploads/products/${fileName}`;
        productInfo.imagePublicId = fileName;
        
      } catch (imgError) {
        console.error('Erreur téléchargement image barcode:', imgError);
        // On continue sans l'image si ça échoue
      }
    }

    res.json(productInfo);
    
  } catch (error) {
    console.error('Erreur Lookup Barcode:', error);
    res.status(500).json({ message: 'Erreur lors de la recherche du code-barres' });
  }
});

export default router;
