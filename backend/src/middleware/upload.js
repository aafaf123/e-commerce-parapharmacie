import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(process.cwd(), 'uploads');
const profilesDir = path.join(uploadsDir, 'profiles');
const productsDir = path.join(uploadsDir, 'products');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
}
if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir, { recursive: true });
}

// Fonction pour traiter et redimensionner l'image avec sharp
const processImage = async (buffer, targetWidth = 1200, maxSizeBytes = 2 * 1024 * 1024) => {
  let image = sharp(buffer);
  const metadata = await image.metadata();
  
  // Redimensionner si plus grand que targetWidth (max 1200px de large)
  if (metadata.width > targetWidth) {
    image = image.resize(targetWidth, null, { withoutEnlargement: true });
  }
  
  // Convertir en WebP avec qualité initiale de 85
  let processedBuffer = await image.webp({ quality: 85 }).toBuffer();
  
  // Si still trop grand, réduire la qualité
  let quality = 85;
  while (processedBuffer.length > maxSizeBytes && quality > 50) {
    quality -= 10;
    processedBuffer = await sharp(buffer)
      .resize(targetWidth, null, { withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  }
  
  return processedBuffer;
};

// Configuration pour les images de profil - Stockage local avec traitement
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + '.webp');
  }
});

// Configuration pour les images de produits - Stockage local avec traitement
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, productsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + '.webp');
  }
});

// Middleware de traitement d'image pour les profils
const processProfileImage = async (req, res, next) => {
  if (!req.file) return next();
  
  try {
    // Lire le fichier depuis le disque
    const processedBuffer = await processImage(fs.readFileSync(req.file.path), 400, 500 * 1024);
    fs.writeFileSync(req.file.path, processedBuffer);
    req.file.size = processedBuffer.length;
    req.file.mimetype = 'image/webp';
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware de traitement d'image pour les produits
const processProductImage = async (req, res, next) => {
  if (!req.file) return next();
  
  try {
    // Lire le fichier depuis le disque
    const processedBuffer = await processImage(fs.readFileSync(req.file.path), 1200, 2 * 1024 * 1024);
    fs.writeFileSync(req.file.path, processedBuffer);
    req.file.size = processedBuffer.length;
    req.file.mimetype = 'image/webp';
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware pour le traitement d'images multiples
const processProductImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();
  
  try {
    for (let i = 0; i < req.files.length; i++) {
      const processedBuffer = await processImage(fs.readFileSync(req.files[i].path), 1200, 2 * 1024 * 1024);
      fs.writeFileSync(req.files[i].path, processedBuffer);
      req.files[i].size = processedBuffer.length;
      req.files[i].mimetype = 'image/webp';
    }
    next();
  } catch (error) {
    next(error);
  }
};

const uploadProfile = multer({ 
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, webp)'));
    }
  }
});

const uploadProduct = multer({ 
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, webp)'));
    }
  }
});

export { uploadProfile, uploadProduct, processProfileImage, processProductImage, processProductImages };