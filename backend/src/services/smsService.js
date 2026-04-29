import dotenv from 'dotenv';
dotenv.config();

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

let twilioClient = null;

export const initSMSClient = async () => {
    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_SID !== 'your_twilio_sid') {
        try {
            const twilio = (await import('twilio')).default;
            twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN);
            console.log('✅ Service SMS Twilio initialisé.');
        } catch {
            console.warn('⚠️ Module twilio non installé. Mode simulation SMS activé.');
        }
    } else {
        console.warn('⚠️ Twilio non configuré dans .env. Mode simulation SMS activé.');
    }
};

const formatPhone = (number) => {
    if (!number) return null;
    let clean = number.replace(/[^0-9]/g, '');
    if (clean.length < 8) return null;
    if (clean.startsWith('0')) clean = '212' + clean.substring(1);
    if (!clean.startsWith('212') && clean.length === 9) clean = '212' + clean;
    return '+' + clean;
};

const STATUS_MESSAGES = {
    RECEIVED:  'bien reçue',
    RECUE:     'bien reçue',
    PREPARING: 'en cours de préparation',
    PRETE:     'prête à être récupérée',
    READY:     'prête à être récupérée',
    COMPLETED: 'livrée/terminée',
    CANCELLED: 'annulée',
    ANNULEE:   'annulée',
};

export const sendSMSOrderConfirmation = async (phone, order) => {
    const to = formatPhone(phone);
    if (!to) return;
    const body = `ParaClick: Bonjour ${order.user?.firstName || 'Client'}, votre commande n°${order.orderNumber} a ete creee. Total: ${order.total} DH. Merci!`;
    await _send(to, body);
};

export const sendSMSStatusUpdate = async (phone, order, newStatus) => {
    const to = formatPhone(phone);
    if (!to) return;
    const statusText = STATUS_MESSAGES[newStatus] || newStatus;
    const body = `ParaClick: Bonjour ${order.user?.firstName || 'Client'}, votre commande n°${order.orderNumber} est maintenant ${statusText}.`;
    await _send(to, body);
};

export const sendSMSReminder = async (phone, order) => {
    const to = formatPhone(phone);
    if (!to) return;
    const body = `ParaClick: Rappel - votre commande n°${order.orderNumber} est a recuperer dans 2h (creneau: ${order.timeSlotStart}). A tout a l'heure!`;
    await _send(to, body);
};

const _send = async (to, body) => {
    if (!twilioClient) {
        console.log(`[SMS MOCK] → ${to} | ${body}`);
        return;
    }
    try {
        await twilioClient.messages.create({ from: TWILIO_FROM, to, body });
        console.log(`📱 ✅ SMS envoyé → ${to}`);
    } catch (error) {
        console.error(`📱 ❌ SMS échoué pour ${to}:`, error.message);
    }
};
