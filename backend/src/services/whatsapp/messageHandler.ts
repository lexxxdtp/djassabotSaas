import { WASocket, proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import { db } from '../dbService';
import { handleFlow } from './flowHandler';

// Import AI services lazily to avoid circular deps if needed, but standard import is fine usually
import { transcribeAudio, analyzeImage } from '../aiService';
import { addToHistory } from '../sessionService';

export async function handleMessage(tenantId: string, sock: WASocket, msg: proto.IWebMessageInfo, isHistory: boolean = false) {
    try {
        if (!msg.key || !msg.key.remoteJid) return;
        const remoteJid = msg.key.remoteJid;

        // Ignore status updates
        if (remoteJid === 'status@broadcast') return;

        let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

        // Handle Self Messages (just log to history)
        if (msg.key.fromMe) {
            if (text) {
                await addToHistory(tenantId, remoteJid, 'model', text);
            }
            return;
        }

        // --- AUDIO ---
        if (msg.message?.audioMessage) {
            if (isHistory) {
                text = '[Audio Message]';
            } else {
                const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
                const mimeType = msg.message?.audioMessage?.mimetype || 'audio/ogg';
                if (buffer instanceof Buffer) {
                    const transcription = await transcribeAudio(buffer, mimeType);
                    text = transcription || undefined;
                }
            }
        }

        // --- IMAGE ---
        if (msg.message?.imageMessage) {
            if (isHistory) {
                text = `[Image] ${msg.message.imageMessage.caption || ''}`;
            } else {
                const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
                const mimeType = msg.message?.imageMessage?.mimetype || 'image/jpeg';
                const caption = msg.message?.imageMessage?.caption || "";

                // Get inventory context for image analysis
                const products = await db.getProducts(tenantId);
                const inventoryContext = products.map((p: any) => `- ${p.name}`).join('\n'); // Simplified context for image

                const description = await analyzeImage(buffer as Buffer, mimeType, caption, inventoryContext);
                text = `[User sent an Image] Description: ${description}. Caption: ${caption}`;
            }
        }

        if (!text) return;

        // Add User Message to History
        await addToHistory(tenantId, remoteJid, 'user', text);

        if (isHistory) return;

        // Mark Read & Typing
        await sock.readMessages([msg.key]);
        await sock.sendPresenceUpdate('composing', remoteJid);

        // DELAY SIMULATION
        await new Promise(r => setTimeout(r, Math.random() * 1000 + 500));

        // ROUTE TO FLOW
        await handleFlow(tenantId, remoteJid, text, sock);

    } catch (e) {
        console.error('Error in messageHandler:', e);
    }
}
