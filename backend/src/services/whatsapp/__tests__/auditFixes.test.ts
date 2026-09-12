import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as simulation from '../../simulationContext';

// Liste blanche stricte : aucun .env, stockage ou service distant n'est chargé.
const root = path.resolve(__dirname, '../../../../..');
const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };

test('statistiques : annulations exclues, montant des commandes distinct de l’encaissement', () => {
    const metrics = load('frontend/src/utils/overviewMetrics.ts');
    const now = Date.parse('2026-09-11T12:00:00Z');
    const orders = ['PENDING', 'CONFIRMED', 'PAID', 'SHIPPING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'UNKNOWN'].map((status, i) => ({
        id: String(i), total: 1000, status, createdAt: '2026-09-11T10:00:00Z', userId: 'fixture', items: []
    }));
    const weekly = metrics.deriveMetrics(orders, now);
    const daily = metrics.deriveDailyMetrics(orders, now);
    assert.equal(weekly.revenue7, 6000); assert.equal(weekly.orders7, 6);
    assert.equal(weekly.avgBasket, 1000); assert.equal(daily.todayRevenue, 6000);
    assert.equal(metrics.deriveMetrics([orders[6]], now).revenue7, 0);
});

test('statistiques : sept jours calendaires cohérents avec le graphique et dates invalides exclues', () => {
    const metrics = load('frontend/src/utils/overviewMetrics.ts');
    const now = Date.parse('2026-09-11T12:00:00Z');
    const row = (createdAt: string, total = 1000) => ({ id: createdAt, total, status: 'PAID', createdAt, userId: 'fixture', items: [] });
    const orders = [row('2026-09-05T00:00:00Z'), row('2026-09-04T23:59:59Z'), row('2026-09-11T12:00:00Z'),
        row('2026-09-11T13:00:00Z'), row('invalide'), row('2026-09-11T11:00:00Z', NaN), row('2026-09-11T11:00:00Z', -100)];
    const result = metrics.deriveMetrics(orders, now);
    assert.equal(result.revenue7, 2000); assert.equal(result.orders7, 2); assert.equal(result.revenueDelta, 100);
    assert.equal(result.chartData.reduce((sum: number, p: { sales: number }) => sum + p.sales, 0), result.revenue7);
    assert.equal(metrics.deriveDailyMetrics(orders, now).todayRevenue, 1000);
});

test('statistiques : minuit Abidjan et absence de commandes', () => {
    const metrics = load('frontend/src/utils/overviewMetrics.ts');
    const now = Date.parse('2026-09-11T00:00:00Z');
    const orders = ['2026-09-10T23:59:59Z', '2026-09-11T00:00:00Z'].map(createdAt => ({ total: 100, status: 'PENDING', createdAt }));
    const daily = metrics.deriveDailyMetrics(orders, now);
    assert.equal(daily.todayRevenue, 100); assert.equal(daily.yesterdayRevenue, 100);
    const empty = metrics.deriveMetrics([], now);
    assert.equal(empty.revenue7, 0); assert.equal(empty.avgBasket, 0); assert.equal(empty.revenueDelta, null);
});

for (const mode of ['error', 'null', 'empty']) {
    test(`lecture commandes ${mode} : absence distinguée de la panne`, async () => {
        const filters: unknown[] = [];
        const query = { select() { return this; }, eq(key: string, value: string) { filters.push([key, value]); return this; },
            order: async () => ({ data: mode === 'empty' ? [] : null, error: mode === 'error' ? { message: 'offline' } : null }) };
        const db = loadDb({ from: () => query });
        if (mode === 'empty') assert.equal((await db.getOrders('owner')).length, 0);
        else await assert.rejects(db.getOrders('owner'), /indisponibles/);
        assert.deepEqual(filters, [['tenant_id', 'owner']]);
    });
}

test('lecture paginée : un rejet de base ne renvoie pas un catalogue local vide', async () => {
    const query = { select() { return this; }, eq() { return this; }, order() { return this; },
        range: async () => ({ data: null, error: { message: 'offline' } }) };
    await assert.rejects(loadDb({ from: () => query }).getOrdersPaged('owner', 1, 20), /indisponibles/);
});

test('route commandes : panne signalée HTTP 503 pour les deux modes de lecture', async () => {
    const source = fs.readFileSync(path.join(root, 'backend/src/index.ts'), 'utf8');
    const start = source.indexOf("app.get('/api/orders',");
    const end = source.indexOf("app.put('/api/orders/:id/status'", start);
    assert.ok(start >= 0 && end > start);
    let handler: Function = () => { throw new Error('route absente'); };
    vm.runInNewContext(ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, {
        app: { get: (_url: string, _auth: unknown, _subscription: unknown, fn: Function) => { handler = fn; } },
        authenticateTenant() {}, checkSubscription() {},
        db: { getOrders: async () => { throw new Error('offline'); }, getOrdersPaged: async () => { throw new Error('offline'); } }
    }, { timeout: 2000 });
    for (const query of [{}, { page: '1' }]) {
        let status = 200, payload: any;
        const res = { status(code: number) { status = code; return this; }, json(value: unknown) { payload = value; } };
        await handler({ tenantId: 'owner', query }, res);
        assert.equal(status, 503); assert.match(payload.error, /indisponibles/);
    }
});

