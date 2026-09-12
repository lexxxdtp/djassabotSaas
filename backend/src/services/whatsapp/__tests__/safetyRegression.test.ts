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
        maybeSingle: async () => ({ data: row, error: null }),
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

test('une lecture de session en échec ne fabrique pas un panier vide', async () => {
    let written = false;
    const query: any = {
        select() { return this; }, eq() { return this; },
        maybeSingle: async () => ({ data: null, error: { message: 'connexion perdue' } }),
        upsert: async () => { written = true; return { error: null }; },
    };
    const service = loadIsolated('../../sessionService', {
        '../config/supabase': { isSupabaseEnabled: true, supabase: { from: () => query } },
    });
    // Repartir sur une session neuve écraserait le panier d'un client en pleine commande.
    await assert.rejects(() => service.getSession('tenant', 'client'), /Lecture de session impossible/);
    assert.equal(written, false);
});

test('un panier non sauvegardé remonte, un historique non sauvegardé non', async () => {
    const row = { id: 'tenant:client', tenant_id: 'tenant', user_phone: 'client', state: 'IDLE', history: [], last_interaction: new Date().toISOString() };
    const query: any = {
        select() { return this; }, eq() { return this; },
        maybeSingle: async () => ({ data: row, error: null }),
        upsert: async () => ({ error: { message: 'écriture refusée' } }),
    };
    const service = loadIsolated('../../sessionService', {
        '../config/supabase': { isSupabaseEnabled: true, supabase: { from: () => query } },
    });
    // Critique : le bot ne doit pas continuer comme si le panier était enregistré.
    await assert.rejects(
        () => service.updateSession('tenant', 'client', { state: 'WAITING_FOR_ADDRESS' }),
        /Sauvegarde de session impossible/,
    );
    // Non critique : perdre un tour de discussion n'annule pas une réponse déjà envoyée.
    await service.addToHistory('tenant', 'client', 'model', 'bonjour');
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

// --- Webhook Paystack : la métadonnée ne décide pas de ce que le client reçoit ---

function loadPaystack(overrides: Record<string, unknown>) {
    const calls: { subscriptions: unknown[]; statuses: unknown[]; logs: unknown[][] } = { subscriptions: [], statuses: [], logs: [] };
    const service = loadIsolated('../../paystackService', {
        axios: { create: () => ({ post: async () => { throw new Error('appel réseau interdit en test'); } }) },
        './dbService': { db: {
            isPaystackEventProcessed: async () => false,
            createSubscription: async (value: unknown) => { calls.subscriptions.push(value); },
            updateOrderStatus: async (...args: unknown[]) => { calls.statuses.push(args); },
            logActivity: async (...args: unknown[]) => { calls.logs.push(args); },
            getOrderById: async () => ({ id: 'ORD-1', total: 5000 }),
            ...overrides,
        } },
    });
    return { service, calls };
}

test('paystack : un montant insuffisant n’active aucun abonnement', async () => {
    const { service, calls } = loadPaystack({});
    await service.handlePaystackWebhook('charge.success', {
        reference: 'ref-1', currency: 'XOF', amount: 100 * 100,
        metadata: { type: 'subscription', tenantId: 'tenant', plan: 'business' },
    });
    assert.equal(calls.subscriptions.length, 0);
    assert.equal(calls.logs[0][1], 'warning');
});

test('paystack : un événement déjà traité ne prolonge pas une deuxième fois', async () => {
    const { service, calls } = loadPaystack({ isPaystackEventProcessed: async () => true });
    await service.handlePaystackWebhook('charge.success', {
        reference: 'ref-1', currency: 'XOF', amount: 15000 * 100,
        metadata: { type: 'subscription', tenantId: 'tenant', plan: 'business' },
    });
    assert.equal(calls.subscriptions.length, 0);
});

test('paystack : une activation ratée remonte au lieu d’être acquittée', async () => {
    const { service } = loadPaystack({ createSubscription: async () => { throw new Error('base injoignable'); } });
    // Acquitter ici, c'est encaisser sans livrer : Paystack ne représenterait jamais l'événement.
    await assert.rejects(() => service.handlePaystackWebhook('charge.success', {
        reference: 'ref-1', currency: 'XOF', amount: 15000 * 100,
        metadata: { type: 'subscription', tenantId: 'tenant', plan: 'business' },
    }), /base injoignable/);
});

test('paystack : un montant exact active bien l’abonnement', async () => {
    const { service, calls } = loadPaystack({});
    await service.handlePaystackWebhook('charge.success', {
        reference: 'ref-1', currency: 'XOF', amount: 15000 * 100,
        metadata: { type: 'subscription', tenantId: 'tenant', plan: 'business' },
    });
    assert.equal(calls.subscriptions.length, 1);
    assert.equal((calls.subscriptions[0] as { plan: string }).plan, 'business');
});

test('paystack : un sous-paiement ne marque pas la commande payée', async () => {
    const { service, calls } = loadPaystack({});
    await service.handlePaystackWebhook('charge.success', {
        reference: 'ref-2', currency: 'XOF', amount: 1000 * 100,
        metadata: { type: 'order', tenantId: 'tenant', orderId: 'ORD-1' },
    });
    assert.equal(calls.statuses.length, 0);
    assert.equal(calls.logs[0][1], 'warning');
});

// --- Fiabilité WhatsApp : ne pas ouvrir de socket en trop, ni répondre deux fois ---

test('un message relivré ne déclenche pas une deuxième réponse', async () => {
    let flowCalls = 0;
    const service = loadIsolated('../messageHandler', {
        '@whiskeysockets/baileys': { downloadMediaMessage: async () => Buffer.from('') },
        '../dbService': { db: { getSettings: async () => ({ botActive: true }), getProducts: async () => [],
            isSubscriptionActive: async () => true } },
        '../sessionService': { getSession: async () => ({ autopilotEnabled: true }), addToHistory: async () => {} },
        './flowHandler': { handleFlow: async () => { flowCalls++; } },
        '../aiService': {}, '../paymentValidationService': {},
    });
    const sock = { readMessages: async () => {}, sendPresenceUpdate: async () => {}, sendMessage: async () => {} };
    const msg = { key: { remoteJid: 'client', id: 'MSG-1' }, message: { conversation: 'bonjour' },
        messageTimestamp: Math.floor(Date.now() / 1000) };
    await service.handleMessage('tenant', sock, msg);
    await service.handleMessage('tenant', sock, msg);
    assert.equal(flowCalls, 1);
});

test('lire le statut ne rallume pas un bot volontairement éteint', async () => {
    const opened: string[] = [];
    const { SessionManager } = loadIsolated('../sessionManager', {
        '@whiskeysockets/baileys': {}, '@hapi/boom': {}, pino: () => ({}),
        '../dbService': { db: {} }, '../resendService': { sendBotDownAlert: async () => {} },
        './messageHandler': { handleMessage: async () => {} },
    });
    const manager = new SessionManager();
    // On n'ouvre pas de vrai socket : seule la décision d'ouvrir nous intéresse.
    manager.createSession = async (tenantId: string) => { opened.push(tenantId); return undefined; };

    manager.ensureSession('tenant');
    assert.deepEqual(opened, ['tenant']);

    await manager.disconnect('tenant');
    manager.ensureSession('tenant');
    manager.ensureSession('tenant');
    // Le vendeur s'est déconnecté : consulter son tableau de bord ne le reconnecte pas.
    assert.deepEqual(opened, ['tenant']);
});

// --- Sans clé IA en production : se taire plutôt qu'inventer ---

test('production sans clé IA : aucune réponse factice n’est envoyée au client', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        const ai = loadIsolated('../../aiService', {
            '@google/generative-ai': { GoogleGenerativeAI: class { getGenerativeModel() { return {}; } } },
            '../utils/logger': { logger: { info() {}, warn() {}, error() {} } },
        });
        // Sans ce garde-fou, le client recevait « [SIMULATED AI] Je suis en mode
        // test » ou une description de robe rouge pour n'importe quelle photo.
        await assert.rejects(() => ai.generateAIResponse('bonjour', {}), /Clé Gemini absente/);
        await assert.rejects(() => ai.analyzeImage(Buffer.from(''), 'photo'), /Clé Gemini absente/);
    } finally {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
    }
});

