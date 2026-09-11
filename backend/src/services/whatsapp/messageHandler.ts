import { WASocket, proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import { db } from '../dbService';
import { handleFlow } from './flowHandler';
import { transcribeAudio, analyzeImage, analyzePaymentReceipt } from '../aiService';
import { addToHistory, getSession } from '../sessionService';
import { processReceiptValidation } from '../paymentValidationService';
import { Product } from '../../types';

/**
 * File d'attente PAR CONVERSATION : les messages d'un même client sont traités
 * strictement dans l'ordre, un à la fois. Sans ça, deux messages rapprochés
 * (fréquent sur WhatsApp) se traitent en parallèle et se marchent dessus sur
 * l'état de session (panier, WAITING_FOR_ADDRESS…).
 */
const chatQueues = new Map<string, Promise<void>>();

const enqueue = (key: string, fn: () => Promise<void>): Promise<void> => {
    const prev = chatQueues.get(key) || Promise.resolve();
    const next = prev.then(fn, fn); // on traite même si le message précédent a échoué
    chatQueues.set(key, next);
    next.finally(() => {
        if (chatQueues.get(key) === next) chatQueues.delete(key);
    });
    return next;
};

/**
 * Messages déjà traités, pour ne pas répondre deux fois au même.
 *
 * WhatsApp relivre un message après une reconnexion ou une resynchronisation,
 * et un socket remplacé peut livrer ce que le nouveau livre aussi.
 *
 * Limite assumée : cette mémoire est celle du processus. Un redémarrage l'efface,
 * donc un message relivré juste après un redémarrage peut encore passer deux
 * fois. Une déduplication persistante reste à faire.
 */
const DEDUP_TTL_MS = 10 * 60 * 1000;
const DEDUP_MAX = 5000;
const seenMessages = new Map<string, number>();

const alreadySeen = (key: string): boolean => {
    const now = Date.now();
    const seenAt = seenMessages.get(key);
    if (seenAt !== undefined && now - seenAt < DEDUP_TTL_MS) return true;

    seenMessages.set(key, now);
    if (seenMessages.size > DEDUP_MAX) {
        for (const [id, at] of seenMessages) {
            if (now - at >= DEDUP_TTL_MS) seenMessages.delete(id);
        }
        // Purge par ancienneté si tout est encore récent (Map conserve l'ordre d'insertion).
        while (seenMessages.size > DEDUP_MAX) {
            const oldest = seenMessages.keys().next().value;
            if (oldest === undefined) break;
            seenMessages.delete(oldest);
        }
    }
    return false;
};

export async function handleMessage(tenantId: string, sock: WASocket, msg: proto.IWebMessageInfo, isHistory: boolean = false) {
    if (!msg.key || !msg.key.remoteJid) return;
    const remoteJid = msg.key.remoteJid;

    // La vente automatisée concerne uniquement les discussions individuelles.
    if (remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@g.us') || remoteJid.endsWith('@newsletter')) return;

    if (msg.key.id && alreadySeen(`${tenantId}:${remoteJid}:${msg.key.id}`)) return;

    await enqueue(`${tenantId}:${remoteJid}`, () => processMessage(tenantId, sock, msg, remoteJid, isHistory));
}

async function processMessage(tenantId: string, sock: WASocket, msg: proto.IWebMessageInfo, remoteJid: string, isHistory: boolean) {
    let botPaused = true; // par défaut prudent : ne jamais répondre si on ne sait pas
    // Réutilisés par handleFlow pour éviter de refaire les mêmes lectures Supabase
    // (settings est déjà lu ici pour botActive/abonnement ; products si l'image en a eu besoin).
    let preloadedProducts: Product[] | undefined;

    try {
        let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

        // Handle Self Messages (just log to history)
        if (msg.key!.fromMe) {
            if (text) {
                await addToHistory(tenantId, remoteJid, 'model', text);
            }
            return;
        }

        // INTERRUPTEUR GLOBAL — lu une seule fois, utilisé partout dans ce handler
        const settings = await db.getSettings(tenantId);
        botPaused = settings.botActive === false;
        const conversation = await getSession(tenantId, remoteJid);
        botPaused = botPaused || conversation.autopilotEnabled === false;

        // ABONNEMENT EXPIRÉ = bot muet (même comportement qu'une mise en pause) :
        // le message est enregistré dans l'Inbox mais AUCUNE réponse ni validation
        // de reçu ne part. La session WhatsApp reste connectée (pas besoin de
        // rescanner le QR au renouvellement) ; le vendeur est prévenu côté dashboard
        // (402 → écran de renouvellement). On ne teste l'abonnement que si le bot
        // n'est pas déjà en pause, pour éviter une requête inutile.
        if (!botPaused) {
            const subActive = await db.isSubscriptionActive(tenantId);
            if (!subActive) botPaused = true;
        }

        // Les médias restent visibles dans l'historique sans téléchargement ni IA
        // lorsque le vendeur a repris la main ou que l'abonnement est inactif.
        if (msg.message?.audioMessage) {
            text = '[Message vocal]';
            if (!isHistory && !botPaused) {
                const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
                const mimeType = msg.message.audioMessage.mimetype || 'audio/ogg';
                const transcription = buffer instanceof Buffer ? await transcribeAudio(buffer, mimeType) : '';
                if (!transcription?.trim()) {
                    await addToHistory(tenantId, remoteJid, 'user', '[Message vocal non transcrit]');
                    throw new Error('Transcription vocale indisponible');
                }
                text = transcription;
            }
        }

        // --- IMAGE ---
        if (msg.message?.imageMessage) {
            if (isHistory || botPaused) {
                text = `[Image] ${msg.message.imageMessage.caption || ''}`;
            } else {
                const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
                const mimeType = msg.message?.imageMessage?.mimetype || 'image/jpeg';
                const caption = msg.message?.imageMessage?.caption || "";

                // Try to validate as a payment receipt first (jamais quand le bot est en pause :
                // processReceiptValidation envoie des messages au client)
                if (!botPaused) {
                    const receiptAnalysis = await analyzePaymentReceipt(buffer as Buffer, mimeType);
                    if (receiptAnalysis.isReceipt) {
                        const validated = await processReceiptValidation(tenantId, remoteJid, receiptAnalysis, sock);
                        if (validated) {
                            await addToHistory(tenantId, remoteJid, 'user', `[Reçu de paiement envoyé] Montant: ${receiptAnalysis.amount} FCFA, Réf: ${receiptAnalysis.transactionId}, Opérateur: ${receiptAnalysis.provider}`);
                            return;
                        }
                    }
                }

                // Get inventory context for image analysis
                preloadedProducts = await db.getProducts(tenantId);
                const inventoryContext = preloadedProducts.map((p: any) => `- ${p.name}`).join('\n'); // Simplified context for image
                const description = await analyzeImage(buffer as Buffer, mimeType, caption, inventoryContext);
                text = `[User sent an Image] Description: ${description}. Caption: ${caption}`;
            }
        }

        if (!text) return;

        // Add User Message to History
        await addToHistory(tenantId, remoteJid, 'user', text);

        if (isHistory) return;

        // INTERRUPTEUR GLOBAL : si le bot est en pause, on enregistre le message
        // (visible dans l'Inbox) mais on ne répond JAMAIS.
        if (botPaused) return;

        // Mark Read & Typing
        await sock.readMessages([msg.key!]);
        await sock.sendPresenceUpdate('composing', remoteJid);

        // DELAY SIMULATION
        await new Promise(r => setTimeout(r, Math.random() * 1000 + 500));

        // ROUTE TO FLOW — on transmet ce qu'on a déjà lu pour éviter les doublons
        await handleFlow(tenantId, remoteJid, text, sock, {}, { settings, products: preloadedProducts });

    } catch (e) {
        console.error('Error in messageHandler:', e);
        // Le client ne doit pas rester sans réponse sur un crash technique
        if (!isHistory && !msg.key?.fromMe && !botPaused) {
            try {
                await sock.sendMessage(remoteJid, { text: 'Petit souci technique de mon côté 🙏 Pouvez-vous renvoyer votre message ?' });
            } catch { /* la connexion est peut-être la cause — on ne boucle pas */ }
        }
    }
}
