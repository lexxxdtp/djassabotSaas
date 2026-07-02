import { WASocket } from '@whiskeysockets/baileys';
import { db } from '../dbService';
import { DELIVERY_ITEM_ID } from './salesEngine';

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

        // La livraison est incluse dans le total quand la zone a été reconnue
        // (ligne d'article DELIVERY_ITEM_ID) — sinon elle reste à chiffrer.
        const hasDeliveryLine = Array.isArray(tempOrder.items)
            && tempOrder.items.some((i: any) => i.productId === DELIVERY_ITEM_ID);
        const deliveryNote = hasDeliveryLine
            ? '(Livraison incluse)'
            : '(Livraison NON incluse — zone à confirmer avec le client)';

        const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

        const msg =
            `📦 *NOUVELLE COMMANDE À LIVRER*
📅 *Date:* ${dateStr}

👤 *Client:* ${customerJid.split('@')[0]}
📍 *Lieu:* ${address}

🛒 *Contenu:*
${itemsSummary}

💰 *TOTAL A ENCAISSER:* ${tempOrder.total} FCFA
${deliveryNote}

👇 *Action:*
Contacter le client ou transférer au livreur.`;

        await sock.sendMessage(targetJid, { text: msg });
        console.log(`[Notification] Sent to vendor ${targetJid}`);

    } catch (error) {
        console.error('Error sending order notification', error);
    }
}

export async function sendPaymentNotification(
    sock: WASocket,
    tenantId: string,
    customerJid: string,
    orderId: string,
    amount: number,
    transactionId: string,
    provider: string,
    recipient?: { recipientName?: string; recipientPhone?: string }
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

        const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

        // Contrôle anti-fraude humain : le vendeur doit vérifier que le
        // destinataire lisible sur le reçu est bien SON compte.
        const recipientLine = recipient?.recipientName || recipient?.recipientPhone
            ? `\n👛 *Destinataire sur le reçu:* ${[recipient.recipientName, recipient.recipientPhone].filter(Boolean).join(' — ')}\n⚠️ Vérifiez que c'est bien VOTRE compte.`
            : '\n⚠️ Destinataire illisible sur le reçu — vérifiez que l\'argent est bien arrivé sur VOTRE compte.';

        const msg =
            `💰 *PAIEMENT AUTOMATIQUE REÇU*
📅 *Date:* ${dateStr}

👤 *Client:* ${customerJid.split('@')[0]}
📦 *Commande:* ${orderId}
💵 *Montant:* ${amount.toLocaleString('fr-FR')} FCFA
🧾 *ID Transaction:* ${transactionId}
🏦 *Moyen de Paiement:* ${provider.toUpperCase()}
${recipientLine}

✅ Le statut de la commande a été mis à jour à *PAYÉE* automatiquement.`;

        await sock.sendMessage(targetJid, { text: msg });
        console.log(`[Notification] Sent payment notification to vendor ${targetJid}`);

    } catch (error) {
        console.error('Error sending payment notification', error);
    }
}
