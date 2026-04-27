import cloudinary from '../config/cloudinary.js';

/**
 * Upload an image to Cloudinary
 * @param {string|Buffer} image - Image data (base64 string, URL, or Buffer)
 * @param {string} [folder='parapharmacie/products'] - Cloudinary folder
 * @returns {Promise<string>} - Cloudinary secure URL
 */
export async function cloudinaryUpload(image, folder = 'parapharmacie/products') {
  try {
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
    throw error;
  }
}