// --- Réinitialisation : ne jamais brûler le lien sur une écriture non confirmée ---

test('mot de passe : un enregistrement raté ne consomme pas le lien', async () => {
    const deleted: unknown[] = [];
    const controller = loadIsolated('../../../controllers/authController', {
        bcryptjs: { hash: async () => 'hash', compare: async () => true },
        '../middleware/auth': { generateToken: () => 'jwt' },
        '../services/dbService': { db: {
            verifyAuthToken: async () => ({ valid: true, identifier: 'user-1' }),
            updateUser: async () => null, // updateUser rend null au lieu de lever
            deleteAuthToken: async (...args: unknown[]) => { deleted.push(args); },
        } },
        '../services/resendService': {}, '../services/firebaseAdminService': {},
        uuid: { v4: () => 'id' },
        '../utils/logger': { logger: { info() {}, warn() {}, error() {} } },
    });

    let status = 200; let payload: any;
    const res = { status(code: number) { status = code; return this; }, json(value: unknown) { payload = value; } };
    await controller.resetPassword({ body: { token: 'lien', password: 'Motdepasse1' } }, res);

    // Sinon : mot de passe inchangé, lien consommé, utilisateur enfermé dehors.
    assert.equal(status, 500);
    assert.match(payload.error, /lien reste valide/);
    assert.equal(deleted.length, 0);
});

