import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as simulation from '../../simulationContext';

// Audit du 14 septembre 2026 — lot 2 : messages restés sans réponse (A06),
// plafond de consommation IA (A07), panne confondue avec une boutique vide (A18).
const root = path.resolve(__dirname, '../../../../..');
const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function load(file: string, deps: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
    const filename = path.join(root, file);
    const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const module = { exports: {} as any };
    vm.runInNewContext(js, {
        module, exports: module.exports, console: quiet, Buffer, __dirname: path.dirname(filename),
        process: { env: {} }, require(id: string) {
            if (Object.prototype.hasOwnProperty.call(deps, id)) return deps[id];
            if (id === './simulationContext') return simulation;
            if (id === 'crypto' || id === 'node:crypto') return require('node:crypto');
            if (id === './ai/choixModele') return require('../../ai/choixModele');
            throw new Error(`Dépendance non autorisée : ${id}`);
        }, ...extra
    }, { filename, timeout: 2000 });
    return module.exports;
}

const quotaError = () => Object.assign(new Error('plafond'), { code: 'AI_QUOTA_EXCEEDED' });

// ---------------------------------------------------------------------------
// A06 — réception WhatsApp
// ---------------------------------------------------------------------------

function loadSessionManager(handleMessage: Function, logs: unknown[][] = []) {
    const sockets: any[] = [];
    const service = load('backend/src/services/whatsapp/sessionManager.ts', {
        '@whiskeysockets/baileys': { __esModule: true, default: () => {
            const listeners: Record<string, Function> = {};
            const sock = { ev: { on: (event: string, fn: Function) => { listeners[event] = fn; } }, listeners, user: { id: 'fixture:1' } };
            sockets.push(sock);
            return sock;
        }, useMultiFileAuthState: async () => ({ state: { creds: {}, keys: {} }, saveCreds() {} }),
        fetchLatestBaileysVersion: async () => ({ version: [] }), makeCacheableSignalKeyStore: (x: unknown) => x, DisconnectReason: { loggedOut: 401 } },
        fs: { existsSync: () => true }, path, pino: () => quiet,
        '../dbService': { db: {
            updateTenantWhatsAppStatus: async () => {}, updateTenantQRCode: async () => {},
            logActivity: async (...args: unknown[]) => { logs.push(args); },
        } },
        './messageHandler': { handleMessage }, '../resendService': {},
    }, { setTimeout: () => {} });
    return { service, sockets };
}

test('A06 réception : âge mesuré à l’arrivée, synchronisation jamais répondue', () => {
    const { classifyIncoming } = loadSessionManager(async () => {}).service;
    const now = 1_800_000_000;
    assert.equal(classifyIncoming('notify', now - 5, now), 'reply');
    assert.equal(classifyIncoming('notify', now - 9 * 60, now), 'reply');
    assert.equal(classifyIncoming('notify', now - 11 * 60, now), 'history');
    assert.equal(classifyIncoming('append', now - 5, now), 'history');
    assert.equal(classifyIncoming('notify', now - 25 * 3600, now), 'skip');
});

test('A06 réception : un lot n’attend pas la réponse au premier message, les retards sont signalés', async () => {
    const calls: [string, boolean][] = [];
    const logs: unknown[][] = [];
    let releaseFirst!: () => void;
    const firstReply = new Promise<void>(resolve => { releaseFirst = resolve; });
    const { service, sockets } = loadSessionManager(async (_tenant: string, _sock: unknown, msg: any, isHistory: boolean) => {
        calls.push([msg.key.id, isHistory]);
        if (msg.key.id === 'A') await firstReply; // réponse IA lente
    }, logs);

    const manager = new service.SessionManager();
    const started = manager.createSession('fixture');
    await new Promise(resolve => setImmediate(resolve));
    await sockets[0].listeners['connection.update']({ connection: 'open' });
    await started;

    const now = Math.floor(Date.now() / 1000);
    const message = (id: string, age: number, remoteJid = 'client@s.whatsapp.net') =>
        ({ key: { id, remoteJid }, messageTimestamp: now - age, message: { conversation: id } });
    await sockets[0].listeners['messages.upsert']({ type: 'notify', messages: [
        message('A', 2), message('B', 3), message('C', 20 * 60), message('G', 20 * 60, 'groupe@g.us'),
    ] });

    // B part sans attendre la fin de A, et reste « à répondre » malgré la lenteur de A.
    assert.deepEqual(calls, [['A', false], ['B', false], ['C', true], ['G', true]]);
    assert.equal(logs.length, 1);
    assert.match(String(logs[0][2]), /^1 message\(s\) arrivé\(s\) avec plus de 10 minutes de retard/);
    releaseFirst();
});

