import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs';
import { generateAIResponse } from './aiService';
import { db } from './dbService';

class BaileysService {
    sock: any;
    qr: string | undefined;
    status: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

    constructor() {
        this.initialize();
    }

    async initialize() {
        this.status = 'connecting';

        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        this.sock = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            logger: pino({ level: 'silent' }) as any,
            browser: ['Tdjaasa Bot', 'Chrome', '1.0.0']
        });

        this.sock.ev.on('connection.update', (update: any) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                this.qr = qr;
                this.status = 'connecting';
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                this.qr = undefined;
                this.status = 'disconnected';
                if (shouldReconnect) {
                    this.initialize();
                }
            } else if (connection === 'open') {
                console.log('opened connection');
                this.qr = undefined;
                this.status = 'connected';
            }
        });

        this.sock.ev.on('creds.update', saveCreds);

        // Listen for new messages
        this.sock.ev.on('messages.upsert', async (m: any) => {
            try {
                const msg = m.messages[0];
                if (!msg.key.fromMe && m.type === 'notify') {
                    const remoteJid = msg.key.remoteJid!;

                    // Extract text content
                    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption;

                    if (text) {
                        // Mark as read
                        await this.sock.readMessages([msg.key]);
                        // Show typing status
                        await this.sock.sendPresenceUpdate('composing', remoteJid);

                        // TODO: Map phone number to tenantId for multi-tenant
                        const DEFAULT_TENANT_ID = 'default-tenant-id';

                        // 1. Get Context (Settings & Inventory)
                        const settings = await db.getSettings(DEFAULT_TENANT_ID);
                        const products = await db.getProducts(DEFAULT_TENANT_ID);

                        const inventoryContext = products.map(p =>
                            `- ${p.name} (${p.price} FCFA): ${p.stock} en stock. ${p.description}`
                        ).join('\n');

                        // 2. Generate AI Response
                        const aiResponse = await generateAIResponse(text, {
                            settings,
                            inventoryContext
                        });

                        // 3. Send Response
                        await this.sock.sendMessage(remoteJid, { text: aiResponse });
                    }
                }
            } catch (err) {
                console.error('Error processing message:', err);
            }
        });
    }

    getQR() {
        return this.qr;
    }

    getStatus() {
        return this.status;
    }

    async logout() {
        try {
            await this.sock.logout();
        } catch (e) {
            console.error('Logout error', e);
        } finally {
            const path = 'auth_info_baileys';
            if (fs.existsSync(path)) {
                fs.rmSync(path, { recursive: true, force: true });
            }
            this.status = 'disconnected';
            this.qr = undefined;
            this.initialize();
        }
    }
}

export const whatsappClient = new BaileysService();
