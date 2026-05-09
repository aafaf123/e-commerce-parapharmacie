import QRCode from 'qrcode';
import logger from '../utils/logger.js';

/**
 * Génère un QR code unique pour une commande
 * Encode : orderNumber + clientId + timestamp (infalsifiable)
 * Retourne : base64 PNG prêt à être intégré dans un email HTML
 */
export async function generateOrderQRCode(order) {
  try {
    const payload = JSON.stringify({
      orderNumber: order.orderNumber,
      orderId: order.id,
      ts: new Date(order.createdAt || Date.now()).getTime()
    });

    const qrBase64 = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 200,
      margin: 2,
      color: { dark: '#0369a1', light: '#ffffff' }
    });

    logger.info(`QR Code généré pour commande ${order.orderNumber}`);
    return qrBase64;
  } catch (error) {
    logger.error('Erreur génération QR Code', { message: error.message, orderNumber: order.orderNumber });
    return null;
  }
}

/**
 * Génère un QR code sous forme de Buffer PNG (pour pièce jointe email)
 */
export async function generateOrderQRCodeBuffer(order) {
  try {
    const payload = JSON.stringify({
      orderNumber: order.orderNumber,
      orderId: order.id,
      ts: new Date(order.createdAt || Date.now()).getTime()
    });

    const buffer = await QRCode.toBuffer(payload, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 200,
      margin: 2,
      color: { dark: '#0369a1', light: '#ffffff' }
    });

    return buffer;
  } catch (error) {
    logger.error('Erreur génération QR Code buffer', { message: error.message });
    return null;
  }
}
