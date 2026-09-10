import { test } from 'node:test';
import assert from 'node:assert/strict';

// Interception avant import : aucune configuration, clé ou connexion réelle chargée.
function loadIsolated(path: string, dependencies: Record<string, unknown>) {
    const Module = require('node:module');
    const original = Module._load;
    Module._load = function (id: string, ...args: unknown[]) {
        if (Object.prototype.hasOwnProperty.call(dependencies, id)) return dependencies[id];
        return original.call(this, id, ...args);
    };
    try {
        delete require.cache[require.resolve(path)];
        return require(path);
    } finally {
        Module._load = original;
    }
}

test('un reçu correspondant ne marque jamais la commande payée', async () => {
    let paid = false;
    const messages: string[] = [];
    const logs: unknown[][] = [];
    const service = loadIsolated('../../paymentValidationService', {
        './dbService': { db: {
            isTransactionIdUsed: async () => false,
            getOrders: async () => [{ id: 'order-1', userId: 'client', total: 5000, status: 'PENDING' }],
            updateOrderStatus: async () => { paid = true; },
            logActivity: async (...args: unknown[]) => { logs.push(args); },
        } },
        './whatsapp/notificationService': { sendPaymentNotification: async () => {} },
        '../utils/logger': { logger: { info() {}, warn() {}, error() {} } },
    });
    const handled = await service.processReceiptValidation('tenant', 'client', {
        amount: 5000, transactionId: 'receipt-1', provider: 'wave', confidence: 'high', recipientPhone: 'autre-compte',
    }, { sendMessage: async (_jid: string, message: { text: string }) => messages.push(message.text) });
    assert.equal(handled, true);
    assert.equal(paid, false);
    assert.equal(logs[0][1], 'warning');
    assert.match(messages[0], /pas encore confirmé/);
});

test('le marqueur de relance et la pause survivent aux lectures de session', async () => {
    const row = { id: 'tenant:client', tenant_id: 'tenant', user_phone: 'client', state: 'WAITING_FOR_ADDRESS', history: [], last_interaction: new Date().toISOString(), autopilot_enabled: false, reminder_sent: true };
    const query: any = {
        select() { return this; }, eq() { return this; },
        single: async () => ({ data: row }),
        gt: async () => ({ data: [row] }),
    };
    const service = loadIsolated('../../sessionService', {
        '../config/supabase': { isSupabaseEnabled: true, supabase: { from: () => query } },
    });
    const session = await service.getSession('tenant', 'client');
    const active = await service.getActiveSessions();
    for (const value of [session, active[0]]) {
        assert.equal(value.reminderSent, true);
        assert.equal(value.autopilotEnabled, false);
    }
});

test('une conversation en pause ne déclenche ni validation de reçu ni réponse', async () => {
    let receiptCalls = 0;
    let flowCalls = 0;
    const service = loadIsolated('../messageHandler', {
        '@whiskeysockets/baileys': { downloadMediaMessage: async () => Buffer.from('image de test') },
        '../dbService': { db: { getSettings: async () => ({ botActive: true }), getProducts: async () => [] } },
        '../sessionService': { getSession: async () => ({ autopilotEnabled: false }), addToHistory: async () => {} },
        './flowHandler': { handleFlow: async () => { flowCalls++; } },
        '../aiService': { analyzeImage: async () => 'image', analyzePaymentReceipt: async () => { receiptCalls++; }, transcribeAudio: async () => '' },
        '../paymentValidationService': { processReceiptValidation: async () => { receiptCalls++; } },
    });
    await service.handleMessage('tenant', {}, { key: { remoteJid: 'client' }, message: { imageMessage: { caption: 'mon reçu' } } });
    assert.equal(receiptCalls, 0);
    assert.equal(flowCalls, 0);
});
