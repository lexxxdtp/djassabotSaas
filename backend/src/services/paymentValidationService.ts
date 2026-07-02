import { WASocket } from '@whiskeysockets/baileys';
import { db } from './dbService';
import { ReceiptAnalysis } from './aiService';
import { sendPaymentNotification } from './whatsapp/notificationService';
import { splitDeliveryItem } from './whatsapp/salesEngine';
import { Order } from '../types';
import { logger } from '../utils/logger';

/**
 * Service to process and validate payment receipts extracted via Gemini Vision
 * and update order statuses accordingly.
 *
 * Matching des montants (dans l'ordre) :
 * 1. total exact de la commande (cas normal : livraison incluse au checkout)
 * 2. commande créée avec zone inconnue → montant = articles + une zone configurée
 *    (le client a payé PLUS pour couvrir la livraison — jamais moins)
 * Un montant INFÉRIEUR au total n'est jamais auto-validé.
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

        // 1. Correspondance exacte sur le total
        let matchedOrder: Order | undefined = customerPendingOrders.find(o => o.total === amount);
        let matchNote = '';

        // 2. Commande à livraison non chiffrée : articles + une zone configurée
        //    (le client paie PLUS que le total enregistré, jamais moins)
        if (!matchedOrder) {
            const settings = await db.getSettings(tenantId);
            const zones = Array.isArray(settings.deliveryZones) ? settings.deliveryZones : [];
            for (const o of customerPendingOrders) {
                const { delivery } = splitDeliveryItem(o.items || []);
                if (delivery) continue; // la livraison était déjà incluse → pas d'excuse
                if (amount <= o.total) continue; // jamais auto-valider un sous-paiement
                const zone = zones.find(z => o.total + z.price === amount);
                if (zone) {
                    matchedOrder = o;
                    matchNote = ` (articles ${o.total.toLocaleString('fr-FR')} + livraison ${zone.name} ${zone.price.toLocaleString('fr-FR')})`;
                    break;
                }
            }
        }

        if (!matchedOrder) {
            // Aucun montant ne colle → vérification manuelle (on prend la plus récente pour le contexte)
            const closest = customerPendingOrders[0];

            logger.warn(
                { orderTotal: closest.total, receiptAmount: amount },
                '[PaymentValidation] Amount mismatch'
            );

            await sock.sendMessage(remoteJid, {
                text: `🧾 J'ai reçu votre reçu de paiement de ${amount.toLocaleString('fr-FR')} FCFA, mais le montant ne correspond pas au total de votre commande en attente qui est de ${closest.total.toLocaleString('fr-FR')} FCFA.\n\nUn conseiller va faire la vérification manuellement.`
            });

            await db.logActivity(
                tenantId,
                'warning',
                `Écart montant reçu: Commande ${closest.id.split('-')[1]} (${closest.total} FCFA) vs Reçu (${amount} FCFA)`,
                { orderId: closest.id, amount, transactionId, recipientName: analysis.recipientName, recipientPhone: analysis.recipientPhone }
            );

            return false;
        }

        // Match found! Update status to PAID
        logger.info({ orderId: matchedOrder.id, matchNote }, '[PaymentValidation] Order matched, updating to PAID');

        await db.updateOrderStatus(tenantId, matchedOrder.id, 'PAID');

        // Log activity (the "Pulse") — le destinataire extrait du reçu est journalisé
        // pour que le vendeur puisse repérer un paiement envoyé au mauvais compte.
        await db.logActivity(
            tenantId,
            'sale',
            `Paiement de ${(amount).toLocaleString('fr-FR')} FCFA validé automatiquement par reçu ${provider.toUpperCase()}${matchNote}`,
            {
                orderId: matchedOrder.id,
                total: amount,
                transactionId,
                recipientName: analysis.recipientName,
                recipientPhone: analysis.recipientPhone,
            }
        );

        // Confirm to customer
        await sock.sendMessage(remoteJid, {
            text: `✅ Merci ! Votre paiement de ${amount.toLocaleString('fr-FR')} FCFA par ${provider.toUpperCase()} (Réf: ${transactionId}) a été validé automatiquement.\n\nVotre commande ${matchedOrder.id.split('-')[1]} est confirmée et en cours de préparation ! 🛍️`
        });

        // Notify merchant (avec le destinataire lisible sur le reçu — contrôle anti-fraude humain)
        await sendPaymentNotification(
            sock,
            tenantId,
            remoteJid,
            matchedOrder.id,
            amount,
            transactionId,
            provider,
            { recipientName: analysis.recipientName, recipientPhone: analysis.recipientPhone }
        );

        return true;
    } catch (error) {
        logger.error({ err: error, remoteJid }, '[PaymentValidation] Error validating receipt');
        return false;
    }
};
