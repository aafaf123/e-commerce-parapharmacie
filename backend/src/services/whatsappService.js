import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service pour envoyer des notifications via Ultramsg WhatsApp API
 * Plus pratique : pas de code "join" requis pour les clients !
 */

const ULTRAMSG_INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;

/**
 * Initialisation
 */
export const initWhatsAppClient = () => {
    if (ULTRAMSG_INSTANCE_ID && ULTRAMSG_TOKEN && ULTRAMSG_INSTANCE_ID !== 'votre_instance_id_ici') {
        console.log('✅ Service WhatsApp Ultramsg initialisé (Prêt pour envoi direct).');
    } else {
        console.warn('⚠️ Attention: Ultramsg Instance ID ou Token non configuré dans .env. Mode simulation activé.');
    }
};

/**
 * Formate le numéro de téléphone pour Ultramsg
 */
const formatPhoneNumber = (number) => {
    if (!number) return null;
    let cleanNumber = number.replace(/[^0-9]/g, '');
    
    // Format local Maroc (0...) -> 212...
    if (cleanNumber.startsWith('0')) {
        cleanNumber = '212' + cleanNumber.substring(1);
    }
    
    return cleanNumber;
};

/**
 * Envoie une notification WhatsApp via Ultramsg
 */
export const sendWhatsAppOrderNotification = async (whatsappNumber, order, newStatus) => {
    const phone = formatPhoneNumber(whatsappNumber);
    if (!phone) return;

    if (!ULTRAMSG_INSTANCE_ID || ULTRAMSG_INSTANCE_ID === 'votre_instance_id_ici') {
        console.log(`[ULTRAMSG MOCK] Envoi WhatsApp à ${phone} simulé.`);
        console.log(`Message: Commande ${order.orderNumber} est ${newStatus}`);
        return;
    }

    try {
        let statusText = '';
        let body = '';

        switch (newStatus) {
            case 'RECEIVED': case 'RECUE': statusText = 'bien reçue'; break;
            case 'PREPARATION': statusText = 'en cours de préparation'; break;
            case 'PRETE': statusText = 'prête à être récupérée'; break;
            case 'COMPLETED': statusText = 'livrée/terminée'; break;
            case 'ANNULEE': statusText = 'annulée'; break;
            case 'WELCOME': 
                body = `*ParaClick* 🌿\n\nBienvenue ${order.user?.firstName || 'Client'} !\n\nVotre compte a été créé avec succès. Désormais, vous recevrez ici le suivi en temps réel de vos commandes et nos meilleures offres.`;
                break;
            default: statusText = newStatus;
        }

        if (!body) {
            body = `*ParaClick* ✅\n\nBonjour ${order.user?.firstName || 'Client'},\n\nVotre commande n°*${order.orderNumber}* est maintenant *${statusText}*.\n\nMerci pour votre confiance !`;
        }

        const url = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`;
        
        await axios.post(url, {
            token: ULTRAMSG_TOKEN,
            to: phone,
            body: body
        });

        console.log(`💬 ✅ WhatsApp Ultramsg envoyé à ${phone}. Status: ${newStatus}`);
    } catch (error) {
        console.error(`💬 ❌ Erreur Ultramsg pour ${phone}:`, error.response?.data || error.message);
    }
};

/**
 * Envoie une notification de promotion
 */
export const sendWhatsAppPromotion = async (whatsappNumber, promotion) => {
    const phone = formatPhoneNumber(whatsappNumber);
    if (!phone) return;

    if (!ULTRAMSG_INSTANCE_ID || ULTRAMSG_INSTANCE_ID === 'votre_instance_id_ici') {
        console.log(`[ULTRAMSG MOCK] Promotion WhatsApp à ${phone} simulée.`);
        return;
    }

    try {
        const url = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`;
        
        await axios.post(url, {
            token: ULTRAMSG_TOKEN,
            to: phone,
            body: `*Promotion ParaClick !* 🔥\n\n${promotion.title}\n\n${promotion.description}\n\nProfitez-en ici : http://votre-site.com/promotions`
        });
        console.log(`💬 ✅ Promotion Ultramsg envoyée à ${phone}`);
    } catch (error) {
        console.error(`💬 ❌ Erreur Promotion Ultramsg pour ${phone}:`, error.response?.data || error.message);
    }
};
