import { WASocket } from '@whiskeysockets/baileys';
import { db } from '../dbService';

export async function sendOrderNotification(
    sock: WASocket,
    tenantId: string,
    customerJid: string,
    address: string,
    tempOrder: any
) {
    try {
        const settings = await db.getSettings(tenantId);

        // Target Number
        let notificationPhone = (settings.notificationPhone || settings.phone)?.replace(/[^0-9]/g, '');

        if (!notificationPhone || notificationPhone.length < 8) return;

        let targetJid = notificationPhone;
        if (!targetJid.includes('@s.whatsapp.net')) {
            // Simple heuristic for CI numbers (starts with 01/05/07 and length 10)
            if (targetJid.length === 10 && (targetJid.startsWith('01') || targetJid.startsWith('05') || targetJid.startsWith('07'))) {
                targetJid = '225' + targetJid;
            }
            targetJid = targetJid + '@s.whatsapp.net';
        }

        // Summary
        const itemsSummary = tempOrder.items && tempOrder.items.length > 0
            ? tempOrder.items.map((i: any) => {
                const vars = i.selectedVariations ? ` (${i.selectedVariations.map((v: any) => v.value).join(', ')})` : '';
                return `- ${i.quantity}x ${i.productName}${vars} : ${i.price} FCFA`;
            }).join('\n')
            : `- ${tempOrder.quantity}x ${tempOrder.productName} : ${tempOrder.total} FCFA`;

        const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

        const msg =
            `📦 *NOUVELLE COMMANDE À LIVRER*
📅 *Date:* ${dateStr}

👤 *Client:* ${customerJid.split('@')[0]}
📍 *Lieu:* ${address}

🛒 *Contenu:*
${itemsSummary}

💰 *TOTAL A ENCAISSER:* ${tempOrder.total} FCFA
(Hors frais de livraison)

👇 *Action:*
Contacter le client ou transférer au livreur.`;

        await sock.sendMessage(targetJid, { text: msg });
        console.log(`[Notification] Sent to vendor ${targetJid}`);

    } catch (error) {
        console.error('Error sending order notification', error);
    }
}
