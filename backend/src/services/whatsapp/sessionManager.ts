import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { db } from '../dbService';
import { handleMessage } from './messageHandler';

// Logger clean
const logger = pino({ level: 'error' });

export interface SessionData {
    sock: WASocket;
    qr?: string;
    status: 'connecting' | 'connected' | 'disconnected';
    retryCount: number;
}

export class SessionManager {
    private sessions: Map<string, SessionData> = new Map();
    private MAX_RETRIES = 5;

    constructor() { }

    public getSession(tenantId: string): SessionData | undefined {
        return this.sessions.get(tenantId);
    }

    public getSessionStatus(tenantId: string): { status: string; exists: boolean } {
        const session = this.sessions.get(tenantId);
        return {
            exists: !!session,
            status: session?.status || 'ABSENT'
        };
    }

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
        let cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

        if (cleanPhone.length < 5) {
            throw new Error("Numéro trop court.");
        }

        console.log(`[Manager] Pairing for: ${cleanPhone}`);

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

    public async createSession(tenantId: string, onConnectionUpdate?: (update: any, sock: WASocket) => void): Promise<string | undefined> {
        // Si session existe et connectée, retourner null (pas besoin de QR)
        const existing = this.sessions.get(tenantId);
        if (existing?.status === 'connected') return undefined;

        // AUTH FOLDER UNIQUE PAR TENANT
        const authPath = path.join(__dirname, `../../../auth_info_baileys/tenant_${tenantId}`);
        if (!fs.existsSync(authPath)) {
            fs.mkdirSync(authPath, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: false,
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

        // BIND MESSAGE LISTENER
        sock.ev.on('messages.upsert', async (m) => {
            console.log(`[Manager] 📨 Messages reçus pour ${tenantId} - Count: ${m.messages.length}`);
            for (const msg of m.messages) {
                try {
                    const msgTimestamp = (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : (msg.messageTimestamp as any)?.toNumber?.() || Math.floor(Date.now() / 1000));
                    const secondsAgo = Math.floor(Date.now() / 1000) - msgTimestamp;
                    if (secondsAgo > 60) continue; // Skip old

                    const isHistory = m.type === 'append' || secondsAgo > 10;
                    await handleMessage(tenantId, sock, msg, isHistory);
                } catch (e) {
                    console.error('Error handling message', e);
                }
            }
        });

        return new Promise((resolve) => {
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // 1. Gestion du QR Code
                if (qr) {
                    console.log(`[Manager] QR Code généré pour Tenant ${tenantId}`);
                    const session = this.sessions.get(tenantId);
                    if (session) session.qr = qr;

                    await db.updateTenantQRCode(tenantId, qr);
                    resolve(qr);
                }

                // 2. Gestion de la Connexion
                if (connection === 'close') {
                    const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    const shouldReconnect = reason !== DisconnectReason.loggedOut;

                    console.log(`[Manager] 🔴 Connexion fermée pour Tenant ${tenantId}. Raison: ${reason}. Reconnect: ${shouldReconnect}`);

                    if (shouldReconnect) {
                        const session = this.sessions.get(tenantId);
                        let delay = 2000;

                        if (session) {
                            session.retryCount++;
                            delay = Math.min(session.retryCount * 2000, 30000);
                        }

                        console.log(`[Manager] 🔄 Tentative de reconnexion dans ${delay / 1000}s...`);

                        setTimeout(() => {
                            this.createSession(tenantId, onConnectionUpdate).catch(e => console.error(`[Manager] Retry failed:`, e));
                        }, delay);

                    } else {
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
                        session.retryCount = 0;
                    }

                    const userJid = sock.user?.id;
                    const phoneNumber = userJid ? userJid.split(':')[0] : undefined;

                    await db.updateTenantWhatsAppStatus(tenantId, 'connected', phoneNumber);
                    resolve(undefined);
                }

                // Callback for external handling (like binding message listeners)
                if (onConnectionUpdate) {
                    onConnectionUpdate(update, sock);
                }
            });
        });
    }

    public async cleanupSession(tenantId: string) {
        const authPath = path.join(__dirname, `../../../auth_info_baileys/tenant_${tenantId}`);
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
    }
}