for (const tag of ['robe | 1 | 1000', 'red | 1.5 | 1000', 'red | 99999 | 1000']) {
    test(`clarification sans mutation ni promesse IA : ${tag}`, async () => {
        const messages: string[] = [];
        let writes = 0;
        const service = load('backend/src/services/whatsapp/flowHandler.ts', {
            '../dbService': { db: { getSettings: async () => ({ negotiationEnabled: false }), getProducts: async () => [
                { id: 'red', name: 'Robe rouge', price: 1000 }, { id: 'blue', name: 'Robe bleue', price: 1000 }
            ], logActivity: async () => {} } },
            '../sessionService': { getSession: async () => ({ state: 'IDLE', history: [] }), addToHistory: async () => {},
                addItemToSessionCart: async () => { writes++; }, updateSession: async () => { writes++; } },
            '../aiService': { generateAIResponse: async () => `ACHAT CONFIRME [ADD_TO_CART: blue | 1 | 1000] [ADD_TO_CART: ${tag}]` },
            './notificationService': {}, './salesEngine': load('backend/src/services/whatsapp/salesEngine.ts'), '../../utils/logger': { logger: quiet }
        });
        await service.handleFlow('owner', 'client', 'je prends la robe', { sendMessage: async (_jid: string, message: { text: string }) => { messages.push(message.text); } });
        assert.equal(writes, 0);
        assert.equal(messages.length, 1);
        assert.doesNotMatch(messages[0], /ACHAT CONFIRME|ADD_TO_CART/);
        assert.match(messages[0], /préciser|quantité/);
    });
}

for (const failure of ['none', 'customer', 'merchant']) {
    test(`commande créée : panier fermé avant envoi, échec ${failure} sans revalidation`, async () => {
        const events: string[] = [];
        let session: any = { state: 'WAITING_FOR_ADDRESS', autopilotEnabled: true, history: [],
            tempOrder: { items: [{ productId: 'p', productName: 'robe', price: 1000, quantity: 1 }], total: 1000 } };
        const service = load('backend/src/services/whatsapp/flowHandler.ts', {
            '../dbService': { db: { getSettings: async () => ({ deliveryEnabled: false }), getProducts: async () => [],
                decrementStockForItems: async () => { events.push('stock'); return { ok: true }; },
                createOrder: async () => { events.push('order'); return { id: 'fixture' }; } } },
            '../sessionService': { getSession: async () => session,
                updateSession: async (_tenant: string, _jid: string, updates: unknown) => { session = { ...session, ...updates as object }; events.push('clear'); }, addToHistory: async () => {} },
            '../aiService': {}, './salesEngine': load('backend/src/services/whatsapp/salesEngine.ts'), '../../utils/logger': { logger: quiet },
            './notificationService': { sendOrderNotification: async () => { events.push('merchant'); if (failure === 'merchant') throw new Error('offline'); } }
        });
        await service.handleFlow('owner', 'client', 'Cocody', { sendMessage: async () => {
            assert.equal(session.state, 'IDLE'); assert.equal(session.tempOrder, undefined);
            events.push('customer'); if (failure === 'customer') throw new Error('offline');
        } });
        assert.deepEqual(events, ['stock', 'order', 'clear', 'customer', 'merchant']);
    });
}

test('panier impossible à fermer : le client est prévenu de ne pas revalider', async () => {
    const events: string[] = [];
    const messages: string[] = [];
    const warnings: unknown[][] = [];
    const session: any = { state: 'WAITING_FOR_ADDRESS', autopilotEnabled: true, history: [],
        tempOrder: { items: [{ productId: 'p', productName: 'robe', price: 1000, quantity: 1 }], total: 1000 } };
    const service = load('backend/src/services/whatsapp/flowHandler.ts', {
        '../dbService': { db: { getSettings: async () => ({ deliveryEnabled: false }), getProducts: async () => [],
            decrementStockForItems: async () => { events.push('stock'); return { ok: true }; },
            createOrder: async () => { events.push('order'); return { id: 'cmd-4242' }; },
            restockItems: async () => { events.push('restock'); },
            logActivity: async (...args: unknown[]) => { warnings.push(args); } } },
        '../sessionService': { getSession: async () => session, addToHistory: async () => {},
            updateSession: async () => { events.push('clear'); throw new Error('base injoignable'); } },
        '../aiService': {}, './salesEngine': load('backend/src/services/whatsapp/salesEngine.ts'), '../../utils/logger': { logger: quiet },
        './notificationService': { sendOrderNotification: async () => { events.push('merchant'); } }
    });
    await service.handleFlow('owner', 'client', 'Cocody', { sendMessage: async (_jid: string, message: { text: string }) => { messages.push(message.text); } });
    // La commande existe et le stock est pris : ne surtout pas rendre le stock ni rejouer.
    assert.deepEqual(events, ['stock', 'order', 'clear']);
    assert.match(messages[0], /bien enregistrée/);
    assert.match(messages[0], /Ne renvoyez pas votre adresse/);
    assert.equal(warnings[0][1], 'warning');
    assert.match(String(warnings[0][2]), /deux fois/);
});

