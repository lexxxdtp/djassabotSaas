import { SessionManager } from './whatsapp/sessionManager';
import { handleMessage } from './whatsapp/messageHandler';

// Singleton Instance
const manager = new SessionManager();

export const whatsappManager = {
    // Session Management
    getSessionStatus: (tenantId: string) => manager.getSessionStatus(tenantId),
    requestPairingCode: (tenantId: string, phone: string) => manager.requestPairingCode(tenantId, phone),
    createSession: (tenantId: string) => manager.createSession(tenantId,
        // Bind the message handler to the socket events
        async (update, sock) => {
            const { messages, type } = update;
            if (messages) {
                for (const msg of messages) {
                    try {
                        const msgTimestamp = (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : (msg.messageTimestamp as any)?.toNumber?.() || Math.floor(Date.now() / 1000));
                        const secondsAgo = Math.floor(Date.now() / 1000) - msgTimestamp;

                        // We check history here or inside handleMessage? 
                        // logic was: if (secondsAgo > 60) continue; 
                        // Let's rely on handleMessage logic or pass flags?
                        // For simplicity in this facade binding:
                        if (secondsAgo > 60) continue;

                        const isHistory = type === 'append' || secondsAgo > 10;
                        await handleMessage(tenantId, sock, msg, isHistory);
                    } catch (e) {
                        console.error('Error handling message via facade binding', e);
                    }
                }
            }
        }
    ),
    cleanupSession: (tenantId: string) => manager.cleanupSession(tenantId),

    // Get Session (Expose internal session data for routes)
    getSession: (tenantId: string) => manager.getSession(tenantId),

    // Disconnect (Wrapper around cleanup or socket end)
    disconnect: async (tenantId: string) => {
        const session = manager.getSession(tenantId);
        if (session?.sock) {
            session.sock.end(undefined);
        }
        await manager.cleanupSession(tenantId);
    }
};

export const startAllTenantInstances = async () => {
    try {
        // Dynamic import to avoid circular dependency if any, or just standard import
        const { getActiveTenants } = await import('./tenantService');
        const tenants = await getActiveTenants();
        console.log(`[Startup] Found ${tenants.length} active tenants. Starting WhatsApp sessions...`);

        for (const tenant of tenants) {
            if (tenant.whatsappConnected) {
                console.log(`[Startup] Starting session for ${tenant.name} (${tenant.id})`);
                // We don't await this to allow parallel startup or at least not block the loop strictly on connection
                whatsappManager.createSession(tenant.id).catch(err => {
                    console.error(`[Startup] Failed to start session for ${tenant.name}:`, err);
                });
            }
        }
    } catch (error) {
        console.error('[Startup] Error starting tenant instances:', error);
    }
};

export default manager;