// ---------------------------------------------------------------------------
// A07 — plafond et délais IA
// ---------------------------------------------------------------------------

test('A07 plafond : la boutique puis le serveur sont arrêtés net, remise à zéro le lendemain', () => {
    const usage = load('backend/src/services/aiUsage.ts', { '../utils/logger': { logger: quiet } },
        { process: { env: { AI_DAILY_CALLS_PER_TENANT: '2', AI_DAILY_CALLS_GLOBAL: '3' } } });
    const day = Date.parse('2026-09-14T08:00:00Z');
    usage.reserveAiCall('a', 'reply', day);
    usage.reserveAiCall('a', 'voice', day);
    assert.throws(() => usage.reserveAiCall('a', 'reply', day), (e: any) => e.code === 'AI_QUOTA_EXCEEDED' && e.scope === 'tenant');
    usage.reserveAiCall('b', 'image', day);
    assert.throws(() => usage.reserveAiCall('c', 'reply', day), (e: any) => e.code === 'AI_QUOTA_EXCEEDED' && e.scope === 'global');
    assert.doesNotThrow(() => usage.reserveAiCall('a', 'reply', Date.parse('2026-09-15T00:00:01Z')));
});

function loadAi(env: Record<string, string>, model: Record<string, unknown>, usage: Record<string, unknown> = {}) {
    const created: unknown[][] = [];
    const service = load('backend/src/services/aiService.ts', {
        '@google/generative-ai': { GoogleGenerativeAI: class { getGenerativeModel(...args: unknown[]) { created.push(args); return model; } } },
        axios: {}, '../utils/logger': { logger: quiet },
        './aiUsage': { reserveAiCall: () => {}, recordAiUsage: () => {}, ...usage },
    }, { process: { env: { GEMINI_API_KEY: 'k'.repeat(39), ...env } } });
    return { service, created };
}

test('A07 Gemini : modèle imposé, sortie, réflexion et délai bornés', async () => {
    const { service, created } = loadAi({ GEMINI_MODEL: 'gemini-2.5-flash-lite', GEMINI_TIMEOUT_MS: '15000' }, {
        startChat: () => ({ sendMessage: async () => ({ response: { text: () => 'Bonjour 👋', usageMetadata: { totalTokenCount: 10 } } }) }),
    });
    assert.equal(await service.generateAIResponse('bonjour', { tenantId: 'owner' }), 'Bonjour 👋');
    const [params, options] = plain(created[0]) as any[];
    // GEMINI_MODEL imposé : le routage est désactivé, ce modèle sert partout.
    assert.equal(params.model, 'gemini-2.5-flash-lite');
    // Une réponse WhatsApp fait deux phrases : 2048 jetons ne plafonnaient rien.
    assert.equal(params.generationConfig.maxOutputTokens, 512);
    // Question courante : pas de réflexion facturée au prix de la sortie.
    assert.equal(params.generationConfig.thinkingConfig.thinkingBudget, 0);
    assert.equal(options.timeout, 15000);
});