test('panier déjà commandé : ni stock repris, ni deuxième commande', async () => {
    const events: string[] = [];
    const messages: string[] = [];
    const session: any = { state: 'WAITING_FOR_ADDRESS', autopilotEnabled: true, history: [],
        tempOrder: { items: [{ productId: 'p', productName: 'robe', price: 1000, quantity: 1 }], total: 1000, idempotencyKey: 'cle-panier' } };
    const service = load('backend/src/services/whatsapp/flowHandler.ts', {
        '../dbService': { db: { getSettings: async () => ({ deliveryEnabled: false }), getProducts: async () => [],
            findOrderByIdempotencyKey: async (_t: string, key: string) => {
                events.push('lookup'); return key === 'cle-panier' ? { id: 'cmd-1', total: 1000 } : null;
            },
            decrementStockForItems: async () => { events.push('stock'); return { ok: true }; },
            createOrder: async () => { events.push('order'); return { id: 'cmd-2' }; },
            restockItems: async () => { events.push('restock'); }, logActivity: async () => {} } },
        '../sessionService': { getSession: async () => session, addToHistory: async () => {},
            updateSession: async () => { events.push('clear'); } },
        '../aiService': {}, './salesEngine': load('backend/src/services/whatsapp/salesEngine.ts'), '../../utils/logger': { logger: quiet },
        './notificationService': { sendOrderNotification: async () => { events.push('merchant'); } }
    });
    await service.handleFlow('owner', 'client', 'Cocody', { sendMessage: async (_jid: string, message: { text: string }) => { messages.push(message.text); } });
    // La vérification précède le stock : rien n'est décrémenté pour être rendu ensuite.
    assert.deepEqual(events, ['lookup', 'clear']);
    assert.match(messages[0], /déjà enregistrée/);
    assert.match(messages[0], /pas été comptée deux fois/);
});

test('course perdue à la création : la commande existante gagne et le stock est rendu', async () => {
    const events: string[] = [];
    const session: any = { state: 'WAITING_FOR_ADDRESS', autopilotEnabled: true, history: [],
        tempOrder: { items: [{ productId: 'p', productName: 'robe', price: 1000, quantity: 1 }], total: 1000, idempotencyKey: 'cle-panier' } };
    const service = load('backend/src/services/whatsapp/flowHandler.ts', {
        '../dbService': { db: { getSettings: async () => ({ deliveryEnabled: false }), getProducts: async () => [],
            findOrderByIdempotencyKey: async () => { events.push('lookup'); return null; },
            decrementStockForItems: async () => { events.push('stock'); return { ok: true }; },
            createOrder: async () => { events.push('order'); return { id: 'cmd-1', total: 1000, alreadyExisted: true }; },
            restockItems: async () => { events.push('restock'); }, logActivity: async () => {} } },
        '../sessionService': { getSession: async () => session, addToHistory: async () => {},
            updateSession: async () => { events.push('clear'); } },
        '../aiService': {}, './salesEngine': load('backend/src/services/whatsapp/salesEngine.ts'), '../../utils/logger': { logger: quiet },
        './notificationService': { sendOrderNotification: async () => { events.push('merchant'); } }
    });
    await service.handleFlow('owner', 'client', 'Cocody', { sendMessage: async () => {} });
    // Le stock pris par ce passage est rendu : l'autre validation a déjà pris le sien.
    assert.deepEqual(events, ['lookup', 'stock', 'order', 'restock', 'clear', 'merchant']);
});

test('idempotence : clé posée au premier article et conservée ensuite', async () => {
    const saved: any[] = [];
    let row: any = { id: 'owner:client', tenant_id: 'owner', user_phone: 'client', state: 'IDLE', history: [], last_interaction: new Date().toISOString() };
    const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: row, error: null }),
        upsert: async (payload: any) => { saved.push(payload); row = { ...row, temp_order: payload.temp_order }; return { error: null }; } };
    const service = load('backend/src/services/sessionService.ts', { '../config/supabase': { isSupabaseEnabled: true, supabase: { from: () => query } } });
    const first = await service.addItemToSessionCart('owner', 'client', { productId: 'p', productName: 'robe', quantity: 1, price: 1000 });
    const second = await service.addItemToSessionCart('owner', 'client', { productId: 'q', productName: 'sac', quantity: 1, price: 500 });
    assert.ok(first.idempotencyKey);
    // Ajouter un article ne doit pas changer l'identité du panier.
    assert.equal(second.idempotencyKey, first.idempotencyKey);
});

test('idempotence : colonne absente, la commande passe quand même', async () => {
    const inserts: any[] = [];
    const orders: any = {
        insert(payload: unknown) { inserts.push(payload); return this; },
        select() { return this; },
        single: async () => inserts.length === 1
            ? { data: null, error: { code: 'PGRST204', message: "Could not find the 'idempotency_key' column" } }
            : { data: { ...(inserts[1] as any), created_at: new Date().toISOString(), user_id: 'client' }, error: null },
    };
    const db = loadDb({ from: (table: string) => table === 'orders' ? orders : { insert: async () => ({ error: null }) } });
    const order = await db.createOrder('owner', 'client', [], 1000, 'Cocody', new Date(), 'cle-panier');
    // Sans la migration, la vente ne doit pas être perdue — seulement non protégée.
    assert.equal(inserts.length, 2);
    assert.equal(inserts[0].idempotency_key, 'cle-panier');
    assert.equal(inserts[1].idempotency_key, undefined);
    assert.ok(order);
});

test('session : effacement du panier envoyé comme null explicite à la base', async () => {
    let saved: any;
    const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: {
        id: 'owner:client', tenant_id: 'owner', user_phone: 'client', state: 'WAITING_FOR_ADDRESS', history: [],
        temp_order: { items: [] }, last_interaction: new Date().toISOString()
    }, error: null }), upsert: async (payload: unknown) => { saved = payload; return { error: null }; } };
    const service = load('backend/src/services/sessionService.ts', { '../config/supabase': { isSupabaseEnabled: true, supabase: { from: () => query } } });
    await service.updateSession('owner', 'client', { state: 'IDLE', tempOrder: undefined });
    assert.equal(saved.temp_order, null);
    assert.equal(saved.tenant_id, 'owner');
});

