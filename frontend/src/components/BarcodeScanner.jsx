import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

/**
 * BarcodeScanner component for camera-based product scanning.
 * Uses html5-qrcode for robust barcode detection.
 */
const BarcodeScanner = ({ onScanSuccess, onScanError, onClose }) => {
  useEffect(() => {
    // Initialize the scanner
    const scanner = new Html5QrcodeScanner('reader', { 
      fps: 10, 
      qrbox: { width: 250, height: 150 },
      aspectRatio: 1.0
    });

    scanner.render(
      (decodedText) => {
        // Stop scanning and return result
        scanner.clear().then(() => {
          onScanSuccess(decodedText);
        }).catch(err => {
          console.error('Error clearing scanner:', err);
          onScanSuccess(decodedText);
        });
      },
      (error) => {
        if (onScanError) onScanError(error);
      }
    );

    // Cleanup on unmount
    return () => {
      scanner.clear().catch(error => {
        console.warn("Html5QrcodeScanner clear failed on unmount (normal if already cleared):", error);
      });
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-900">Scanner Intelligent</h3>
            <p className="text-xs text-gray-500">Pointez le code-barres du produit</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
            title="Fermer"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          <div id="reader" className="w-full overflow-hidden rounded-xl bg-black min-h-[300px]"></div>
        </div>

        <div className="p-4 bg-blue-50/50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
          </div>
          <p className="text-xs text-blue-800 leading-tight">
            Assurez-vous que l'éclairage est suffisant pour une détection optimale.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
