import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Upload, Image } from 'lucide-react';

const BarcodeScanner = ({ onScanSuccess, onScanError, onClose }) => {
  const scannerRef = useRef(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [mode, setMode] = useState('camera'); // 'camera' or 'image'
  const [selectedImage, setSelectedImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    checkCamera();
  }, []);

  async function checkCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      if (cameras.length === 0) {
        setHasCamera(false);
      }
    } catch (e) {
      setHasCamera(false);
    }
  }

  useEffect(() => {
    if (mode === 'camera' && hasCamera) {
      startCameraScanner();
    }
    return () => {
      Html5QrcodeScanner.prototype.clear?.();
    };
  }, [mode]);

  function startCameraScanner() {
    const scanner = new Html5QrcodeScanner('reader', {
      fps: 10,
      qrbox: { width: 300, height: 150 },
      aspectRatio: 1.777778,
      formatsToSupport: [ 
        Html5QrcodeSupportedFormats.EAN_13, 
        Html5QrcodeSupportedFormats.EAN_8, 
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE
      ]
    });

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onScanSuccess(decodedText);
      },
      (error) => {
        if (error && !error.includes('NotFoundException')) {
          if (onScanError) onScanError(error);
        }
      }
    );
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImage(URL.createObjectURL(file));
    setScanning(true);

    try {
      const html5QrCode = new Html5Qrcode('image-reader');
      const result = await html5QrCode.scanFileV2(file);
      if (result) {
        onScanSuccess(result);
      }
    } catch (err) {
      console.error('Scan error:', err);
      if (onScanError) onScanError(err.message || 'Aucun code-barres détecté');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden relative">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-900">Scanner le code-barres</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {/* Mode Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setMode('image')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium ${
              mode === 'image' ? 'bg-sky-50 text-sky-700 border-b-2 border-sky-700' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Image size={18} /> Uploader image
          </button>
          {hasCamera && (
            <button
              onClick={() => setMode('camera')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium ${
                mode === 'camera' ? 'bg-sky-50 text-sky-700 border-b-2 border-sky-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Camera size={18} /> Caméra
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {mode === 'image' ? (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {!selectedImage ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-sky-500 hover:bg-sky-50 transition-colors"
                >
                  <Upload size={40} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600 font-medium">Cliquez pour uploader une image</p>
                  <p className="text-gray-400 text-sm mt-1">ou glissez-déposez</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div id="image-reader" className="flex justify-center">
                    <img src={selectedImage} alt="Selected" className="max-h-64 rounded-lg" />
                  </div>
                  {scanning && (
                    <div className="text-center text-sky-600 font-medium">Analyse en cours...</div>
                  )}
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      fileInputRef.current?.click();
                    }}
                    className="w-full py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Choisir une autre image
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div id="reader" className="w-full"></div>
              <div className="p-4 bg-gray-50 text-center">
                <p className="text-sm text-gray-600">
                  Placez le code-barres bien en face du cadre.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