function loadDb(client: unknown) {
    return load('backend/src/services/dbService.ts', {
        fs: { existsSync: () => false, mkdirSync() {}, writeFileSync() {} }, path,
        './tenantService': {}, '../types': {},
        '../config/supabase': { isSupabaseEnabled: true, supabase: client },
        './whatsapp/salesEngine': { DELIVERY_ITEM_ID: '_delivery' }
    }).db;
}

test('produit : colonnes autorisées uniquement et filtres des deux identifiants', async () => {
    let payload: any;
    const filters: unknown[] = [];
    const query = { update(value: unknown) { payload = value; return this; },
        eq(key: string, value: string) { filters.push([key, value]); return this; },
        select() { return this; }, single: async () => ({ data: { id: 'product', tenant_id: 'owner', manage_stock: false }, error: null }) };
    const db = loadDb({ from: () => query });
    const result = await db.updateProduct('owner', 'product', {
        id: 'replacement', tenant_id: 'victim', tenantId: 'victim', created_at: 'fake',
        name: 'Robe', price: 1500, minPrice: 1000, manageStock: false, aiInstructions: '',
    });
    assert.deepEqual(JSON.parse(JSON.stringify(payload)), { name: 'Robe', price: 1500, min_price: 1000, manage_stock: false, ai_instructions: '' });
    assert.deepEqual(filters, [['id', 'product'], ['tenant_id', 'owner']]);
    assert.equal(result.manageStock, false);
    await assert.rejects(db.updateProduct('owner', 'product', { tenant_id: 'victim' }));
});

for (const scenario of ['network', 'empty', 'rejected']) {
    test(`stock RPC ${scenario} : refus technique sans écriture de secours`, async () => {
        let fallbackReads = 0;
        const db = loadDb({ rpc: async () => {
            if (scenario === 'network') throw new Error('offline');
            return scenario === 'empty' ? { data: null, error: null } : { error: { code: '42501', message: 'adjust_stock denied' } };
        }, from: () => { fallbackReads++; throw new Error('secours interdit'); } });
        await assert.rejects(db.decrementStockForItems('owner', [{ productId: 'p', productName: 'robe', price: 1000, quantity: 1 }]));
        assert.equal(fallbackReads, 0);
    });
}

test('stock : une compensation connue est tentée après échec du deuxième article', async () => {
    const deltas: number[] = [];
    const db = loadDb({ rpc: async (_name: string, args: { p_delta: number }) => {
        deltas.push(args.p_delta);
        if (deltas.length === 2) throw new Error('offline');
        return { data: [{ success: true }], error: null };
    } });
    await assert.rejects(db.decrementStockForItems('owner', [
        { productId: 'a', productName: 'a', price: 1000, quantity: 1 },
        { productId: 'b', productName: 'b', price: 1000, quantity: 2 },
    ]));
    assert.deepEqual(deltas, [-1, -2, 1]);
});

test('stock : une mise à jour de secours nulle ne valide pas la vente', async () => {
    const db = loadDb({ rpc: async () => ({ error: { code: 'PGRST202' } }) });
    db.getProductById = async () => ({ id: 'p', stock: 2, variations: [] });
    db.updateProduct = async () => null;
    await assert.rejects(db.decrementStockForItems('owner', [{ productId: 'p', productName: 'robe', price: 1000, quantity: 1 }]));
});

test('stock : succès explicite et rupture ne sont pas confondus avec une panne', async () => {
    for (const success of [true, false]) {
        const db = loadDb({ rpc: async () => ({ data: [{ success, available: 0 }], error: null }) });
        const result = await db.decrementStockForItems('owner', [{ productId: 'p', productName: 'robe', price: 1000, quantity: 1 }]);
        assert.equal(result.ok, success);
    }
});
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
            // Natif pur : ni réseau, ni environnement, ni fichier.
            if (id === 'crypto' || id === 'node:crypto') return require('node:crypto');
            throw new Error(`Dépendance non autorisée : ${id}`);
        }, ...extra
    }, { filename, timeout: 2000 });
    return module.exports;
}

test('simulation : historique/panier séparés du vrai client même avec le même identifiant', async () => {
    let writes = 0;
    const real = { id: 'sim-owner:playground-session', tenant_id: 'sim-owner', user_phone: 'playground-session',
        state: 'IDLE', history: [{ role: 'user', parts: [{ text: 'VRAI CLIENT' }] }], last_interaction: new Date().toISOString() };
    const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: real, error: null }),
        gt: async () => ({ data: [real] }), upsert: async () => { writes++; return { error: null }; } };
    const sessions = load('backend/src/services/sessionService.ts', { '../config/supabase': { isSupabaseEnabled: true, supabase: { from: () => query } } });
    await simulation.runSimulation('sim-owner', async () => {
        await sessions.addToHistory('sim-owner', simulation.SIMULATION_USER_ID, 'user', 'TEST');
        await sessions.addItemToSessionCart('sim-owner', simulation.SIMULATION_USER_ID, { productId: 'p', productName: 'robe', quantity: 1, price: 1000 });
    });
    await simulation.runSimulation('sim-owner', async () => {
        const current = await sessions.getSession('sim-owner', simulation.SIMULATION_USER_ID);
        assert.equal(current.history[0].parts[0].text, 'TEST');
        assert.equal(current.tempOrder.total, 1000);
        await sessions.clearHistory('sim-owner', simulation.SIMULATION_USER_ID);
    });
    const unchanged = await sessions.getSession('sim-owner', simulation.SIMULATION_USER_ID);
    assert.equal(unchanged.history[0].parts[0].text, 'VRAI CLIENT');
    assert.equal((await sessions.getActiveSessions()).length, 1);
    assert.equal(writes, 0);
});

