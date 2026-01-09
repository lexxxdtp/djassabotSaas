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

            // --- IMAGE HANDLING ---
            if (msg.message?.imageMessage) {
                console.log(`[Manager] Image received from ${remoteJid}`);
                try {
                    const buffer = await downloadMediaMessage(
                        msg as any,
                        'buffer',
                        {}
                    );
                    const mimeType = msg.message?.imageMessage?.mimetype || 'image/jpeg';
                    const caption = msg.message?.imageMessage?.caption || "";

                    const description = await analyzeImage(buffer as Buffer, mimeType, caption);
                    console.log(`[Manager] Image Analysis: "${description}"`);

                    // Inject into text flow
                    text = `[User sent an Image] Description: ${description}. Caption: ${caption}`;

                } catch (e) {
                    console.error("Error downloading/analyzing image", e);
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
            const session = await getSession(tenantId, remoteJid);

            // 2. Gestion des états (Machine à états simple)

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
                if (selectedOption.stock !== undefined && selectedOption.stock < tempOrder.quantity) {
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
                const cartItem = {
                    productId: product.id,
                    productName: product.name,
                    quantity: tempOrder.quantity,
                    price: finalPrice,
                    selectedVariations: newSelectedVariations
                };

                await updateSession(tenantId, remoteJid, {
                    state: 'WAITING_FOR_ADDRESS',
                    tempOrder: {
                        items: [cartItem],
                        total: total,
                        summary: `${tempOrder.quantity}x ${product.name} (${variationsSummary})`
                    }
                });

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
            const productContext = products.map(p => `${p.name} (${p.price} FCFA)`).join(', ');

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
                                    optText += opt.stock > 0 ? ` [${opt.stock} en stock]` : ' [Épuisé]';
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
                    // Vérifier le stock disponible
                    if (product.stock !== undefined && product.stock < qty) {
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
                    const cart = await db.addToCart(tenantId, remoteJid, product, qty);

                    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                    // Passer en mode "Checkout"
                    await updateSession(tenantId, remoteJid, {
                        state: 'WAITING_FOR_ADDRESS',
                        tempOrder: {
                            items: cart,
                            total: total,
                            summary: `${qty}x ${product.name}`
                        }
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
                let productInfo = `- ${p.name}: ${p.price} FCFA ${p.minPrice ? `(Min: ${p.minPrice})` : ''} | ${p.stock > 0 ? 'En stock' : 'Épuisé'}`;

                // Include Variations Detail (with Image URLs)
                if (p.variations && p.variations.length > 0) {
                    p.variations.forEach((v: any) => { // Use 'any' or defined interface
                        if (v.name && v.options) {
                            productInfo += `\n  * Variation [${v.name}]:`;
                            v.options.forEach((opt: any) => {
                                let imgInfo = opt.images && opt.images.length > 0 ? ` [IMAGES_AVAILABLE: ${opt.images.join(', ')}]` : '';
                                productInfo += `\n    - Option: "${opt.value}" | Stock: ${opt.stock ?? '∞'} | Prix: ${opt.priceModifier ? (opt.priceModifier > 0 ? '+' : '') + opt.priceModifier : '+0'}${imgInfo}`;
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