// --- Suspension : un jeton déjà émis ne doit pas survivre à la suspension ---

function loadAuthMiddleware(tenant: unknown, subscription: unknown) {
    return loadIsolated('../../../middleware/auth', {
        jsonwebtoken: { verify: () => ({}), sign: () => 'jwt' },
        '../services/dbService': { db: {
            getTenantById: async () => tenant,
            getSubscriptionByTenantId: async () => subscription,
        } },
        '../utils/logger': { logger: { info() {}, warn() {}, error() {}, debug() {} } },
    });
}

test('compte suspendu : l’accès est coupé même avec un jeton encore valide', async () => {
    const middleware = loadAuthMiddleware({ id: 'tenant', status: 'suspended' }, null);
    let status = 200; let payload: any; let passed = false;
    const res = { status(code: number) { status = code; return this; }, json(value: unknown) { payload = value; } };
    // Le JWT dure sept jours : sans cette vérification, la suspension ne prenait
    // effet qu'à l'expiration du jeton.
    await middleware.checkSubscription({ tenantId: 'tenant' }, res, () => { passed = true; });
    assert.equal(passed, false);
    assert.equal(status, 403);
    assert.equal(payload.code, 'ACCOUNT_SUSPENDED');
});

test('compte actif : rien ne change', async () => {
    const middleware = loadAuthMiddleware({ id: 'tenant', status: 'active' },
        { status: 'active', expiresAt: new Date(Date.now() + 86400000) });
    let passed = false;
    const res = { status() { return this; }, json() {} };
    await middleware.checkSubscription({ tenantId: 'tenant' }, res, () => { passed = true; });
    assert.equal(passed, true);
});

// --- Segment VIP : une commande impayée n'est pas une dépense ---

test('marketing : impayées et annulées ne font pas d’un client un VIP', async () => {
    const sessions = [
        { tenantId: 'tenant', userId: 'jamais-paye', lastInteraction: new Date() },
        { tenantId: 'tenant', userId: 'bon-client', lastInteraction: new Date() },
    ];
    const orders = [
        { userId: 'jamais-paye', total: 150000, status: 'PENDING' },
        { userId: 'jamais-paye', total: 150000, status: 'CANCELLED' },
        { userId: 'bon-client', total: 120000, status: 'DELIVERED' },
    ];
    const routes: Record<string, Function> = {};
    loadIsolated('../../../routes/marketingRoutes', {
        express: { Router: () => ({ use() {}, get: (route: string, ...h: Function[]) => { routes[route] = h[h.length - 1]; }, post() {} }) },
        '../middleware/auth': { authenticateTenant() {} },
        '../services/dbService': { db: { getOrders: async () => orders, logActivity: async () => {} } },
        '../services/sessionService': { getActiveSessions: async () => sessions },
        '../services/baileysManager': { whatsappManager: {} },
        '../utils/logger': { logger: { info() {}, warn() {}, error() {} } },
    });

    let payload: any;
    const res = { status() { return this; }, json(value: unknown) { payload = value; } };
    await routes['/audience']({ tenantId: 'tenant' }, res);
    // Sans le filtre, « jamais-paye » comptait 300 000 FCFA et passait VIP.
    assert.equal(payload.vip, 1);
    assert.equal(payload.all, 2);
});