test('simulation : boutiques isolées et requête simultanée refusée sans perdre la mémoire', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const pending = simulation.runSimulation('busy-owner', async () => { await gate; });
    await assert.rejects(simulation.runSimulation('busy-owner', async () => {}), simulation.SimulationBusyError);
    await simulation.runSimulation('other-owner', async () => {
        assert.ok(simulation.simulationScope('other-owner'));
        assert.throws(() => simulation.simulationScope('busy-owner'));
    });
    release(); await pending;
    assert.equal(simulation.simulationScope('busy-owner'), undefined);
    await simulation.runSimulation('busy-owner', async () => {});
});

test('simulation : achat complet et remise à zéro sans écriture métier', async () => {
    let forbidden = 0;
    const sessions = load('backend/src/services/sessionService.ts', { '../config/supabase': {
        isSupabaseEnabled: true, supabase: { from: () => { forbidden++; throw new Error('base interdite'); } }
    } });
    const deny = async () => { forbidden++; throw new Error('mutation interdite'); };
    const flow = load('backend/src/services/whatsapp/flowHandler.ts', {
        '../sessionService': sessions,
        '../dbService': { db: { getSettings: async () => ({ deliveryEnabled: false, negotiationEnabled: false }),
            getProducts: async () => [{ id: 'p', name: 'Robe', price: 1000 }], createOrder: deny, decrementStockForItems: deny, logActivity: deny } },
        '../aiService': { generateAIResponse: async (text: string) => text === 'inconnu' ? '[ADD_TO_CART: absent | 1 | 1000]' : '[ADD_TO_CART: p | 1 | 1000]' },
        './salesEngine': load('backend/src/services/whatsapp/salesEngine.ts'), './notificationService': { sendOrderNotification: deny }, '../../utils/logger': { logger: quiet }
    });
    const responses: string[] = [];
    const sock = { sendMessage: async (_jid: string, content: { text: string }) => { responses.push(content.text); } };
    await simulation.runSimulation('flow-owner', async () => {
        await flow.handleFlow('flow-owner', simulation.SIMULATION_USER_ID, 'je prends la robe', sock, { dryRun: true });
        assert.equal((await sessions.getSession('flow-owner', simulation.SIMULATION_USER_ID)).state, 'WAITING_FOR_ADDRESS');
        await flow.handleFlow('flow-owner', simulation.SIMULATION_USER_ID, 'Cocody', sock, { dryRun: true });
        assert.equal((await sessions.getSession('flow-owner', simulation.SIMULATION_USER_ID)).state, 'IDLE');
        assert.match(responses.join(' '), /aucune commande réelle créée/);
        await sessions.clearHistory('flow-owner', simulation.SIMULATION_USER_ID);
        await flow.handleFlow('flow-owner', simulation.SIMULATION_USER_ID, 'inconnu', sock, { dryRun: true });
        assert.match(responses[responses.length - 1], /identifier cet article/);
    });
    assert.equal(forbidden, 0);
});

test('routes de simulation : identifiant client ignoré et messages invalides refusés', async () => {
    const routes: Record<string, Function> = {};
    const ids: string[] = [];
    const sessions = { addToHistory: async (tenantId: string, id: string) => {
        assert.ok(simulation.simulationScope(tenantId)); ids.push(id);
    }, clearHistory: async (tenantId: string, id: string) => { assert.ok(simulation.simulationScope(tenantId)); ids.push(id); } };
    const upload = Object.assign(() => ({ single: () => () => {} }), { memoryStorage: () => ({}) });
    load('backend/src/routes/aiRoutes.ts', {
        express: { Router: () => ({ use() {}, post: (route: string, ...handlers: Function[]) => { routes[route] = handlers[handlers.length - 1]; } }) },
        multer: upload, '../middleware/auth': { authenticateTenant() {} }, '../services/aiService': {},
        '../services/sessionService': sessions, '../services/simulationContext': simulation,
        '../services/whatsapp/flowHandler': { handleFlow: async (tenantId: string, id: string, _text: string, _sock: unknown, options: { dryRun: boolean }) => {
            assert.ok(simulation.simulationScope(tenantId)); assert.equal(options.dryRun, true); ids.push(id);
        } }
    });
    for (const route of ['/simulate', '/reset']) {
        let status = 200;
        const res = { status(code: number) { status = code; return this; }, json() {} };
        await routes[route]({ tenantId: 'route-owner', body: { message: 'bonjour', sessionId: 'vrai-client@s.whatsapp.net' } }, res);
        assert.equal(status, 200);
    }
    assert.deepEqual(ids, [simulation.SIMULATION_USER_ID, simulation.SIMULATION_USER_ID, simulation.SIMULATION_USER_ID]);
    for (const message of ['', {}, 'x'.repeat(4001)]) {
        let status = 200;
        const res = { status(code: number) { status = code; return this; }, json() {} };
        await routes['/simulate']({ tenantId: 'route-owner', body: { message } }, res);
        assert.equal(status, 400);
    }
    assert.equal(ids.length, 3);
});

