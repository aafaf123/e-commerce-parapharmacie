import { useState, useEffect } from 'react';
import { Upload, X, Loader } from 'lucide-react';
import api from '../api/axios';

const ImageUpload = ({ onUploadSuccess, currentImage, type = 'profile' }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentImage || null);
  const [error, setError] = useState('');

  // Update preview when currentImage prop changes (e.g., after a barcode scan)
  useEffect(() => {
    setPreview(currentImage);
  }, [currentImage]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validation du type de fichier
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image');
      return;
    }

    // Validation de la taille (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('L\'image ne doit pas dépasser 5MB');
      return;
    }

    setError('');
    
    // Preview local
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload vers Cloudinary
    const formData = new FormData();
    formData.append('image', file);

    setUploading(true);
    try {
      const endpoint = type === 'profile' ? '/upload/profile' : '/upload/product';
      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (onUploadSuccess) {
        onUploadSuccess(data.url, data.publicId);
      }
    } catch (error) {
      console.error('Erreur upload:', error);
      setError('Erreur lors de l\'upload de l\'image');
      setPreview(currentImage);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError('');
    if (onUploadSuccess) {
      onUploadSuccess(null, null);
    }
  };

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className={`object-cover border-2 border-gray-200 ${
              type === 'profile' ? 'w-32 h-32 rounded-full' : 'w-48 h-48 rounded-lg'
            }`}
          />
          {!uploading && (
            <button
              onClick={handleRemove}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-full">
              <Loader size={24} className="text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
          <div className={`border-2 border-dashed border-gray-300 hover:border-sky-700 transition-colors flex flex-col items-center justify-center gap-2 ${
            type === 'profile' ? 'w-32 h-32 rounded-full' : 'w-48 h-48 rounded-lg'
          }`}>
            {uploading ? (
              <Loader size={32} className="text-sky-700 animate-spin" />
            ) : (
              <>
                <Upload size={32} className="text-gray-400" />
                <span className="text-xs text-gray-500 text-center px-2">
                  Cliquer pour choisir
                </span>
              </>
            )}
          </div>
        </label>
      )}
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      <p className="text-xs text-gray-500">
        Formats acceptés: JPG, PNG, WEBP (max 5MB)
      </p>
    </div>
  );
};

export default ImageUpload;
