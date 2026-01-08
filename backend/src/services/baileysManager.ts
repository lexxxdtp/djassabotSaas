import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WASocket,
    Contact,
    proto,
    downloadMediaMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { db } from './dbService';
import { generateAIResponse, detectPurchaseIntent } from './aiService';

// Logger clean
const logger = pino({ level: 'error' });

interface SessionData {
    sock: WASocket;
    qr?: string;
    status: 'connecting' | 'connected' | 'disconnected';
    retryCount: number;
}

class WhatsAppManager {
    private sessions: Map<string, SessionData> = new Map();
    private MAX_RETRIES = 5;

    constructor() {
        // Au démarrage, on pourrait recharger les sessions actives
        // Pour l'instant on le fera à la demande ou au boot
    }

    /**
     * Initialiser ou récupérer une session pour un tenant
     */
    public async getSession(tenantId: string): Promise<SessionData | undefined> {
        return this.sessions.get(tenantId);
    }

    /**
     * Créer une nouvelle connexion pour un tenant
     */
    public async createSession(tenantId: string): Promise<string | undefined> {
        // Si session existe et connectée, retourner null (pas besoin de QR)
        const existing = this.sessions.get(tenantId);
        if (existing?.status === 'connected') return undefined;

        // AUTH FOLDER UNIQUE PAR TENANT
        const authPath = path.join(__dirname, `../../auth_info_baileys/tenant_${tenantId}`);
        if (!fs.existsSync(authPath)) {
            fs.mkdirSync(authPath, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger,
            printQRInTerminal: false, // On gère le QR nous-mêmes via API
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            browser: ['Tdjaasa Bot', 'Chrome', '1.0.0'],
            generateHighQualityLinkPreview: true,
        });

        // Stocker la session temporairement
        this.sessions.set(tenantId, {
            sock,
            status: 'connecting',
            retryCount: 0
        });

        // Gestion des événements
        sock.ev.on('creds.update', saveCreds);

        return new Promise((resolve) => {
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // 1. Gestion du QR Code
                if (qr) {
                    console.log(`[Manager] QR Code généré pour Tenant ${tenantId}`);
                    const session = this.sessions.get(tenantId);
                    if (session) session.qr = qr;

                    // Sauvegarder QR en DB pour le frontend
                    await db.updateTenantQRCode(tenantId, qr);
                    resolve(qr); // On retourne le QR dès qu'il est dispo
                }

                // 2. Gestion de la Connexion
                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log(`[Manager] Connexion fermée pour Tenant ${tenantId}. Reconnect: ${shouldReconnect}`);

                    if (shouldReconnect) {
                        const session = this.sessions.get(tenantId);
                        if (session && session.retryCount < this.MAX_RETRIES) {
                            session.retryCount++;
                            // Retry simple
                            this.createSession(tenantId);
                        }
                    } else {
                        // Logged out
                        this.sessions.delete(tenantId);
                        await this.cleanupSession(tenantId);
                        await db.updateTenantWhatsAppStatus(tenantId, 'disconnected');
                    }
                } else if (connection === 'open') {
                    console.log(`[Manager] ✅ Tenant ${tenantId} connecté à WhatsApp !`);

                    const session = this.sessions.get(tenantId);
                    if (session) {
                        session.status = 'connected';
                        session.qr = undefined; // Plus besoin de QR
                        session.retryCount = 0;
                    }

                    // Récupérer le numéro de téléphone connecté
                    const userJid = sock.user?.id;
                    const phoneNumber = userJid ? userJid.split(':')[0] : undefined;

                    await db.updateTenantWhatsAppStatus(tenantId, 'connected', phoneNumber);
                    resolve(undefined); // Connecté, pas de QR à retourner
                }
            });

