import { useState, useRef } from 'react';
import { Upload, X, Loader, Image as ImageIcon } from 'lucide-react';
import api from '../api/axios';

const ImageUpload = ({ onUploadSuccess, currentImage, type = 'profile', multiple = false }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentImage || null);
  const [previews, setPreviews] = useState(currentImage ? [currentImage] : []);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const MAX_SIZE = 2 * 1024 * 1024; // 2MB

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Validate files
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Veuillez sélectionner des images');
        return;
      }
      if (file.size > MAX_SIZE) {
        setError('Chaque image doit faire moins de 2MB');
        return;
      }
    }

    setError('');
    setUploading(true);

    try {
      if (multiple && files.length > 1) {
        // Multiple upload
        const formData = new FormData();
        files.forEach(file => formData.append('images', file));

        const { data } = await api.post('/upload/products/multiple', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        // Add new images to existing previews
        const newUrls = data.images.map(img => img.url);
        setPreviews(prev => [...prev, ...newUrls]);

        if (onUploadSuccess) {
          onUploadSuccess(previews.concat(newUrls), null);
        }
      } else {
        // Single upload
        const file = files[0];
        
        // Local preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result);
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append('image', file);

        const endpoint = type === 'profile' ? '/upload/profile' : '/upload/product';
        const { data } = await api.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (onUploadSuccess) {
          onUploadSuccess(data.url, data.publicId);
        }
      }
    } catch (err) {
      console.error('Erreur upload:', err);
      setError('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index = null) => {
    if (multiple) {
      const newPreviews = previews.filter((_, i) => i !== index);
      setPreviews(newPreviews);
      if (onUploadSuccess) {
        onUploadSuccess(newPreviews, null);
      }
    } else {
      setPreview(null);
      if (onUploadSuccess) {
        onUploadSuccess(null, null);
      }
    }
    setError('');
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {multiple ? (
        // Multiple image upload mode
        <div className="space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {previews.map((url, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                <img src={url} alt={`Image ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => handleRemove(index)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            
            {previews.length < 5 && (
              <label className="cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple={multiple}
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
                <div className="aspect-square border-2 border-dashed border-gray-300 hover:border-sky-700 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors">
                  {uploading ? (
                    <Loader size={20} className="text-sky-700 animate-spin" />
                  ) : (
                    <>
                      <Upload size={20} className="text-gray-400" />
                      <span className="text-[10px] text-gray-500">Ajouter</span>
                    </>
                  )}
                </div>
              </label>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {previews.length}/5 images • WEBP • Max 2MB chacune • Auto-redimensionné
          </p>
        </div>
      ) : (
        // Single image upload mode
        <>
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
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X size={16} />
                </button>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                  <Loader size={24} className="text-white animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <label className="cursor-pointer">
              <input
                ref={fileInputRef}
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
          <p className="text-xs text-gray-500">
            Formats: JPG, PNG, WEBP (max 2MB) • Auto-redimensionné
          </p>
        </>
      )}
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default ImageUpload;
