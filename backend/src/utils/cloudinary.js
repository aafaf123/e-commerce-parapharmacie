import cloudinaryV2 from '../config/cloudinary.js';

export async function cloudinaryUpload(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('data:')) return imageUrl;
  try {
    const result = await cloudinaryV2.uploader.upload(imageUrl, {
      folder: 'parapharmacie/products'
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return imageUrl;
  }
}