for (const outcome of ['accepted', 'rejected', 'empty', 'throws']) {
    test(`emails : résultat ${outcome} pour les quatre envois`, async () => {
        const service = load('backend/src/services/resendService.ts', {
            resend: { Resend: class { emails = { send: async () => {
                if (outcome === 'throws') throw new Error('offline');
                return outcome === 'accepted' ? { data: { id: 'fixture' }, error: null }
                    : { data: null, error: outcome === 'rejected' ? { message: 'rejected' } : null };
            } }; } }
        });
        for (const name of ['sendOtpEmail', 'sendVerificationEmail', 'sendPasswordResetEmail', 'sendBotDownAlert']) {
            assert.equal((await service[name]('fixture@example.invalid', 'fixture')).success, outcome === 'accepted');
        }
    });
}

for (const mode of ['global', 'manual', 'expired', 'history']) {
    for (const kind of ['audioMessage', 'imageMessage']) {
        test(`${kind} : aucun média ni IA en mode ${mode}`, async () => {
            let media = 0, ai = 0, replies = 0;
            const history: string[] = [];
            const service = load('backend/src/services/whatsapp/messageHandler.ts', {
                '@whiskeysockets/baileys': { downloadMediaMessage: async () => { media++; return Buffer.from('fixture'); } },
                '../dbService': { db: { getSettings: async () => ({ botActive: mode !== 'global' }), isSubscriptionActive: async () => mode !== 'expired' } },
                '../sessionService': { getSession: async () => ({ autopilotEnabled: mode !== 'manual' }),
                    addToHistory: async (_tenant: string, _jid: string, _role: string, text: string) => { history.push(text); } },
                './flowHandler': { handleFlow: async () => { replies++; } },
                '../aiService': { transcribeAudio: async () => { ai++; }, analyzeImage: async () => { ai++; }, analyzePaymentReceipt: async () => { ai++; } },
                '../paymentValidationService': { processReceiptValidation: async () => { replies++; } }
            });
            await service.handleMessage('fixture', { sendMessage: async () => { replies++; } }, {
                key: { remoteJid: 'fixture@s.whatsapp.net' }, message: { [kind]: { caption: 'photo' } }
            }, mode === 'history');
            assert.equal(media, 0); assert.equal(ai, 0); assert.equal(replies, 0);
            assert.equal(history.length, 1);
        });
    }
}

test('groupes, broadcasts et chaînes ignorés avant toute lecture métier', async () => {
    let reads = 0;
    const service = load('backend/src/services/whatsapp/messageHandler.ts', {
        '@whiskeysockets/baileys': {}, '../dbService': { db: { getSettings: async () => { reads++; return {}; } } },
        '../sessionService': {}, './flowHandler': {}, '../aiService': {}, '../paymentValidationService': {}
    });
    for (const jid of ['fixture@g.us', 'status@broadcast', 'fixture@broadcast', 'fixture@newsletter']) {
        await service.handleMessage('fixture', {}, { key: { remoteJid: jid }, message: { conversation: 'bonjour' } });
    }
    assert.equal(reads, 0);
});

for (const kind of ['audioMessage', 'imageMessage']) {
    test(`${kind} actif : analyse et transmission au moteur conservées`, async () => {
        let downloads = 0, calls = 0;
        const texts: string[] = [];
        const service = load('backend/src/services/whatsapp/messageHandler.ts', {
            '@whiskeysockets/baileys': { downloadMediaMessage: async () => { downloads++; return Buffer.from('fixture'); } },
            '../dbService': { db: { getSettings: async () => ({ botActive: true }), isSubscriptionActive: async () => true, getProducts: async () => [] } },
            '../sessionService': { getSession: async () => ({ autopilotEnabled: true }), addToHistory: async () => {} },
            './flowHandler': { handleFlow: async (_tenant: string, _jid: string, text: string) => { texts.push(text); } },
            '../aiService': { transcribeAudio: async () => { calls++; return 'bonjour'; }, analyzeImage: async () => { calls++; return 'robe'; }, analyzePaymentReceipt: async () => ({ isReceipt: false }) },
            '../paymentValidationService': {}
        }, { setTimeout: (fn: () => void) => fn() });
        await service.handleMessage('fixture', { readMessages: async () => {}, sendPresenceUpdate: async () => {} }, {
            key: { remoteJid: 'fixture@s.whatsapp.net' }, message: { [kind]: {} }
        });
        assert.equal(downloads, 1); assert.equal(calls, 1); assert.equal(texts.length, 1);
        assert.match(texts[0], kind === 'audioMessage' ? /bonjour/ : /robe/);
    });
}

