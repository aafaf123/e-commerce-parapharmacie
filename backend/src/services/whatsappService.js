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
    if (cleanNumber.length < 8) return null; // numéro trop court
    if (cleanNumber.startsWith('0')) {
        cleanNumber = '212' + cleanNumber.substring(1);
    }
    if (!cleanNumber.startsWith('212') && cleanNumber.length === 9) {
        cleanNumber = '212' + cleanNumber;
    }
    return cleanNumber;
};

/**
 * Envoie une notification WhatsApp via Ultramsg
 */
export const sendWhatsAppOrderNotification = async (whatsappNumber, order, newStatus, retries = 2) => {
    const phone = formatPhoneNumber(whatsappNumber);
    if (!phone) {
        console.warn(`[WhatsApp] Numéro invalide ignoré: ${whatsappNumber}`);
        return;
    }

    if (!ULTRAMSG_INSTANCE_ID || ULTRAMSG_INSTANCE_ID === 'votre_instance_id_ici') {
        console.log(`[ULTRAMSG MOCK] → ${phone} | Commande ${order.orderNumber} | Status: ${newStatus}`);
        return;
    }

    const statusMessages = {
        'RECEIVED':    'bien reçue ✅',
        'RECUE':       'bien reçue ✅',
        'PREPARING':   'en cours de préparation 🔧',
        'PRETE':       'prête à être récupérée 🎉',
        'READY':       'prête à être récupérée 🎉',
        'COMPLETED':   'livrée/terminée ✅',
        'CANCELLED':   'annulée ❌',
        'ANNULEE':     'annulée ❌',
    };

    let body;
    if (newStatus === 'WELCOME') {
        body = `*ParaClick* 🌿\n\nBienvenue ${order.user?.firstName || 'Client'} !\n\nVotre compte a été créé avec succès. Vous recevrez ici le suivi de vos commandes et nos meilleures offres.`;
    } else {
        const statusText = statusMessages[newStatus] || newStatus;
        body = `*ParaClick* ✅\n\nBonjour ${order.user?.firstName || 'Client'},\n\nVotre commande n°*${order.orderNumber}* est maintenant *${statusText}*.\n\nMerci pour votre confiance ! 🙏`;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            await axios.post(`https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`, {
                token: ULTRAMSG_TOKEN,
                to: phone,
                body
            });
            console.log(`💬 ✅ WhatsApp envoyé → ${phone} | Status: ${newStatus}`);
            return;
        } catch (error) {
            const isLast = attempt === retries;
            console.error(`💬 ❌ Tentative ${attempt + 1}/${retries + 1} échouée pour ${phone}:`, error.response?.data?.message || error.message);
            if (!isLast) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
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
