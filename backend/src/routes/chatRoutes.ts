import { Router } from 'express';
import { authenticateTenant } from '../middleware/auth';
import { getActiveSessions, getSession, updateSession, addToHistory } from '../services/sessionService';
import { whatsappManager } from '../services/baileysManager';

const router = Router();

// Middleware to ensure user is authenticated
router.use(authenticateTenant);

// Get all active chats (sessions)
router.get('/', async (req: any, res) => {
    try {
        const tenantId = req.tenantId;
        console.log(`[API] 📋 Fetching chats for tenant: ${tenantId}`);

        const sessions = await getActiveSessions();
        console.log(`[API] 📊 Total sessions in DB: ${sessions.length}`);

        // Filter by tenant
        const tenantSessions = sessions.filter(s => s.tenantId === tenantId);
        console.log(`[API] 🎯 Sessions for this tenant: ${tenantSessions.length}`);

        if (tenantSessions.length > 0) {
            console.log(`[API] Sample session:`, {
                userId: tenantSessions[0].userId,
                historyLength: tenantSessions[0].history.length,
                state: tenantSessions[0].state,
                lastInteraction: tenantSessions[0].lastInteraction
            });
        }

        // Format for frontend
        const chats = tenantSessions.map(s => ({
            id: s.userId, // The phone number / JID
            name: s.userId.split('@')[0], // Simple formatting
            lastMessage: s.history.length > 0 ? s.history[s.history.length - 1].parts[0].text : '',
            lastInteraction: s.lastInteraction,
            autopilotEnabled: s.autopilotEnabled,
            state: s.state,
            unreadCount: 0 // TODO: Implement unread tracking
        })).sort((a, b) => new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime());

        console.log(`[API] ✅ Returning ${chats.length} chats to frontend`);
        res.json(chats);
    } catch (error) {
        console.error('[API] ❌ Error fetching chats:', error);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
});

// Get messages for a specific chat
router.get('/:jid/messages', async (req: any, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { jid } = req.params;
        const decodedJid = decodeURIComponent(jid);

        const session = await getSession(tenantId, decodedJid);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json(session.history);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Toggle Autopilot for a specific chat
router.post('/:jid/toggle-autopilot', async (req: any, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { jid } = req.params;
        const { enabled } = req.body; // boolean
        const decodedJid = decodeURIComponent(jid);

        const session = await updateSession(tenantId, decodedJid, {
            autopilotEnabled: enabled
        });

        res.json({ success: true, autopilotEnabled: session.autopilotEnabled });
    } catch (error) {
        console.error('Error toggling autopilot:', error);
        res.status(500).json({ error: 'Failed to toggle autopilot' });
    }
});

// Send a manual message
router.post('/:jid/send', async (req: any, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { jid } = req.params;
        const { text } = req.body;
        const decodedJid = decodeURIComponent(jid);

        if (!text) return res.status(400).json({ error: 'Message text is required' });

        // Get WhatsApp Session
        const waSession = await whatsappManager.getSession(tenantId);
        if (!waSession || waSession.status !== 'connected') {
            return res.status(503).json({ error: 'WhatsApp not connected' });
        }

        // Check if JID is valid (append server domain if missing)
        const remoteJid = decodedJid.includes('@s.whatsapp.net') ? decodedJid : `${decodedJid}@s.whatsapp.net`;

        // Send Message
        await waSession.sock.sendMessage(remoteJid, { text });

        // Add to history as 'model' (Assistant)
        await addToHistory(tenantId, decodedJid, 'model', text);

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

export default router;