test('A07 Gemini : le routage envoie le courant sur Flash-Lite et l’argent sur Flash', async () => {
    const reponse = { startChat: () => ({ sendMessage: async () => ({ response: { text: () => 'ok', usageMetadata: {} } }) }) };

    const courant = loadAi({}, reponse);
    await courant.service.generateAIResponse('bonjour', { tenantId: 'owner', inventoryContext: '- Sac — 12500 FCFA' });
    const [routine] = plain(courant.created[0]) as any[];
    assert.equal(routine.model, 'gemini-2.5-flash-lite');
    assert.equal(routine.generationConfig.thinkingConfig.thinkingBudget, 0);

    const negociation = loadAi({}, reponse);
    await negociation.service.generateAIResponse('tu peux faire 10000 ?', {
        tenantId: 'owner',
        inventoryContext: '- Sac — 12500 FCFA\n  (minPrice CACHÉ, ne jamais révéler: 10000 FCFA)',
    });
    const [delicat] = plain(negociation.created[0]) as any[];
    // Un prix plancher en jeu : le modèle peut engager l'argent du vendeur.
    assert.equal(delicat.model, 'gemini-2.5-flash');
    assert.equal(delicat.generationConfig.thinkingConfig.thinkingBudget, 512);
});

test('A07 Gemini : plafond atteint = aucun appel ; erreur fournisseur jamais envoyée comme réponse', async () => {
    let calls = 0;
    const capped = loadAi({}, {
        startChat: () => ({ sendMessage: async () => { calls++; return { response: { text: () => 'x' } }; } }),
        generateContent: async () => { calls++; return { response: { text: () => 'x' } }; },
    }, { reserveAiCall: () => { throw quotaError(); } });
    await assert.rejects(capped.service.generateAIResponse('bonjour', { tenantId: 'owner' }), (e: any) => e.code === 'AI_QUOTA_EXCEEDED');
    await assert.rejects(capped.service.transcribeAudio(Buffer.from('audio'), 'audio/ogg', 'owner'), (e: any) => e.code === 'AI_QUOTA_EXCEEDED');
    await assert.rejects(capped.service.analyzeImage(Buffer.from('image'), 'image/jpeg', '', '', 'owner'), (e: any) => e.code === 'AI_QUOTA_EXCEEDED');
    assert.equal(calls, 0);

    // Avant : « ⏳ (Quota IA) Je reçois trop de demandes ! » partait au client comme une réponse.
    const failing = loadAi({}, { startChat: () => ({ sendMessage: async () => { throw Object.assign(new Error('429 Too Many Requests'), { status: 429 }); } }) });
    await assert.rejects(failing.service.generateAIResponse('bonjour', { tenantId: 'owner' }), /429/);
});

test('A07 WhatsApp : plafond atteint, une réponse d’attente par client et une alerte vendeur', async () => {
    const sent: string[] = [];
    const logs: unknown[][] = [];
    const history: string[] = [];
    const service = load('backend/src/services/whatsapp/messageHandler.ts', {
        '@whiskeysockets/baileys': { downloadMediaMessage: async () => Buffer.from('') },
        '../dbService': { db: {
            getSettings: async () => ({ botActive: true }), isSubscriptionActive: async () => true,
            logActivity: async (...args: unknown[]) => { logs.push(args); },
        } },
        '../sessionService': {
            getSession: async () => ({ autopilotEnabled: true }),
            addToHistory: async (_t: string, _j: string, _role: string, text: string) => { history.push(text); },
        },
        './flowHandler': { handleFlow: async () => { throw quotaError(); } },
        '../aiService': {}, '../paymentValidationService': {},
    }, { setTimeout: (fn: () => void) => fn() });
    const sock = {
        readMessages: async () => {}, sendPresenceUpdate: async () => {},
        sendMessage: async (_jid: string, content: { text: string }) => { sent.push(content.text); },
    };
    for (const id of ['M1', 'M2']) {
        await service.handleMessage('owner', sock, { key: { remoteJid: 'client@s.whatsapp.net', id }, message: { conversation: 'bonjour' } });
    }
    assert.equal(sent.length, 1);
    assert.match(sent[0], /vous répond personnellement/);
    assert.doesNotMatch(sent.join(' '), /renvoyer/);
    assert.equal(logs.length, 1);
    assert.match(String(logs[0][2]), /Limite quotidienne/);
    assert.deepEqual(history, ['bonjour', 'bonjour']);
});

