import { sendTextMessage } from './whatsappService';

// In a real app, these would come from the DB
const MERCHANT_PHONE = process.env.MERCHANT_PHONE || '2250700000000';

export const notifyMerchant = async (type: 'ORDER' | 'HANDOVER' | 'INFO', details: string) => {
    let emoji = 'ℹ️';
    let title = 'Info';

    if (type === 'ORDER') {
        emoji = '💰';
        title = 'Nouvelle Vente !';
    } else if (type === 'HANDOVER') {
        emoji = '🆘';
        title = 'Besoin d\'aide (Handover)';
    }

    const message = `${emoji} *${title}*\n\n${details}`;

    console.log(`[NOTIFY MERCHANT] Sending to ${MERCHANT_PHONE}: ${message}`);

    // Send WhatsApp to Merchant (Self-notification)
    // Note: To send to yourself in Sandbox, you just use the same number found in 'to' usually, 
    // but here we simulate sending to the Admin number.
    try {
        // For testing, we might not be able to send to a random number without template in Production, 
        // but in Dev/Sandbox it works if the number is verified.
        // We will just log it for now to avoid errors if env is not set.
        if (process.env.MERCHANT_PHONE) {
            await sendTextMessage(MERCHANT_PHONE, message);
        }
    } catch (e) {
        console.error('Failed to notify merchant', e);
    }
};