            // 3. Gestion des Messages Entrants
            sock.ev.on('messages.upsert', async (m) => {
                if (m.type !== 'notify') return;

                for (const msg of m.messages) {
                    if (!msg.key.fromMe && m.type === 'notify') {
                        await this.handleMessage(tenantId, sock, msg);
                    }
                }
            });
        });
    }

    /**
     * Traitement centralisé des messages par Tenant
     */
    private async handleMessage(tenantId: string, sock: WASocket, msg: proto.IWebMessageInfo) {
        try {
            if (!msg.key || !msg.key.remoteJid) return;

            const remoteJid = msg.key.remoteJid;
            let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

            // --- AUDIO HANDLING ---
            if (msg.message?.audioMessage) {
                console.log(`[Manager] Audio received from ${remoteJid}`);
                try {
                    // Check if transcribeAudio is available (dynamic import context)
                    const { transcribeAudio } = await import('./aiService');

                    const buffer = await downloadMediaMessage(
                        msg as any,
                        'buffer',
                        {}
                    );

                    const mimeType = msg.message?.audioMessage?.mimetype || 'audio/ogg';
                    if (buffer instanceof Buffer) {
                        // Default to ogg if mimetype contains 'ogg' or 'opus', otherwise try to pass as is or map?
                        // Gemini is flexible. Let's pass what we get.
                        const transcription = await transcribeAudio(buffer, mimeType);
                        console.log(`[Manager] Audio Transcribed: "${transcription}"`);

                        // If transcription valid, treat as text
                        if (transcription) {
                            text = transcription;
                            // Optional: Send a receipts/reaction instead of text?
                            // await sock.sendMessage(remoteJid, { text: `(Transcription: "${transcription}")` }); 
                        } else {
                            await sock.sendMessage(remoteJid, { text: "Je n'ai pas réussi à écouter votre message vocal. Pouvez-vous l'écrire ?" });
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Error downloading/transcribing audio", e);
                    return;
                }
            }

            if (!text) return; // Ignore non-text/non-audio messages

            console.log(`[Manager] Tenant ${tenantId} reçu de ${remoteJid}: ${text}`);

            // Mark read & Typing
            await sock.readMessages([msg.key]);

            // Simuler une "vraie" pause de réflexion humaine (500ms - 2s)
            await new Promise(r => setTimeout(r, Math.random() * 1500 + 500));
            await sock.sendPresenceUpdate('composing', remoteJid);

            // Import dynamique pour éviter les cycles si besoin, ou utiliser les imports existants
            // Note: Assurez-vous que ces imports existent en haut du fichier
            const { getSession, updateSession, addToHistory, clearHistory } = await import('./sessionService');
            // const { db } = await import('./dbService'); // Déjà importé
            // const { generateAIResponse, detectPurchaseIntent } = await import('./aiService'); // Déjà importé

            // 1. Récupérer la session utilisateur (Multi-Tenant Key)
            const session = getSession(tenantId, remoteJid);

            // 2. Gestion des états (Machine à états simple)

            // CAS A : En attente de l'adresse pour finaliser la commande
            if (session.state === 'WAITING_FOR_ADDRESS') {
                const address = text;
                const tempOrder = session.tempOrder;

                if (!tempOrder) {
                    await sock.sendMessage(remoteJid, { text: "Oups, j'ai perdu votre panier. Pouvez-vous recommencer ?" });
                    updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
                    return;
                }

                // Créer la commande
                const order = await db.createOrder(tenantId, remoteJid, tempOrder.items, tempOrder.total, address);

                // TODO: Générer lien de paiement Wave ici si activé
                // const paymentLink = ... 

                await sock.sendMessage(remoteJid, {
                    text: `✅ Merci ! Commande validée.\n\n📍 Livraison: ${address}\n💰 Total: ${tempOrder.total} FCFA\n\nNous vous contacterons très bientôt pour la livraison.`
                });

                // Notifier le vendeur (via Socket interne, Email, ou Push) ou juste log pour l'instant
                console.log(`[ORDER] Nouvelle commande pour Tenant ${tenantId} de ${remoteJid}`);

                // Nettoyer
                await db.clearCart(tenantId, remoteJid);
                clearHistory(tenantId, remoteJid);
                updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined, reminderSent: false });
                return;
            }

            // CAS B : Flux Normal (IDLE)

            // 3. Récupérer le contexte du Tenant pour l'IA
            const settings = await db.getSettings(tenantId);
            const products = await db.getProducts(tenantId);
            const productContext = products.map(p => `${p.name} (${p.price} FCFA)`).join(', ');

            // 4. Détection d'Intention (Achat vs Discussion)
            const intentData = await detectPurchaseIntent(text, productContext);

            if (intentData.intent === 'BUY' && intentData.productName) {
                // Trouver le produit exact
                const product = await db.getProductByName(tenantId, intentData.productName);

                if (product) {
                    // Ajouter au panier
                    const qty = intentData.quantity || 1;
                    const cart = await db.addToCart(tenantId, remoteJid, product, qty);

                    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                    // Passer en mode "Checkout"
                    updateSession(tenantId, remoteJid, {
                        state: 'WAITING_FOR_ADDRESS',
                        tempOrder: {
                            items: cart,
                            total: total,
                            summary: `${qty}x ${product.name}`
                        }
                    });

                    await sock.sendMessage(remoteJid, {
                        text: `C'est noté ! J'ai mis ${qty}x ${product.name} de côté pour vous.\n\nLe total est de ${total} FCFA. 🛒\n\nÀ quelle adresse (quartier, ville) doit-on livrer ?`
                    });

                    addToHistory(tenantId, remoteJid, 'user', text);
                    addToHistory(tenantId, remoteJid, 'model', `[Checkout initiated for ${product.name}]`);
                    return;
                }
            }

            // 5. Réponse IA Standard (Chat / Info produit / Négociation)
            const inventoryContext = products.map(p =>
                `- ${p.name}: Public Price ${p.price} FCFA ${p.minPrice ? `(Min: ${p.minPrice})` : ''} | ${p.stock > 0 ? 'En stock' : 'Épuisé'}`
            ).join('\n');

            const aiResponse = await generateAIResponse(text, {
                settings,
                inventoryContext,
                history: session.history
            });

            await sock.sendMessage(remoteJid, { text: aiResponse });

            // Mise à jour de l'historique
            addToHistory(tenantId, remoteJid, 'user', text);
            addToHistory(tenantId, remoteJid, 'model', aiResponse);

        } catch (error) {
            console.error(`[Manager] Erreur traitement message pour Tenant ${tenantId}:`, error);
        }
    }

    /**
     * Déconnecter un tenant
     */
    public async disconnect(tenantId: string) {
        const session = this.sessions.get(tenantId);
        if (session) {
            session.sock.end(undefined);
            this.sessions.delete(tenantId);
        }
        await this.cleanupSession(tenantId);
        await db.updateTenantWhatsAppStatus(tenantId, 'disconnected');
    }

    private async cleanupSession(tenantId: string) {
        const authPath = path.join(__dirname, `../../auth_info_baileys/tenant_${tenantId}`);
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
    }
}

// Singleton export
export const whatsappManager = new WhatsAppManager();

export const startAllTenantInstances = async () => {
    console.log('[Startup] Vérification des tenants WhatsApp...');
    const tenants = await db.getActiveTenants();

    for (const tenant of tenants) {
        // Support camelCase (local) or snake_case (potential supabase raw)
        const isConnected = tenant.whatsappConnected || (tenant as any).whatsapp_connected === true;
        const status = tenant.whatsappStatus || (tenant as any).whatsapp_status;

        if (isConnected || status === 'connected') {
            console.log(`[Startup] Démarrage du bot pour tenant ${tenant.id} (${tenant.name})`);
            await whatsappManager.createSession(tenant.id);
        }
    }
};
