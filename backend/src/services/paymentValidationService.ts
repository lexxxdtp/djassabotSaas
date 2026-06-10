import { WASocket } from '@whiskeysockets/baileys';
import { db } from './dbService';
import { ReceiptAnalysis } from './aiService';
import { sendPaymentNotification } from './whatsapp/notificationService';
import { logger } from '../utils/logger';

/**
 * Service to process and validate payment receipts extracted via Gemini Vision
 * and update order statuses accordingly.
 */
export const processReceiptValidation = async (
    tenantId: string,
    remoteJid: string,
    analysis: ReceiptAnalysis,
    sock: WASocket
): Promise<boolean> => {
    try {
        const { amount, transactionId, provider, confidence } = analysis;

        if (!amount || !transactionId || !provider) {
            logger.warn({ analysis, remoteJid }, '[PaymentValidation] Missing critical receipt data');
            return false;
        }

        logger.info({ tenantId, remoteJid, amount, transactionId, provider, confidence }, '[PaymentValidation] Validating receipt');

        // ANTI-FRAUDE : un même reçu (référence de transaction) ne peut servir qu'une fois
        const alreadyUsed = await db.isTransactionIdUsed(tenantId, transactionId);
        if (alreadyUsed) {
            logger.warn({ tenantId, remoteJid, transactionId }, '[PaymentValidation] Receipt reuse attempt blocked');
            await db.logActivity(
                tenantId,
                'warning',
                `⚠️ Tentative de réutilisation d'un reçu déjà validé (Réf: ${transactionId})`,
                { transactionId, amount, remoteJid }
            );
            await sock.sendMessage(remoteJid, {
                text: `🧾 Ce reçu (Réf: ${transactionId}) a déjà été utilisé pour valider un paiement. Si vous pensez qu'il s'agit d'une erreur, un conseiller va vérifier.`
            });
            return false;
        }

        // Fetch all orders for this tenant
        const orders = await db.getOrders(tenantId);

        // Filter pending or confirmed orders for this specific customer
        const customerPendingOrders = orders.filter(o => 
            o.userId === remoteJid && 
            (o.status === 'PENDING' || o.status === 'CONFIRMED')
        );

        if (customerPendingOrders.length === 0) {
            logger.info({ remoteJid }, '[PaymentValidation] No pending order found for this user');
            
            // Inform customer that we got the receipt but no pending order matches
            await sock.sendMessage(remoteJid, {
                text: `🧾 J'ai bien reçu votre reçu de paiement de ${amount.toLocaleString('fr-FR')} FCFA (${provider.toUpperCase()}), mais je ne trouve aucune commande en attente pour votre numéro.\n\nUn conseiller va vérifier manuellement.`
            });
            return false;
        }

        // Find an exact amount match among the pending orders, or default to the most recent one
        let matchedOrder = customerPendingOrders.find(o => o.total === amount);
        
        if (!matchedOrder) {
            // Fallback: Use the most recent pending order
            matchedOrder = customerPendingOrders[0];
            
            logger.warn(
                { orderTotal: matchedOrder.total, receiptAmount: amount }, 
                '[PaymentValidation] Amount mismatch'
            );

            // Inform customer about the amount mismatch
            await sock.sendMessage(remoteJid, {
                text: `🧾 J'ai reçu votre reçu de paiement de ${amount.toLocaleString('fr-FR')} FCFA, mais le montant ne correspond pas au total de votre commande en attente qui est de ${matchedOrder.total.toLocaleString('fr-FR')} FCFA.\n\nUn conseiller va faire la vérification manuellement.`
            });

            // Log activity log for visibility
            await db.logActivity(
                tenantId,
                'warning',
                `Écart montant reçu: Commande ${matchedOrder.id.split('-')[1]} (${matchedOrder.total} FCFA) vs Reçu (${amount} FCFA)`,
                { orderId: matchedOrder.id, amount, transactionId }
            );

            return false;
        }

        // Match found! Update status to PAID
        logger.info({ orderId: matchedOrder.id }, '[PaymentValidation] Order matched, updating to PAID');
        
        await db.updateOrderStatus(tenantId, matchedOrder.id, 'PAID');

        // Log activity (the "Pulse")
        await db.logActivity(
            tenantId,
            'sale',
            `Paiement de ${(amount).toLocaleString('fr-FR')} FCFA validé automatiquement par reçu ${provider.toUpperCase()}`,
            { orderId: matchedOrder.id, total: amount, transactionId }
        );

        // Confirm to customer
        await sock.sendMessage(remoteJid, {
            text: `✅ Merci ! Votre paiement de ${amount.toLocaleString('fr-FR')} FCFA par ${provider.toUpperCase()} (Réf: ${transactionId}) a été validé automatiquement.\n\nVotre commande ${matchedOrder.id.split('-')[1]} est confirmée et en cours de préparation ! 🛍️`
        });

        // Notify merchant
        await sendPaymentNotification(
            sock,
            tenantId,
            remoteJid,
            matchedOrder.id,
            amount,
            transactionId,
            provider
        );

        return true;
    } catch (error) {
        logger.error({ err: error, remoteJid }, '[PaymentValidation] Error validating receipt');
        return false;
    }
};
