// backend/src/services/emailService.js
import nodemailer from 'nodemailer';

// Créer le transporteur Nodemailer
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // ou un autre service
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Transporteur réutilisable
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

// Envoyer un email de confirmation de commande
export const sendOrderConfirmation = async (userEmail, order) => {
  try {
    const transporter = getTransporter();
    
    const mailOptions = {
      from: `"Parapharmacie" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Confirmation de commande - ${order.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0369a1;">Confirmation de commande</h2>
          <p>Bonjour,</p>
          <p>Votre commande <strong>${order.orderNumber}</strong> a été confirmée avec succès.</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0369a1; margin-top: 0;">Détails de la commande</h3>
            <p><strong>Numéro de commande :</strong> ${order.orderNumber}</p>
            <p><strong>Date :</strong> ${new Date(order.createdAt).toLocaleDateString('fr-FR')}</p>
            <p><strong>Type :</strong> ${order.type === 'DELIVERY' ? 'Livraison' : 'Click & Collect'}</p>
            <p><strong>Statut :</strong> ${getStatusLabel(order.status)}</p>
            <p><strong>Total :</strong> ${order.total.toFixed(2)} DH</p>
          </div>
          
          ${order.timeSlotDate ? `
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p><strong>📅 Créneau de retrait :</strong></p>
              <p>${new Date(order.timeSlotDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <p>de ${order.timeSlotStart} à ${order.timeSlotEnd}</p>
            </div>
          ` : ''}
          
          <p>Merci de votre confiance !</p>
          <p style="color: #666; font-size: 14px;">L'équipe Parapharmacie</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de confirmation envoyé à ${userEmail} pour la commande ${order.orderNumber}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email confirmation:', error);
    return false;
  }
};

// Envoyer un email de mise à jour de statut de commande
export const sendOrderStatusUpdate = async (userEmail, order, newStatus) => {
  try {
    const transporter = getTransporter();
    
    const statusMessages = {
      RECEIVED: 'reçue',
      PREPARING: 'en préparation',
      READY: 'prête',
      COMPLETED: 'récupérée',
      CANCELLED: 'annulée',
    };

    const statusEmojis = {
      RECEIVED: '📦',
      PREPARING: '🔄',
      READY: '✅',
      COMPLETED: '🎉',
      CANCELLED: '❌',
    };

    const mailOptions = {
      from: `"Parapharmacie" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Mise à jour de votre commande - ${order.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0369a1;">${statusEmojis[newStatus] || '📢'} Votre commande est ${statusMessages[newStatus] || newStatus}</h2>
          <p>Bonjour,</p>
          <p>Nous vous informons que votre commande <strong>${order.orderNumber}</strong> a été mise à jour.</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Numéro de commande :</strong> ${order.orderNumber}</p>
            <p><strong>Nouveau statut :</strong> <span style="color: #059669; font-weight: bold;">${getStatusLabel(newStatus)}</span></p>
          </div>
          
          ${newStatus === 'READY' ? `
            <div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p><strong>🎉 Votre commande est prête !</strong></p>
              <p>Vous pouvez venir la récupérer selon le créneau choisi :</p>
              ${order.timeSlotDate ? `
                <p><strong>Date :</strong> ${new Date(order.timeSlotDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <p><strong>Heure :</strong> de ${order.timeSlotStart} à ${order.timeSlotEnd}</p>
              ` : ''}
              <p style="margin-top: 15px;"><strong>N'oubliez pas d\'apporter votre numéro de commande : ${order.orderNumber}</strong></p>
            </div>
          ` : ''}
          
          <p>Merci de votre confiance !</p>
          <p style="color: #666; font-size: 14px;">L'équipe Parapharmacie</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de statut envoyé à ${userEmail} pour la commande ${order.orderNumber} (${newStatus})`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email statut:', error);
    return false;
  }
};

// Envoyer un email pour un nouveau code promo
export const sendPromoCodeNotification = async (userEmail, promoCode) => {
  try {
    const transporter = getTransporter();
    
    const discountText = promoCode.discountType === 'percentage' 
      ? `${promoCode.discountValue}% de réduction`
      : `${promoCode.discountValue} DH de réduction`;

    const mailOptions = {
      from: `"Parapharmacie" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `🎉 Nouveau code promo : ${promoCode.code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0369a1;">🎉 Code promo exclusif !</h2>
          <p>Bonjour,</p>
          <p>Nous avons le plaisir de vous offrir un code promo exclusif :</p>
          
          <div style="background: linear-gradient(135deg, #0369a1, #0ea5e9); padding: 30px; border-radius: 12px; margin: 20px 0; text-align: center;">
            <p style="color: white; font-size: 14px; margin-bottom: 10px;">Votre code promo</p>
            <p style="color: white; font-size: 32px; font-weight: bold; margin: 10px 0; letter-spacing: 2px;">${promoCode.code}</p>
            <p style="color: white; font-size: 20px; font-weight: bold; margin: 10px 0;">${discountText}</p>
          </div>
          
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>Détails du code promo :</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Type : ${promoCode.discountType === 'percentage' ? 'Pourcentage' : 'Montant fixe'}</li>
              <li>Valeur : ${discountText}</li>
              ${promoCode.minimumOrder ? `<li>Commande minimum : ${promoCode.minimumOrder} DH</li>` : ''}
              ${promoCode.expiresAt ? `<li>Valable jusqu'au : ${new Date(promoCode.expiresAt).toLocaleDateString('fr-FR')}</li>` : ''}
            </ul>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="http://localhost:3000" style="background: #0369a1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Profiter de l'offre
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">L'équipe Parapharmacie</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email code promo envoyé à ${userEmail} (${promoCode.code})`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email code promo:', error);
    return false;
  }
};

// Helper pour obtenir le label du statut
const getStatusLabel = (status) => {
  const labels = {
    RECEIVED: 'Reçue',
    PREPARING: 'En préparation',
    READY: 'Prête',
    COMPLETED: 'Récupérée',
    CANCELLED: 'Annulée',
    REFUNDED: 'Remboursée',
    RETURNED: 'Retournée',
  };
  return labels[status] || status;
};

export default {
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendPromoCodeNotification,
};