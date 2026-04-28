import cloudinary from '../config/cloudinary.js';

/**
 * Upload an image to Cloudinary
 * @param {string|Buffer} image - Image data (base64 string, URL, or Buffer)
 * @param {string} [folder='parapharmacie/products'] - Cloudinary folder
 * @returns {Promise<string>} - Cloudinary secure URL
 */
export async function cloudinaryUpload(image, folder = 'parapharmacie/products') {
  try {
    // Si c'est déjà une URL, la retourner directement
    if (typeof image === 'string' && image.startsWith('http')) {
      return image;
    }

    // Si Cloudinary n'est pas configuré, retourner l'image telle quelle
    if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name') {
      return typeof image === 'string' ? image : null;
    }

    const uploadOptions = {
      folder,
      resource_type: 'image',
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' }
      ]
    };

    const result = await cloudinary.uploader.upload(image, uploadOptions);
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error.message);
    // En cas d'erreur, retourner l'image originale si c'est une URL
    if (typeof image === 'string' && image.startsWith('http')) return image;
    throw error;
  }
}