test('fermeture : état déconnecté, une seule relance, ancien socket ignoré', async () => {
    const sockets: any[] = [], timers: (() => void)[] = [], statuses: string[] = [];
    const service = load('backend/src/services/whatsapp/sessionManager.ts', {
        '@whiskeysockets/baileys': { __esModule: true, default: () => {
            const listeners: Record<string, Function> = {};
            const sock = { ev: { on: (event: string, fn: Function) => { listeners[event] = fn; } }, listeners, user: { id: 'fixture:1' } };
            sockets.push(sock); return sock;
        }, useMultiFileAuthState: async () => ({ state: { creds: {}, keys: {} }, saveCreds() {} }),
        fetchLatestBaileysVersion: async () => ({ version: [] }), makeCacheableSignalKeyStore: (x: unknown) => x, DisconnectReason: { loggedOut: 401 } },
        fs: { existsSync: () => true }, path, pino: () => quiet,
        '../dbService': { db: { updateTenantWhatsAppStatus: async (_tenant: string, status: string) => { statuses.push(status); }, updateTenantQRCode: async () => {} } },
        './messageHandler': {}, '../resendService': {}
    }, { setTimeout: (fn: () => void) => { timers.push(fn); } });
    const manager = new service.SessionManager();
    const started = manager.createSession('fixture');
    await new Promise(resolve => setImmediate(resolve));
    await sockets[0].listeners['connection.update']({ connection: 'open' });
    await started;
    const close = { connection: 'close', lastDisconnect: { error: { output: { statusCode: 428 } } } };
    await sockets[0].listeners['connection.update'](close);
    await sockets[0].listeners['connection.update'](close);
    assert.equal(manager.getSession('fixture').status, 'disconnected');
    assert.equal(statuses[statuses.length - 1], 'disconnected');
    assert.equal(timers.length, 1);
    timers[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sockets.length, 2);
    await sockets[1].listeners['connection.update']({ connection: 'open' });
    await sockets[0].listeners['connection.update'](close);
    assert.equal(manager.getSession('fixture').status, 'connected');
    assert.equal(timers.length, 1);
});

test('contrat de saisie : les deux parcours ivoiriens conservent les dix chiffres', () => {
    for (const [file, variable] of [['Signup', 'phone'], ['Onboarding', 'waPhone']]) {
        const source = fs.readFileSync(path.join(root, `frontend/src/pages/${file}.tsx`), 'utf8');
        const expression = source.match(new RegExp(`const (?:cleanPhone|cleaned) = (${variable}[^;]+);`))?.[1];
        assert.ok(expression);
        for (const phone of ['01 23 45 67 89', '05 23 45 67 89', '07 23 45 67 89']) {
            const digits = vm.runInNewContext(expression, { [variable]: phone });
            assert.match(`+225${digits}`, /^\+225[0-9]{10}$/);
            assert.equal(digits[0], '0');
        }
    }
});

test('statuts : une commande expédiée n\'apparaît pas comme annulée', () => {
    const metrics = load('frontend/src/utils/overviewMetrics.ts');
    // SHIPPED n'était traité nulle part côté interface et tombait dans la branche
    // par défaut « Annulée », alors que les statistiques le comptaient en recette :
    // le vendeur voyait une vente annulée et un chiffre qui montait.
    assert.equal(metrics.toUIStatus('SHIPPED'), 'PAID');
    assert.equal(metrics.toUIStatus('SHIPPING'), 'PAID');
    assert.equal(metrics.toUIStatus('PAID'), 'PAID');
});

test('statuts : un statut inconnu revient à traiter, il n\'est pas annulé', () => {
    const metrics = load('frontend/src/utils/overviewMetrics.ts');
    assert.equal(metrics.toUIStatus('UNE_NOUVEAUTE'), 'NEW');
    assert.equal(metrics.toUIStatus('PENDING'), 'NEW');
    assert.equal(metrics.toUIStatus('CONFIRMED'), 'NEW');
    assert.equal(metrics.toUIStatus('CANCELLED'), 'CANCELLED');
    assert.equal(metrics.toUIStatus('DELIVERED'), 'DELIVERED');
});

// --- Fiche livreur : ce que le livreur doit savoir, et rien d'autre ---

const slipOrder = (over: Record<string, unknown> = {}) => ({
    id: 'ORD-1757600000000-ab12c', userId: '2250777225277@s.whatsapp.net', total: 13000, status: 'PAID',
    address: 'Cocody Angré, près de la pharmacie',
    items: [
        { productId: 'p1', productName: 'Robe bazin', quantity: 2, price: 6000, selectedVariations: [{ name: 'Taille', value: 'M' }] },
        { productId: '_delivery', productName: 'Livraison', quantity: 1, price: 1000 },
    ],
    ...over,
});

test('fiche livreur : montre le reste à encaisser, pas l’identifiant WhatsApp brut', () => {
    const slip = load('frontend/src/utils/deliverySlip.ts');
    const paid = slip.buildDeliverySlip(slipOrder(), { merchantPhone: '+2250700000000', alreadyPaid: true });
    assert.match(paid, /DÉJÀ PAYÉ/);
    assert.doesNotMatch(paid, /ne rien encaisser[\s\S]*À ENCAISSER/);

    const toCollect = slip.buildDeliverySlip(slipOrder({ status: 'PENDING' }), { alreadyPaid: false });
    // Sans cette ligne, le livreur ne sait pas s'il doit réclamer de l'argent.
    assert.match(toCollect, /À ENCAISSER : 13\s?000 FCFA/);

    // L'identifiant WhatsApp brut n'est pas un numéro utilisable.
    assert.doesNotMatch(paid, /@s\.whatsapp\.net/);
    assert.match(paid, /\+2250777225277/);
});

test('fiche livreur : articles et livraison séparés, frais nuls explicites', () => {
    const slip = load('frontend/src/utils/deliverySlip.ts');
    const withFee = slip.buildDeliverySlip(slipOrder(), { alreadyPaid: true });
    assert.match(withFee, /Articles : 12\s?000 FCFA/);
    assert.match(withFee, /Livraison : 1\s?000 FCFA/);

    const noFee = slip.buildDeliverySlip(slipOrder({ total: 12000, items: [slipOrder().items[0]] }), { alreadyPaid: true });
    // « Rien d'écrit » se lirait comme « à réclamer ».
    assert.match(noFee, /Livraison : offerte/);
});

