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
import { generateAIResponse, detectPurchaseIntent, analyzeImage } from './aiService';
import { VariationOption } from '../types';

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
     * Demander un code de jumelage (Pairing Code) pour connexion sans QR
     * Utile si l'utilisateur est sur le même téléphone
     */
    public async requestPairingCode(tenantId: string, phoneNumber: string): Promise<string | undefined> {
        let session = this.sessions.get(tenantId);

        // Si pas de session, on en crée une
        if (!session) {
            await this.createSession(tenantId);
            session = this.sessions.get(tenantId);
        }

        if (!session || !session.sock) {
            throw new Error("Impossible d'initialiser la session WhatsApp");
        }

        // Si déjà connecté, pas besoin
        if (session.status === 'connected') {
            throw new Error("Déjà connecté !");
        }

        // Formater le numéro (enlever + et espaces)
        const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

        // Attendre un peu que le socket soit prêt
        await new Promise(r => setTimeout(r, 2000));

        try {
            console.log(`[Manager] Demande code de jumelage pour ${tenantId} sur le ${cleanPhone}`);
            const code = await session.sock.requestPairingCode(cleanPhone);
            console.log(`[Manager] Code reçu: ${code}`);
            return code;
        } catch (error) {
            console.error(`[Manager] Erreur demande Pairing Code:`, error);
            throw new Error("Échec de la génération du code. Vérifiez le numéro.");
        }
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
            browser: ['Ubuntu', 'Chrome', '20.0.04'], // Standard stable config for Pairing Code
            generateHighQualityLinkPreview: true,
            // syncFullHistory: false, 
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000
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
                    const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    const shouldReconnect = reason !== DisconnectReason.loggedOut;

                    console.log(`[Manager] 🔴 Connexion fermée pour Tenant ${tenantId}. Raison: ${reason}. Reconnect: ${shouldReconnect}`);

                    if (shouldReconnect) {
                        // Infinite Retry Logic (Smart Backoff)
                        // On ne limite plus le nombre d'essais pour garantir la persistance
                        const session = this.sessions.get(tenantId);
                        let delay = 2000; // start 2s

                        if (session) {
                            session.retryCount++;
                            // Exponential backoff maxed at 30s
                            delay = Math.min(session.retryCount * 2000, 30000);
                        }

                        console.log(`[Manager] 🔄 Tentative de reconnexion dans ${delay / 1000}s...`);

                        setTimeout(() => {
                            this.createSession(tenantId).catch(e => console.error(`[Manager] Retry failed:`, e));
                        }, delay);

                    } else {
                        // VRAIE Déconnexion (Logout manuel depuis le téléphone)
                        console.log(`[Manager] ❌ Déconnexion définitive (Logout Manuel). Nettoyage session.`);
                        this.sessions.delete(tenantId);
                        await this.cleanupSession(tenantId);
                        await db.updateTenantWhatsAppStatus(tenantId, 'disconnected');
                    }
                } else if (connection === 'open') {
                    console.log(`[Manager] ✅ Tenant ${tenantId} connecté à WhatsApp ! Stable.`);

                    const session = this.sessions.get(tenantId);
                    if (session) {
                        session.status = 'connected';
                        session.qr = undefined;
                        session.retryCount = 0; // Reset counter on success
                    }

                    // Récupérer le numéro de téléphone connecté
                    const userJid = sock.user?.id;
                    const phoneNumber = userJid ? userJid.split(':')[0] : undefined;

                    await db.updateTenantWhatsAppStatus(tenantId, 'connected', phoneNumber);
                    resolve(undefined); // Connecté, pas de QR à retourner
                }
            });

            // 4. Gestion de l'historique initial (Sync)
            sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
                console.log(`[Manager] 📜 Historique reçu pour Tenant ${tenantId}: ${chats.length} chats, ${messages.length} messages.`);

                const { getSession, addToHistory, updateSession } = await import('./sessionService');

                // 1. Sync Chats (Ensure sessions exist)
                for (const chat of chats) {
                    if (chat.id === 'status@broadcast') continue;
                    if (!chat.id) continue;

                    // Create/Get session to ensure it appears in the list
                    // Using 'updateSession' with partial data can create it if logic allows, 
                    // or better, just getSession which creates it.
                    await getSession(tenantId, chat.id);

                    // Update metadata if available (timestamp, etc.)
                    if (chat.conversationTimestamp) {
                        const timestamp = typeof chat.conversationTimestamp === 'number'
                            ? chat.conversationTimestamp
                            : (chat.conversationTimestamp as Long).toNumber();
                        const date = new Date(timestamp * 1000);
                        await updateSession(tenantId, chat.id, { lastInteraction: date });
                    }
                }

                // 2. Sync Recent Messages (Populate history)
                // messages is a dictionary if coming from history set, or array? 
                // Baileys types: messages: { [jid: string]: proto.IWebMessageInfo[] } | proto.IWebMessageInfo[]
                // Usually it's an array of recent msgs per chat.

                // Note: This matches the structure usually received.
                // We only take the last ~10 messages per chat to avoid overloading DB

                for (const msg of messages) {
                    // If it's an array (unlikely in 'set' but possible in some versions) or valid msg object
                    // Actually 'messaging-history.set' messages is often: { [jid: string]: msgs[] }? 
                    // Checking Baileys docs/types:
                    // It is usually an array of objects for the chats that have new history.

                    // Let's rely on handleMessage with isHistory=true for recent ones
                    if (!msg.key || !msg.key.remoteJid) continue;

                    // Skip very old messages (older than 24h?) to speed up
                    const timestamp = (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : (msg.messageTimestamp as Long)?.toNumber?.() || 0);
                    const isRecent = (Date.now() / 1000 - timestamp) < 86400 * 7; // Last 7 days

                    if (isRecent) {
                        await this.handleMessage(tenantId, sock, msg, true);
                    }
                }
            });

            // 3. Gestion des Messages Entrants (Live)
            sock.ev.on('messages.upsert', async (m) => {
                // On traite tout pour avoir l'historique et les chats dans le dashboard
                // Mais on ne répondra qu'aux nouveaux messages (notify) récents

                for (const msg of m.messages) {
                    try {
                        const msgTimestamp = (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : (msg.messageTimestamp as Long)?.toNumber?.() || Math.floor(Date.now() / 1000));
                        const secondsAgo = Math.floor(Date.now() / 1000) - msgTimestamp;

                        // Considérer comme historique si type 'append' ou vieux de plus de 10 secondes
                        const isHistory = m.type === 'append' || secondsAgo > 10;

                        await this.handleMessage(tenantId, sock, msg, isHistory);
                    } catch (err) {
                        console.error('Error processing message upsert:', err);
                    }
                }
            });
        });
    }

    /**
     * Traitement centralisé des messages par Tenant
     */
    private async handleMessage(tenantId: string, sock: WASocket, msg: proto.IWebMessageInfo, isHistory: boolean = false) {
        try {
            if (!msg.key || !msg.key.remoteJid) return;
            const remoteJid = msg.key.remoteJid;

            // Ignore status updates (broadcasts)
            if (remoteJid === 'status@broadcast') return;

            // Determine content
            let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

            // Si c'est un message envoyé par moi (depuis téléphone ou autre session)
            if (msg.key.fromMe) {
                // On l'ajoute juste à l'historique comme venant du "model" (assistant) pour la cohérence
                if (text) {
                    // Dynamically import to ensure availability
                    const { addToHistory } = await import('./sessionService');
                    await addToHistory(tenantId, remoteJid, 'model', text);
                }
                return;
            }

            // --- AUDIO HANDLING ---
            if (msg.message?.audioMessage) {
                if (isHistory) {
                    text = '[Audio Message]'; // Placeholder for history
                } else {
                    console.log(`[Manager] Audio received from ${remoteJid}`);
                    // Check if voice is enabled for this tenant
                    const { db } = await import('./dbService');
                    const settings = await db.getSettings(tenantId);

                    if (!settings.voiceEnabled) {
                        console.log(`[Manager] Voice disabled for tenant ${tenantId}, ignoring audio`);
                        await sock.sendMessage(remoteJid, {
                            text: "Désolé, je ne peux pas traiter les messages vocaux pour l'instant. Pouvez-vous m'écrire votre demande ?"
                        });
                        return;
                    }

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
                            const transcription = await transcribeAudio(buffer, mimeType);
                            console.log(`[Manager] Audio Transcribed: "${transcription}"`);

                            if (transcription) {
                                text = transcription;
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
            }

            // --- IMAGE HANDLING ---
            if (msg.message?.imageMessage) {
                if (isHistory) {
                    text = `[Image] ${msg.message.imageMessage.caption || ''}`;
                } else {
                    console.log(`[Manager] Image received from ${remoteJid}`);
                    try {
                        const buffer = await downloadMediaMessage(
                            msg as any,
                            'buffer',
                            {}
                        );
                        const mimeType = msg.message?.imageMessage?.mimetype || 'image/jpeg';
                        const caption = msg.message?.imageMessage?.caption || "";

                        // Lazy import analyze
                        const { analyzeImage } = await import('./aiService');
                        const description = await analyzeImage(buffer as Buffer, mimeType, caption);
                        console.log(`[Manager] Image Analysis: "${description}"`);

                        text = `[User sent an Image] Description: ${description}. Caption: ${caption}`;
                    } catch (e) {
                        console.error("Error downloading/analyzing image", e);
                    }
                }
            }

            if (!text) return; // Ignore non-text/non-audio messages

            // Imports
            const { getSession, updateSession, addToHistory, clearHistory, addItemToSessionCart } = await import('./sessionService');
            const { db } = await import('./dbService');
            const { generateAIResponse, detectPurchaseIntent } = await import('./aiService');

            // 0. Update Last Interaction & History regardless of logic
            // This ensures the chat shows up in the Dashboard List immediately
            const currentSession = await getSession(tenantId, remoteJid);

            // Si le nom du contact est dispo dans le message (pushName), on peut update la session ?
            // Mais getSession gère déjà un default.

            await addToHistory(tenantId, remoteJid, 'user', text);

            // *** STOP HERE IF HISTORY OR AUTOPILOT DISABLED ***
            if (isHistory) {
                // Just updating history (done above)
                return;
            }

            console.log(`[Manager] Tenant ${tenantId} reçu de ${remoteJid}: ${text}`);

            // Mark read & Typing
            await sock.readMessages([msg.key]);

            // Simuler une "vraie" pause de réflexion humaine (500ms - 2s)
            await new Promise(r => setTimeout(r, Math.random() * 1500 + 500));
            await sock.sendPresenceUpdate('composing', remoteJid);


            // 1. Récupérer la session (re-fetch updated?)
            const session = await getSession(tenantId, remoteJid);

            // Check Autopilot Status EARLY
            if (session.autopilotEnabled === false) {
                console.log(`[Manager] Autopilot disabled for ${remoteJid}, skipping AI response.`);
                return;
            }

            // 2. Gestion des états (Machine à états simple)
            // ... (rest as before)

            // CAS A : En attente de l'adresse pour finaliser la commande
            if (session.state === 'WAITING_FOR_ADDRESS') {
                const address = text;
                const tempOrder = session.tempOrder;

                if (!tempOrder) {
                    await sock.sendMessage(remoteJid, { text: "Oups, j'ai perdu votre panier. Pouvez-vous recommencer ?" });
                    await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
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
                await clearHistory(tenantId, remoteJid);
                await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined, reminderSent: false });
                return;
            }

            // CAS A.5 : En attente de sélection de variation
            if (session.state === 'WAITING_FOR_VARIATION') {
                const tempOrder = session.tempOrder;
                if (!tempOrder || !tempOrder.productId) {
                    await sock.sendMessage(remoteJid, { text: "Oups, j'ai perdu votre sélection. Pouvez-vous recommencer ?" });
                    await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
                    return;
                }

                // Find the product
                const product = await db.getProductById(tenantId, tempOrder.productId);
                if (!product || !product.variations) {
                    await sock.sendMessage(remoteJid, { text: "Produit non trouvé. Pouvez-vous recommencer ?" });
                    await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
                    return;
                }

                const currentVariation = product.variations[tempOrder.variationIndex];

                // Parse user response - could be number or text
                let selectedOption = null;
                const userInput = text.trim().toLowerCase();

                // Try to match by number first
                const numChoice = parseInt(userInput);
                if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= currentVariation.options.length) {
                    selectedOption = currentVariation.options[numChoice - 1];
                } else {
                    // Try to match by name
                    selectedOption = currentVariation.options.find(
                        opt => opt.value.toLowerCase() === userInput ||
                            opt.value.toLowerCase().includes(userInput)
                    );
                }

                if (!selectedOption) {
                    // Invalid selection
                    const optionsList = currentVariation.options
                        .map((opt, i) => `${i + 1}. ${opt.value}`)
                        .join('\n');
                    await sock.sendMessage(remoteJid, {
                        text: `Je n'ai pas compris votre choix. 🤔\n\nVeuillez choisir une ${currentVariation.name.toLowerCase()} :\n\n${optionsList}\n\n👉 Répondez avec le numéro ou le nom.`
                    });
                    return;
                }

                // Check stock for this option
                // FIX: Only check stock if manageStock is strictly TRUE for the product
                // Note: Variations might have their own stock logic, but for now we follow the product's rule or local stock if present
                const shouldCheckStock = product.manageStock !== false;

                if (shouldCheckStock && selectedOption.stock !== undefined && selectedOption.stock < tempOrder.quantity) {
                    if (selectedOption.stock <= 0) {
                        await sock.sendMessage(remoteJid, {
                            text: `Désolé, ${selectedOption.value} est actuellement épuisé. 😔\n\nVeuillez choisir une autre option.`
                        });
                        return;
                    } else {
                        await sock.sendMessage(remoteJid, {
                            text: `Désolé, il ne reste que ${selectedOption.stock} en ${selectedOption.value}. 📦\n\nVoulez-vous commander ${selectedOption.stock} au lieu de ${tempOrder.quantity} ?`
                        });
                        return;
                    }
                }

                // Add selection to tempOrder
                const newSelectedVariations = [
                    ...(tempOrder.selectedVariations || []),
                    { name: currentVariation.name, value: selectedOption.value }
                ];
                const priceAdjustment = selectedOption.priceModifier || 0;
                const nextVariationIndex = tempOrder.variationIndex + 1;

                // Check if there are more variations to ask
                if (nextVariationIndex < product.variations.length) {
                    // Ask for next variation
                    const nextVariation = product.variations[nextVariationIndex];
                    const optionsList = nextVariation.options
                        .map((opt, i) => {
                            let optText = `${i + 1}. ${opt.value}`;
                            if (opt.priceModifier && opt.priceModifier !== 0) {
                                optText += ` (${opt.priceModifier > 0 ? '+' : ''}${opt.priceModifier} FCFA)`;
                            }
                            return optText;
                        })
                        .join('\n');

                    await updateSession(tenantId, remoteJid, {
                        tempOrder: {
                            ...tempOrder,
                            variationIndex: nextVariationIndex,
                            selectedVariations: newSelectedVariations,
                            priceAdjustment: (tempOrder.priceAdjustment || 0) + priceAdjustment
                        }
                    });

                    await sock.sendMessage(remoteJid, {
                        text: `Parfait, ${selectedOption.value} ! ✅\n\nQuelle ${nextVariation.name.toLowerCase()} souhaitez-vous ?\n\n${optionsList}`
                    });
                    return;
                }

                // All variations selected - proceed to checkout
                const finalPrice = tempOrder.basePrice + (tempOrder.priceAdjustment || 0) + priceAdjustment;
                const total = finalPrice * tempOrder.quantity;
                const variationsSummary = newSelectedVariations.map(v => `${v.name}: ${v.value}`).join(', ');

                // Create cart item with variations
                // Create cart item with variations
                const cartItem = {
                    productId: product.id,
                    productName: product.name,
                    quantity: tempOrder.quantity,
                    price: finalPrice,
                    selectedVariations: newSelectedVariations
                };

                // Add to persistent session cart
                const updatedTempOrder = await addItemToSessionCart(tenantId, remoteJid, cartItem);

                await updateSession(tenantId, remoteJid, {
                    state: 'WAITING_FOR_ADDRESS'
                });

                // Recalculate total from the FULL cart, not just this item (though usually valid to show full total)
                const fullTotal = updatedTempOrder.total;

                await sock.sendMessage(remoteJid, {
                    text: `Excellent choix ! 🎉\n\n📦 ${tempOrder.quantity}x ${product.name}\n📝 ${variationsSummary}\n💰 Total: ${total} FCFA\n\nÀ quelle adresse (quartier, ville) doit-on livrer ?`
                });

                await addToHistory(tenantId, remoteJid, 'user', text);
                await addToHistory(tenantId, remoteJid, 'model', `[Variations selected: ${variationsSummary}]`);

                // Log Activity: Checkout Initiated
                await db.logActivity(tenantId, 'sale', `Nouveau panier : ${tempOrder.quantity}x ${product.name} (${variationsSummary}) - ${total} FCFA`);
                return;
            }

            // CAS B : Flux Normal (IDLE)

            // 3. Récupérer le contexte du Tenant pour l'IA
            const settings = await db.getSettings(tenantId);
            const products = await db.getProducts(tenantId);
            const productContext = products.map(p => {
                let info = `${p.name} (${p.price} FCFA)`;
                if (p.variations && p.variations.length > 0) {
                    const varText = p.variations.map(v =>
                        `${v.name}: ${v.options.map(o => o.value).join('/')}`
                    ).join(', ');
                    info += ` [Variations: ${varText}]`;
                }
                return info;
            }).join(', ');

            // 4. Détection d'Intention (Achat vs Discussion)
            const intentData = await detectPurchaseIntent(text, productContext);

            if (intentData.intent === 'BUY' && intentData.productName) {
                // Trouver le produit exact
                const product = await db.getProductByName(tenantId, intentData.productName);

                if (product) {
                    let qty = intentData.quantity || 1;

                    // === Check if product has variations ===
                    if (product.variations && product.variations.length > 0) {
                        // Product has variations - need to ask customer to choose
                        const firstVariation = product.variations[0];
                        const optionsList = firstVariation.options
                            .map((opt, i) => {
                                let optText = `${i + 1}. ${opt.value}`;
                                if (opt.priceModifier && opt.priceModifier !== 0) {
                                    optText += ` (${opt.priceModifier > 0 ? '+' : ''}${opt.priceModifier} FCFA)`;
                                }
                                if (opt.stock !== undefined) {
                                    if (product.manageStock === false) {
                                        optText += ''; // Flexible stock, don't show limit
                                    } else {
                                        optText += opt.stock > 0 ? ` [${opt.stock} en stock]` : ' [Épuisé]';
                                    }
                                }
                                return optText;
                            })
                            .join('\n');

                        // Save pending variation selection in session
                        await updateSession(tenantId, remoteJid, {
                            state: 'WAITING_FOR_VARIATION',
                            tempOrder: {
                                productId: product.id,
                                productName: product.name,
                                basePrice: product.price,
                                quantity: qty,
                                variationIndex: 0, // Currently asking for first variation
                                selectedVariations: [],
                                items: [],
                                total: 0,
                                summary: ''
                            }
                        });

                        await sock.sendMessage(remoteJid, {
                            image: product.images && product.images.length > 0 ? { url: product.images[0] } : undefined,
                            text: `Super choix ! 🎉 ${product.name} à ${product.price} FCFA.\n\nQuelle ${firstVariation.name.toLowerCase()} souhaitez-vous ?\n\n${optionsList}\n\n👉 Répondez avec le numéro ou le nom de votre choix.`
                        } as any);

                        await addToHistory(tenantId, remoteJid, 'user', text);
                        await addToHistory(tenantId, remoteJid, 'model', `[Variation selection started for ${product.name}]`);

                        await db.logActivity(tenantId, 'action', `Client intéressé par ${product.name} (Choix des options)`);
                        return;
                    }

                    // === Product without variations - normal flow ===
                    // Vérifier le stock disponible (Seulement si manageStock est true)
                    if (product.manageStock !== false && product.stock !== undefined && product.stock < qty) {
                        if (product.stock <= 0) {
                            // Produit épuisé
                            await sock.sendMessage(remoteJid, {
                                text: `Désolé, ${product.name} est actuellement en rupture de stock. 😔\n\nVoulez-vous que je vous prévienne quand il sera de nouveau disponible ?`
                            });
                            await addToHistory(tenantId, remoteJid, 'user', text);
                            await addToHistory(tenantId, remoteJid, 'model', `[Stock insuffisant: ${product.name} épuisé]`);
                            return;
                        } else {
                            // Stock insuffisant mais pas nul - proposer le max disponible
                            await sock.sendMessage(remoteJid, {
                                text: `Oups ! Il ne reste que ${product.stock} ${product.name} en stock. 📦\n\nVoulez-vous commander les ${product.stock} disponibles pour ${product.stock * product.price} FCFA ?`
                            });
                            await addToHistory(tenantId, remoteJid, 'user', text);
                            await addToHistory(tenantId, remoteJid, 'model', `[Stock insuffisant: ${qty} demandés, ${product.stock} disponibles]`);
                            return;
                        }
                    }

                    // Ajouter au panier (stock suffisant)
                    // const cart = await db.addToCart(tenantId, remoteJid, product, qty); // DEPRECATED: Local only

                    const cartItem = {
                        productId: product.id,
                        productName: product.name,
                        quantity: qty,
                        price: product.price
                    };

                    // Add to session cart
                    const updatedTempOrder = await addItemToSessionCart(tenantId, remoteJid, cartItem);
                    const total = updatedTempOrder.total;

                    // Passer en mode "Checkout"
                    await updateSession(tenantId, remoteJid, {
                        state: 'WAITING_FOR_ADDRESS'
                    });

                    await sock.sendMessage(remoteJid, {
                        image: product.images && product.images.length > 0 ? { url: product.images[0] } : undefined,
                        text: `C'est noté ! J'ai mis ${qty}x ${product.name} de côté pour vous.\n\nLe total est de ${total} FCFA. 🛒\n\nÀ quelle adresse (quartier, ville) doit-on livrer ?`
                    } as any);

                    await addToHistory(tenantId, remoteJid, 'user', text);
                    await addToHistory(tenantId, remoteJid, 'model', `[Checkout initiated for ${product.name}]`);

                    // Log Activity: Checkout Initiated
                    await db.logActivity(tenantId, 'sale', `Nouveau panier : ${qty}x ${product.name} - ${total} FCFA`);
                    return;
                }
            }

            // 5. Réponse IA Standard (Chat / Info produit / Négociation)
            const inventoryContext = products.map(p => {
                const stockStatus = p.manageStock === false
                    ? 'Stock: Illimité (Flexible)'
                    : (p.stock > 0 ? `Stock: ${p.stock}` : 'Épuisé');

                let productInfo = `- ${p.name}: ${p.price} FCFA ${p.minPrice ? `(Min: ${p.minPrice})` : ''} | ${stockStatus}`;

                // Include Variations Detail (with Image URLs)
                if (p.variations && p.variations.length > 0) {
                    p.variations.forEach((v: any) => { // Use 'any' or defined interface
                        if (v.name && v.options) {
                            productInfo += `\n  * Variation [${v.name}]:`;
                            v.options.forEach((opt: any) => {
                                let imgInfo = opt.images && opt.images.length > 0 ? ` [IMAGES_AVAILABLE: ${opt.images.join(', ')}]` : '';
                                const mod = opt.priceModifier || 0;
                                const total = p.price + mod;
                                const sign = mod > 0 ? '+' : '';
                                const priceInfo = mod !== 0 ? `Prix: ${sign}${mod} (Total: ${total} FCFA)` : `Prix: Base (${total} FCFA)`;
                                const optStockInfo = p.manageStock === false ? 'Stock: Illimité' : `Stock: ${opt.stock ?? '∞'}`;
                                productInfo += `\n    - Option: "${opt.value}" | ${optStockInfo} | ${priceInfo}${imgInfo}`;
                            });
                        }
                    });
                } else if (p.images && p.images.length > 0) {
                    productInfo += ` [MAIN_IMAGES: ${p.images.join(', ')}]`;
                }

                if (p.aiInstructions) {
                    productInfo += `\n  📋 Consignes: ${p.aiInstructions}`;
                }
                return productInfo;
            }).join('\n');

            const aiResponse = await generateAIResponse(text, {
                settings,
                inventoryContext,
                history: session.history
            });

            // Parse response for [IMAGE: url] tag
            const imageMatch = aiResponse.match(/\[IMAGE:\s*(.*?)\]/);

            if (imageMatch && imageMatch[1]) {
                const imageUrl = imageMatch[1].trim();
                const cleanText = aiResponse.replace(/\[IMAGE:.*?\]/g, '').trim();

                // Send Image Message
                await sock.sendMessage(remoteJid, {
                    image: { url: imageUrl },
                    caption: cleanText
                });
            } else {
                // Send Text Message
                await sock.sendMessage(remoteJid, { text: aiResponse });
            }

            // Mise à jour de l'historique
            await addToHistory(tenantId, remoteJid, 'user', text);
            await addToHistory(tenantId, remoteJid, 'model', aiResponse);

            // Log General Interaction if meaningful (avoid overwhelming logs for 'Bonjour')
            if (aiResponse.length > 20) {
                // await db.logActivity(tenantId, 'info', `Discussion IA: "${aiResponse.substring(0, 50)}..."`);
            }

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
