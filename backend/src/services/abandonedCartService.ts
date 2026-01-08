import { getActiveSessions } from './sessionService';
import { whatsappManager } from './baileysManager';

/**
 * Service de détection et relance des paniers abandonnés
 * 
 * Logique :
 * - Scanne toutes les sessions actives toutes les 10 minutes
 * - Si une session est en état "WAITING_FOR_ADDRESS" depuis plus de 30 minutes
 * - Envoie un message de relance automatique via WhatsApp
 */

const ABANDONED_CART_THRESHOLD_MINUTES = 30;

/**
 * Détecte les paniers abandonnés et envoie des rappels
 */
export const checkAbandonedCarts = async () => {
    try {
        console.log('[AbandonedCart] 🔍 Checking for abandoned carts...');

        const allSessions = getActiveSessions();
        const now = new Date();

        let abandonedCount = 0;

        for (const session of allSessions) {
            // Vérifier si la session est en attente d'adresse
            if (session.state !== 'WAITING_FOR_ADDRESS') continue;

            // Skip si une relance a déjà été envoyée pour cette session
            if (session.reminderSent) continue;

            // Calculer le temps écoulé depuis la dernière interaction
            const lastInteraction = new Date(session.lastInteraction);
            const minutesElapsed = (now.getTime() - lastInteraction.getTime()) / (1000 * 60);

            // Si abandon détecté (> 30 minutes)
            if (minutesElapsed >= ABANDONED_CART_THRESHOLD_MINUTES) {
                console.log(`[AbandonedCart] 🛒 Found abandoned cart for ${session.userId} (${Math.floor(minutesElapsed)} min ago)`);

                // Envoyer le message de relance
                const success = await sendAbandonedCartReminder(session.tenantId, session.userId, session.tempOrder);

                if (success) {
                    // Marquer que la relance a été envoyée
                    const { updateSession } = await import('./sessionService');
                    updateSession(session.tenantId, session.userId, { reminderSent: true });
                    abandonedCount++;
                }
            }
        }

        if (abandonedCount > 0) {
            console.log(`[AbandonedCart] ✅ Sent ${abandonedCount} reminder(s)`);
        } else {
            console.log('[AbandonedCart] ✨ No abandoned carts found');
        }
    } catch (error) {
        console.error('[AbandonedCart] ❌ Error checking abandoned carts:', error);
    }
};

/**
 * Envoie un message de rappel personnalisé pour un panier abandonné
 * @returns true si le message a été envoyé avec succès, false sinon
 */
const sendAbandonedCartReminder = async (tenantId: string, userId: string, tempOrder: any): Promise<boolean> => {
    try {
        // Récupérer la session WhatsApp du tenant
        const sessionData = await whatsappManager.getSession(tenantId);

        if (!sessionData || sessionData.status !== 'connected') {
            console.warn(`[AbandonedCart] ⚠️ Tenant ${tenantId} not connected to WhatsApp`);
            return false;
        }

        const sock = sessionData.sock;
        const remoteJid = userId; // userId est le JID WhatsApp (numéro@s.whatsapp.net)

        // Construction du message personnalisé
        let message = '👋 Bonjour !\n\n';
        message += 'Je remarque que vous n\'avez pas terminé votre commande.\n\n';

        if (tempOrder?.summary) {
            message += `Vous aviez choisi : **${tempOrder.summary}**\n`;
        }

        if (tempOrder?.total) {
            message += `Total : **${tempOrder.total} FCFA**\n\n`;
        }

        message += '💬 Vous avez besoin d\'aide pour finaliser ?\n';
        message += 'Je suis toujours là pour vous assister ! 😊\n\n';
        message += 'Si vous voulez reprendre, envoyez simplement votre adresse de livraison.';

        // Envoyer le message
        await sock.sendMessage(remoteJid, { text: message });

        console.log(`[AbandonedCart] 📤 Reminder sent to ${userId}`);
        return true;
    } catch (error) {
        console.error(`[AbandonedCart] ❌ Error sending reminder to ${userId}:`, error);
        return false;
    }
};

/**
 * Initialise le cron job pour vérifier les paniers abandonnés toutes les 10 minutes
 */
export const startAbandonedCartCron = () => {
    // Vérification immédiate au démarrage (pour test)
    console.log('[AbandonedCart] 🚀 Abandoned Cart Service Started');

    // Exécuter toutes les 10 minutes
    const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

    setInterval(() => {
        checkAbandonedCarts();
    }, INTERVAL_MS);

    // Première vérification après 1 minute (pour éviter la surcharge au démarrage)
    setTimeout(() => {
        checkAbandonedCarts();
    }, 60 * 1000);

    console.log(`[AbandonedCart] ⏰ Cron job scheduled (every ${INTERVAL_MS / 60000} minutes)`);
};