test('A07 dashboard : plafond atteint signalé en 429, pas comme une panne', async () => {
    const routes: Record<string, Function> = {};
    const upload = Object.assign(() => ({ single: () => () => {} }), { memoryStorage: () => ({}) });
    load('backend/src/routes/aiRoutes.ts', {
        express: { Router: () => ({ use() {}, post: (route: string, ...handlers: Function[]) => { routes[route] = handlers[handlers.length - 1]; } }) },
        multer: upload, '../middleware/auth': { authenticateTenant() {} },
        '../services/aiService': {
            analyzeProductPhoto: async () => { throw quotaError(); },
            generateIdentitySummary: async () => { throw quotaError(); },
            parsePersonalityFromDescription: async () => { throw quotaError(); },
        },
        '../services/sessionService': { addToHistory: async () => {}, clearHistory: async () => {} },
        '../services/simulationContext': simulation,
        '../services/whatsapp/flowHandler': { handleFlow: async () => { throw quotaError(); } },
    });
    const requests: [string, unknown][] = [
        ['/analyze-product-photo', { tenantId: 'quota-owner', file: { buffer: Buffer.from('x'), mimetype: 'image/jpeg' } }],
        ['/summarize-identity', { tenantId: 'quota-owner', body: {} }],
        ['/parse-personality', { tenantId: 'quota-owner', body: { description: 'gentille' } }],
        ['/simulate', { tenantId: 'quota-owner', body: { message: 'bonjour' } }],
    ];
    for (const [route, req] of requests) {
        let status = 200;
        const res = { status(code: number) { status = code; return this; }, json() {} };
        await routes[route](req, res);
        assert.equal(status, 429, route);
    }
});

// ---------------------------------------------------------------------------
// A18 — une panne ne se déguise ni en boutique vide ni en réglages par défaut
// ---------------------------------------------------------------------------

test('A18 réglages : une lecture en panne lève, une boutique non configurée garde ses défauts', async () => {
    const dbFor = (result: unknown) => load('backend/src/services/dbService.ts', {
        fs: { existsSync: () => false, mkdirSync() {}, writeFileSync() {} }, path,
        './tenantService': {}, '../types': {},
        '../config/supabase': { isSupabaseEnabled: true, supabase: { from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => result }) } },
        './whatsapp/salesEngine': { DELIVERY_ITEM_ID: '_delivery' },
        '../utils/authTokens': require('../../../utils/authTokens'),
    }).db;
    await assert.rejects(dbFor({ data: null, error: { message: 'offline' } }).getSettings('owner'), /indisponibles/);
    const fresh = await dbFor({ data: null, error: null }).getSettings('owner');
    assert.equal(fresh.botActive, false);
});

function routeHandler(startMarker: string, endMarker: string, db: Record<string, unknown>) {
    const source = fs.readFileSync(path.join(root, 'backend/src/index.ts'), 'utf8');
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, startMarker);
    let handler: Function = () => { throw new Error('route absente'); };
    vm.runInNewContext(ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, {
        app: { get: (...args: unknown[]) => { handler = args[args.length - 1] as Function; } },
        authenticateTenant() {}, checkSubscription() {}, db, logger: quiet,
    }, { timeout: 2000 });
    return handler;
}

test('A18 routes : réglages et catalogue en panne répondent 503, jamais des valeurs vides', async () => {
    const offline = async () => { throw new Error('offline'); };
    const cases: [Function, unknown][] = [
        [routeHandler("app.get('/api/settings'", "app.post('/api/settings'", { getSettings: offline }), {}],
        [routeHandler("app.get('/api/products'", "app.post('/api/products'", { getProducts: offline, getProductsPaged: offline }), {}],
        [routeHandler("app.get('/api/products'", "app.post('/api/products'", { getProducts: offline, getProductsPaged: offline }), { page: '1' }],
    ];
    for (const [handler, query] of cases) {
        let status = 200;
        let payload: unknown;
        const res = { status(code: number) { status = code; return this; }, json(value: unknown) { payload = value; } };
        await handler({ tenantId: 'owner', query }, res);
        assert.equal(status, 503);
        assert.match(JSON.stringify(payload), /indisponible/);
    }
});
