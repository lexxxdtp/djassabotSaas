import { SessionManager } from './whatsapp/sessionManager';
import { handleMessage } from './whatsapp/messageHandler';

// Singleton Instance
const manager = new SessionManager();

export const whatsappManager = {
    // Session Management
    getSessionStatus: (tenantId: string) => manager.getSessionStatus(tenantId),
    requestPairingCode: (tenantId: string, phone: string) => manager.requestPairingCode(tenantId, phone),
    createSession: (tenantId: string) => manager.createSession(tenantId),
    ensureSession: (tenantId: string) => manager.ensureSession(tenantId),
    cleanupSession: (tenantId: string) => manager.cleanupSession(tenantId),

    // Get Session (Expose internal session data for routes)
    getSession: (tenantId: string) => manager.getSession(tenantId),

    // Déconnexion volontaire : le manager retient qu'aucune minuterie ne doit reconnecter.
    disconnect: (tenantId: string) => manager.disconnect(tenantId),
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