test('fiche livreur : ce qui manque est dit, jamais deviné', () => {
    const slip = load('frontend/src/utils/deliverySlip.ts');
    const incomplete = slip.buildDeliverySlip(slipOrder({ address: '   ', userId: '99999@lid' }), { alreadyPaid: false });
    assert.match(incomplete, /ADRESSE MANQUANTE/);
    assert.match(incomplete, /À compléter : adresse, contact client/);
});

test('fiche livreur : aucune marge ni prix minimum ne fuit vers le livreur', () => {
    const slip = load('frontend/src/utils/deliverySlip.ts');
    const text = slip.buildDeliverySlip(slipOrder(), { merchantPhone: '+2250700000000', alreadyPaid: true });
    // La fiche part à un tiers : elle ne doit porter que le nécessaire.
    for (const leak of [/minPrice/i, /marge/i, /prix minimum/i, /plancher/i]) {
        assert.doesNotMatch(text, leak);
    }
});

test('paiement : les adresses bouche-trou sont refusées comme destinataire du reçu', () => {
    // Extraction du garde-fou réel de la route, sans monter Express.
    const source = fs.readFileSync(path.join(root, 'backend/src/routes/paystackRoutes.ts'), 'utf8');
    const start = source.indexOf('const PLACEHOLDER_EMAIL_DOMAINS');
    const end = source.indexOf('\n}', source.indexOf('function isUsablePaymentEmail')) + 2;
    assert.ok(start >= 0 && end > start);
    const sandbox: any = {};
    vm.runInNewContext(
        ts.transpileModule(source.slice(start, end) + '\nthis.check = isUsablePaymentEmail;',
            { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText,
        sandbox, { timeout: 2000 });
    const check = sandbox.check;

    // Ces deux-là circulaient réellement et passaient toute vérification de présence.
    assert.equal(check('user@example.com'), false);
    assert.equal(check('vendor@djassabot.com'), false);
    assert.equal(check(undefined), false);
    assert.equal(check('pas-une-adresse'), false);
    assert.equal(check('  Alex@Gmail.com '), true);
});

test('plus de trois articles : le dépassement est annoncé, pas jeté', async () => {
    const messages: string[] = [];
    const warnings: unknown[][] = [];
    const added: unknown[] = [];
    const catalogue = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: `Article ${id}`, price: 1000 }));
    const tags = catalogue.map(p => `[ADD_TO_CART: ${p.id} | 1 | 1000]`).join(' ');
    const service = load('backend/src/services/whatsapp/flowHandler.ts', {
        '../dbService': { db: { getSettings: async () => ({ negotiationEnabled: false }), getProducts: async () => catalogue,
            logActivity: async (...args: unknown[]) => { warnings.push(args); } } },
        '../sessionService': { getSession: async () => ({ state: 'IDLE', history: [] }), addToHistory: async () => {},
            addItemToSessionCart: async (_t: string, _j: string, item: unknown) => { added.push(item); return { items: added, total: 0 }; },
            updateSession: async () => {} },
        '../aiService': { generateAIResponse: async () => `C'est noté ! ${tags}` },
        './notificationService': {}, './salesEngine': load('backend/src/services/whatsapp/salesEngine.ts'),
        '../../utils/logger': { logger: quiet }
    });
    await service.handleFlow('owner', 'client', 'je prends tout', { sendMessage: async (_jid: string, m: { text: string }) => { messages.push(m.text); } });
    // Trois articles entrent au panier, et les deux autres ne disparaissent pas en silence.
    assert.equal(added.length, 3);
    assert.ok(messages.some(m => /prochain message/.test(m)));
    assert.ok(warnings.some(w => w[1] === 'warning' && /au-delà de la limite/.test(String(w[2]))));
});

for (const pause of ['global', 'conversation', 'lecture-impossible']) {
    test(`pause pendant la réflexion IA (${pause}) : la réponse est abandonnée`, async () => {
        const messages: string[] = [];
        const service = load('backend/src/services/whatsapp/flowHandler.ts', {
            '../dbService': { db: {
                getSettings: async () => pause === 'lecture-impossible'
                    ? (() => { throw new Error('base injoignable'); })()
                    : { negotiationEnabled: false, botActive: pause !== 'global' },
                getProducts: async () => [], logActivity: async () => {} } },
            '../sessionService': {
                // Au premier appel le bot a le droit de parler ; au recontrôle, plus.
                getSession: async () => ({ state: 'IDLE', history: [], autopilotEnabled: pause !== 'conversation' }),
                addToHistory: async () => {}, addItemToSessionCart: async () => {}, updateSession: async () => {} },
            '../aiService': { generateAIResponse: async () => 'Bonjour ! Voici nos robes.' },
            './notificationService': {}, './salesEngine': load('backend/src/services/whatsapp/salesEngine.ts'),
            '../../utils/logger': { logger: quiet }
        });
        await service.handleFlow('owner', 'client', 'bonjour',
            { sendMessage: async (_jid: string, m: { text: string }) => { messages.push(m.text); } },
            {}, { settings: { negotiationEnabled: false }, products: [] });
        // Le bot ne doit pas parler par-dessus le vendeur qui vient de reprendre.
        assert.deepEqual(messages, []);
    });
}
