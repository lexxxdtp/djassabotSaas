import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WASocket,
    Contact,
    proto
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
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

            if (!text) return; // Ignorer les messages non-texte pour l'instant

            console.log(`[Manager] Tenant ${tenantId} reçu de ${remoteJid}: ${text}`);

            // Mark read & Typing
            await sock.readMessages([msg.key]);
            await sock.sendPresenceUpdate('composing', remoteJid);

            // --- DEBUT LOGIQUE METIER TENANT ---

            // 1. Récupérer le contexte du Tenant
            const settings = await db.getSettings(tenantId);
            const products = await db.getProducts(tenantId);

            // 2. Construire le contexte 'Inventaire'
            const inventoryContext = products.map(p =>
                `- ${p.name} (${p.price} FCFA): ${p.stock > 0 ? 'En stock' : 'Épuisé'}`
            ).join('\n');

            // 3. Détection d'intention (Achat ?)
            // Note: On pourrait passer le msg à l'AI direct, 
            // mais l'intent detection rapide permet de gérer le panier

            // TODO: Intégrer la logique panier ici (sessionService adapté multi-tenant)
            // Pour l'instant, réponse AI simple

            const aiResponse = await generateAIResponse(text, {
                settings,
                inventoryContext,
                // history: ... (TODO: Ajouter historyService per tenant)
            });

            // 4. Envoyer la réponse
            await sock.sendMessage(remoteJid, { text: aiResponse });

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
