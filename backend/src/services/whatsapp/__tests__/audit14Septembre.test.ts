import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as simulation from '../../simulationContext';

// Audit de viabilité du 14 septembre 2026 : chaque test fixe un invariant corrigé.
// Aucun .env, aucune clé, aucun service distant : dépendances remplacées.
const root = path.resolve(__dirname, '../../../../..');
const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
/** Les objets créés dans la VM n'ont pas les prototypes du test : on compare leur contenu. */
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
            throw new Error(`Dépendance non autorisée : ${id}`);
        }, ...extra
    }, { filename, timeout: 2000 });
    return module.exports;
}

const sales = () => load('backend/src/services/whatsapp/salesEngine.ts');

const ZONES = { deliveryEnabled: true, deliveryZones: [{ name: 'Cocody', price: 1500 }, { name: 'Yopougon', price: 2000 }], freeDeliveryThreshold: 0 };
const ROBE = { id: 'robe', name: 'Robe', price: 10000, stock: 5 };
const SAC = { id: 'sac', name: 'Sac', price: 5000, stock: 3 };
const line = (product: { id: string; name: string; price: number }, quantity = 1, extra: Record<string, unknown> = {}) =>
    ({ productId: product.id, productName: product.name, price: product.price, quantity, ...extra });

// ---------------------------------------------------------------------------
// A04 — adresse, négation, livraison et accord explicite
// ---------------------------------------------------------------------------

test('A04 adresse : une zone citée pour être exclue n’est pas une adresse', () => {
    const { looksLikeAddress } = sales();
    for (const text of ['Je ne suis pas à Cocody', "c'est pas à Yopougon", "j'habite plus à Abobo", 'hors de Cocody']) {
        assert.equal(looksLikeAddress(text, ['Cocody']), false, text);
    }
    assert.equal(looksLikeAddress('Cocody Angré, pas loin de la pharmacie', ['Cocody']), true);
});

test('A04 livraison : le seuil de gratuité ne vaut que dans une zone desservie', () => {
    const { computeDelivery } = sales();
    const settings = { ...ZONES, freeDeliveryThreshold: 50000 };
    const outside = computeDelivery(60000, 'Paris', settings);
    assert.equal(outside.known, false); assert.equal(outside.fee, 0);
    const offered = computeDelivery(60000, 'Cocody', settings);
    assert.equal(offered.known, true); assert.equal(offered.label, 'Livraison offerte');
    // Un tarif enregistré en texte reste un tarif.
    assert.equal(computeDelivery(1000, 'Cocody', { ...ZONES, deliveryZones: [{ name: 'Cocody', price: '1500' }] }).fee, 1500);
});

test('A04 confirmation : seul un accord sans réserve vaut « oui »', () => {
    const { isConfirmIntent, isNegativeReply } = sales();
    for (const text of ['oui', 'Ouiii', 'OK je confirme', "c'est bon pour moi", '👍', 'vas-y', "d'accord merci", 'Oui.']) {
        assert.equal(isConfirmIntent(text), true, text);
    }
    for (const text of ['oui mais ajoute un sac', 'non', 'oui ?', 'ok 2 robes', 'combien la livraison', 'pas encore', 'Cocody', '😂']) {
        assert.equal(isConfirmIntent(text), false, text);
    }
    assert.equal(isNegativeReply('non merci'), true);
    assert.equal(isNegativeReply('non Yopougon'), false);
});

test('A04 récapitulatif : un tarif inconnu ne produit jamais un total', () => {
    const { confirmationRecap } = sales();
    const unknown = confirmationRecap([line(ROBE)], { known: false, fee: 0, label: 'Livraison à confirmer' }, 'Bassam');
    assert.match(unknown, /tarif à confirmer/);
    assert.match(unknown, /livraison en plus/);
    assert.doesNotMatch(unknown, /\*Total : /);
    assert.match(confirmationRecap([line(ROBE)], { known: true, fee: 1500, label: 'Livraison (Cocody)' }, 'Cocody'), /\*Total : 11\s?500 FCFA\*/);
});

// ---------------------------------------------------------------------------
// A03 / A05 — panier modifiable, revalidé au moment du « oui »
// ---------------------------------------------------------------------------

test('A03 panier : retrait et quantité appliqués au panier réel, ambiguïté posée en question', () => {
    const { applyCartEdits } = sales();
    const cart = [
        line(ROBE, 1, { selectedVariations: [{ name: 'Taille', value: 'M' }] }),
        line(ROBE, 1, { selectedVariations: [{ name: 'Taille', value: 'L' }] }),
        line(SAC),
    ];
    const removed = applyCartEdits(cart, [{ kind: 'remove', productRef: 'sac' }], [ROBE, SAC]);
    assert.equal(removed.ok, true);
    assert.deepEqual(plain(removed.items).map((i: any) => i.productId), ['robe', 'robe']);

    const ambiguous = applyCartEdits(cart, [{ kind: 'set_quantity', productRef: 'robe', quantity: 2 }], [ROBE, SAC]);
    assert.equal(ambiguous.ok, false); assert.match(ambiguous.message, /Lequel/);

    const tooMany = applyCartEdits([line(SAC)], [{ kind: 'set_quantity', productRef: 'Sac', quantity: 9 }], [SAC]);
    assert.equal(tooMany.ok, false); assert.match(tooMany.message, /3 maximum/);

    assert.equal(applyCartEdits([line(SAC)], [{ kind: 'remove', productRef: 'chapeau' }], [SAC]).ok, false);

    const set = applyCartEdits([line(SAC)], [{ kind: 'set_quantity', productRef: 'sac', quantity: 2 }], [SAC]);
    assert.equal(set.ok, true); assert.equal(plain(set.items)[0].quantity, 2);
});

test('A03 tags : retrait et quantité reconnus, balises malformées ou inventées retirées', () => {
    const { parseAIResponse } = sales();
    const parsed = parseAIResponse("C'est fait [REMOVE_FROM_CART: sac] [SET_QUANTITY: robe | 2] [SET_QUANTITY: robe | 1.5] [CONFIRM_ORDER]");
    assert.deepEqual(plain(parsed.cartEdits), [
        { kind: 'remove', productRef: 'sac' },
        { kind: 'set_quantity', productRef: 'robe', quantity: 2 },
    ]);
    assert.equal(parsed.invalidDealCount, 1);
    assert.equal(parsed.cleaned, "C'est fait");
});

test('A05 revalidation : prix, options, stock et prix négatif contrôlés avant d’enregistrer', () => {
    const { revalidateCart } = sales();
    const chemise = { id: 'chemise', name: 'Chemise', price: 8000, stock: 10, variations: [
        { name: 'Taille', options: [{ value: 'S', stock: 1, priceModifier: 0 }, { value: 'XL', priceModifier: 1000 }] },
    ] };
    const soldee = { id: 'soldee', name: 'Soldée', price: 1000, stock: 10, variations: [
        { name: 'Couleur', options: [{ value: 'Bleu', priceModifier: -1500 }] },
    ] };
    const { items, issues } = revalidateCart([ROBE, chemise, soldee], [
        line(ROBE, 1, { price: 12000 }),                                                   // au-dessus du prix public
        line(chemise, 1, { price: 5000, selectedVariations: [{ name: 'Taille', value: 'XL' }] }), // sous le plancher 7 200 + 1 000
        line(chemise, 2, { selectedVariations: [{ name: 'Taille', value: 'S' }] }),         // 2 demandées, 1 en stock
        line(chemise, 1, { selectedVariations: [{ name: 'Taille', value: 'M' }] }),         // option supprimée depuis
        line(soldee, 1, { price: 0, selectedVariations: [{ name: 'Couleur', value: 'Bleu' }] }), // −500 FCFA
    ], { negotiationEnabled: true, negotiationMargin: 10 });
    assert.deepEqual(plain(issues).map((i: any) => [i.kind, i.newPrice ?? i.available ?? null]), [
        ['PRICE', 10000], ['PRICE', 8200], ['STOCK', 1], ['REMOVED', null], ['REMOVED', null],
    ]);
    assert.deepEqual(plain(items).map((i: any) => i.price), [10000, 8200]);
});

test('A05 produit : une combinaison d’options au prix négatif est refusée, même en mise à jour partielle', () => {
    const { validateProductInput } = load('backend/src/services/productValidation.ts');
    const variations = [
        { name: 'Taille', options: [{ value: 'S', priceModifier: -800 }] },
        { name: 'Couleur', options: [{ value: 'Bleu', priceModifier: -800 }] },
    ];
    assert.match(validateProductInput({ name: 'Robe', price: 1000, stock: 10, variations }, { requireName: true }), /-600 FCFA/);
    assert.match(validateProductInput({ variations }, { current: { price: 1000 } }), /-600 FCFA/);
    assert.match(validateProductInput({ price: 500 }, { current: { minPrice: 800 } }), /prix minimum/);
    assert.equal(validateProductInput({ name: 'Robe', price: 2000, variations }, { requireName: true }), null);
    assert.equal(validateProductInput({ name: 'Échantillon', price: 0 }, { requireName: true }), null);
});

// ---------------------------------------------------------------------------
// Parcours WhatsApp complet (flowHandler, dépendances remplacées)
// ---------------------------------------------------------------------------

function flowHarness({ session, settings = {}, products = [ROBE, SAC], ai = '', db = {} }: {
    session: Record<string, unknown>;
    settings?: Record<string, unknown>;
    products?: any[];
    ai?: string | ((text: string) => string);
    db?: Record<string, unknown>;
}) {
    const state = { session: plain({ autopilotEnabled: true, history: [], ...session }) as any, messages: [] as string[], events: [] as any[] };
    const total = (items: any[]) => items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const sessions = {
        getSession: async () => plain(state.session),
        addToHistory: async () => {},
        updateSession: async (_t: string, _j: string, patch: Record<string, unknown>) => {
            state.session = plain({ ...state.session, ...patch });
            return plain(state.session);
        },
        addItemToSessionCart: async (_t: string, _j: string, item: any) => {
            const items = [...(state.session.tempOrder?.items || []), item];
            state.session = plain({ ...state.session, tempOrder: {
                ...state.session.tempOrder, items, total: total(items),
                idempotencyKey: state.session.tempOrder?.idempotencyKey ?? 'cle-panier',
            } });
            return plain(state.session.tempOrder);
        },
        replaceSessionCart: async (_t: string, _j: string, items: any[]) => {
            state.session = plain({ ...state.session, tempOrder: { ...state.session.tempOrder, items, total: total(items) } });
            return plain(state.session.tempOrder);
        },
    };
    const service = load('backend/src/services/whatsapp/flowHandler.ts', {
        '../dbService': { db: {
            getSettings: async () => ({ botActive: true, negotiationEnabled: false, ...settings }),
            getProducts: async () => products,
            getProductById: async (_t: string, id: string) => products.find(p => p.id === id),
            logActivity: async (...args: unknown[]) => { state.events.push(['log', ...args]); },
            placeOrder: async (...args: any[]) => {
                state.events.push(['placeOrder', ...args]);
                return { status: 'created', order: { id: 'ORD-1', total: args[3] } };
            },
            ...db,
        } },
        '../sessionService': sessions,
        '../aiService': { generateAIResponse: async (text: string) => (typeof ai === 'function' ? ai(text) : ai) },
        './salesEngine': sales(),
        './notificationService': { sendOrderNotification: async () => { state.events.push(['merchant']); } },
        '../../utils/logger': { logger: quiet },
    });
    return {
        state,
        run: (text: string) => service.handleFlow('owner', 'client', text, {
            sendMessage: async (_jid: string, message: { text?: string }) => { if (message.text) state.messages.push(message.text); },
        }),
        orders: () => state.events.filter(e => e[0] === 'placeOrder'),
        logs: () => state.events.filter(e => e[0] === 'log'),
        last: () => state.messages[state.messages.length - 1],
    };
}

const addressCart = (items = [line(ROBE)]) => ({
    state: 'WAITING_FOR_ADDRESS',
    tempOrder: { items, total: items.reduce((s, i) => s + i.price * i.quantity, 0), idempotencyKey: 'cle-panier' },
});

const confirmationCart = (over: Record<string, unknown> = {}, items = [line(ROBE)]) => ({
    state: 'WAITING_FOR_CONFIRMATION',
    tempOrder: { items, total: 10000, idempotencyKey: 'cle-panier', address: 'Cocody Angré', quotedTotal: 11500, quotedDeliveryKnown: true, recapShown: true, ...over },
});

test('A04 parcours : l’adresse montre le total livraison comprise, seul « oui » enregistre', async () => {
    const h = flowHarness({ session: addressCart(), settings: ZONES });
    await h.run('Cocody Angré, carrefour pharmacie');
    assert.equal(h.state.session.state, 'WAITING_FOR_CONFIRMATION');
    assert.equal(h.orders().length, 0);
    assert.match(h.last(), /Livraison \(Cocody\) : 1\s?500 FCFA/);
    assert.match(h.last(), /\*Total : 11\s?500 FCFA\*/);
    assert.match(h.last(), /Répondez \*OUI\*/);

    await h.run('Oui je confirme');
    const [call] = h.orders();
    assert.equal(call[4], 11500, 'le total enregistré est celui qui a été accepté');
    assert.deepEqual(plain(call[3]).map((i: any) => [i.productId, i.price]), [['robe', 10000], ['_delivery', 1500]]);
    assert.equal(call[6], 'cle-panier');
    assert.equal(h.state.session.state, 'IDLE');
    assert.match(h.last(), /Commande confirmée/);
    assert.ok(h.state.events.some(e => e[0] === 'merchant'));
});

test('A04 parcours : zone inconnue demandée une fois, jamais de total inventé', async () => {
    const h = flowHarness({ session: addressCart(), settings: ZONES });
    await h.run('Grand-Bassam quartier France');
    assert.equal(h.state.session.state, 'WAITING_FOR_ADDRESS');
    assert.match(h.last(), /Nous livrons à/);
    await h.run('Cocody');
    assert.equal(h.state.session.tempOrder.address, 'Grand-Bassam quartier France, Cocody');
    assert.match(h.last(), /Livraison \(Cocody\)/);

    const unknown = flowHarness({ session: addressCart(), settings: ZONES });
    await unknown.run('Grand-Bassam quartier France');
    await unknown.run('Anyama');
    assert.equal(unknown.state.session.state, 'WAITING_FOR_CONFIRMATION');
    assert.match(unknown.last(), /livraison en plus/);
    await unknown.run('oui');
    const [call] = unknown.orders();
    assert.equal(call[4], 10000);
    assert.equal(plain(call[3]).length, 1, 'aucune ligne de livraison inventée');
});

test('A04 parcours : négation et seuil hors zone ne produisent ni adresse ni gratuité', async () => {
    const negation = flowHarness({ session: addressCart(), settings: ZONES, ai: 'Pas de souci ! Dans quelle commune êtes-vous ?' });
    await negation.run('Je ne suis pas à Cocody');
    assert.equal(negation.state.session.state, 'WAITING_FOR_ADDRESS');
    assert.equal(negation.last(), 'Pas de souci ! Dans quelle commune êtes-vous ?');

    const threshold = flowHarness({ session: addressCart(), settings: { ...ZONES, freeDeliveryThreshold: 5000 } });
    await threshold.run('Abobo quartier Plaque');
    assert.match(threshold.last(), /Nous livrons à/);
    assert.doesNotMatch(threshold.last(), /offerte/);
});

test('A04 parcours : après une autre réponse, « oui » remontre le récapitulatif avant de commander', async () => {
    const h = flowHarness({ session: confirmationCart(), settings: ZONES, ai: 'Nous livrons sous 24 h à Cocody.' });
    await h.run('vous livrez quand ?');
    assert.equal(h.state.session.tempOrder.recapShown, false);
    await h.run('ok');
    assert.equal(h.orders().length, 0);
    assert.match(h.last(), /Récapitulatif/);
    await h.run('oui');
    assert.equal(h.orders().length, 1);
});

test('A03 parcours : un ajout pendant l’attente d’adresse entre vraiment au panier', async () => {
    const h = flowHarness({ session: addressCart(), settings: ZONES, ai: 'Je vous ajoute le sac 👍 [ADD_TO_CART: sac | 1 | 5000]' });
    await h.run('ajoute aussi le sac');
    assert.deepEqual(plain(h.state.session.tempOrder.items).map((i: any) => i.productId), ['robe', 'sac']);
    assert.match(h.last(), /Je vous ajoute le sac/);
    assert.match(h.last(), /1x Sac/);
    assert.match(h.last(), /Quelle est l'adresse de livraison/);
});

test('A03 parcours : un retrait pendant la confirmation remontre le récapitulatif à jour', async () => {
    const h = flowHarness({
        session: confirmationCart({ total: 15000, quotedTotal: 16500 }, [line(ROBE), line(SAC)]),
        settings: ZONES, ai: "C'est retiré. [REMOVE_FROM_CART: sac]",
    });
    await h.run('enlève le sac finalement');
    assert.equal(h.state.session.state, 'WAITING_FOR_CONFIRMATION');
    assert.deepEqual(plain(h.state.session.tempOrder.items).map((i: any) => i.productId), ['robe']);
    assert.equal(h.state.session.tempOrder.quotedTotal, 11500);
    assert.equal(h.state.session.tempOrder.recapShown, true);
    assert.match(h.last(), /\*Total : 11\s?500 FCFA\*/);
    assert.equal(h.orders().length, 0);
});

test('A03 parcours : pendant un choix d’option, une promesse d’ajout n’est pas transmise', async () => {
    const chemise = { id: 'chemise', name: 'Chemise', price: 8000, stock: 5, variations: [{ name: 'Taille', options: [{ value: 'S' }, { value: 'M' }] }] };
    const h = flowHarness({
        session: { state: 'WAITING_FOR_VARIATION', tempOrder: {
            items: [], total: 0, productId: 'chemise', productName: 'Chemise', basePrice: 8000, quantity: 1,
            variationIndex: 0, selectedVariations: [], priceAdjustment: 0,
        } },
        products: [chemise, SAC], ai: 'Oui, en coton ! Je vous ajoute aussi le sac. [ADD_TO_CART: sac | 1 | 5000]',
    });
    await h.run('elle est en coton ?');
    assert.doesNotMatch(h.last(), /Je vous ajoute/);
    assert.match(h.last(), /Terminons d'abord le choix pour Chemise/);
    assert.equal(h.state.session.tempOrder.items.length, 0);
});

test('A05 parcours : des remises d’options ne produisent jamais un prix négatif au panier', async () => {
    const robe = { id: 'robe', name: 'Robe', price: 1000, stock: 10, variations: [
        { name: 'Taille', options: [{ value: 'S', priceModifier: -800 }] },
        { name: 'Couleur', options: [{ value: 'Bleu', priceModifier: -800 }] },
    ] };
    const h = flowHarness({ products: [robe], session: { state: 'WAITING_FOR_VARIATION', tempOrder: {
        items: [], total: 0, productId: 'robe', productName: 'Robe', basePrice: 1000, quantity: 1,
        variationIndex: 1, priceAdjustment: -800, selectedVariations: [{ name: 'Taille', value: 'S' }],
    } } });
    await h.run('Bleu');
    assert.equal(h.state.session.state, 'IDLE');
    assert.equal(h.state.session.tempOrder, undefined);
    assert.match(h.last(), /prix est à corriger/);
    assert.match(String(h.logs()[0][3]), /corrigez les suppléments/);
});

test('A05 parcours : un prix catalogue changé avant le « oui » fait revalider le montant', async () => {
    const h = flowHarness({ session: confirmationCart(), settings: ZONES, products: [{ ...ROBE, price: 12000 }] });
    await h.run('oui');
    assert.equal(h.orders().length, 0);
    assert.match(h.last(), /le prix est maintenant de 12\s?000 FCFA/);
    assert.match(h.last(), /\*Total : 13\s?500 FCFA\*/);
    assert.equal(h.state.session.tempOrder.quotedTotal, 13500);
    await h.run('oui');
    assert.equal(h.orders()[0][4], 13500);
});

test('A02 parcours : échec d’enregistrement, panier conservé et incertitude signalée au vendeur', async () => {
    const notPlaced = flowHarness({ session: confirmationCart(), settings: ZONES, db: {
        placeOrder: async () => { throw Object.assign(new Error('transaction annulée'), { code: 'ORDER_NOT_PLACED' }); },
    } });
    await notPlaced.run('oui');
    assert.equal(notPlaced.state.session.state, 'WAITING_FOR_CONFIRMATION');
    assert.match(notPlaced.last(), /Répondez \*OUI\* dans un instant/);
    assert.equal(notPlaced.logs().length, 0);

    const uncertain = flowHarness({ session: confirmationCart(), settings: ZONES, db: {
        placeOrder: async () => { throw new Error('connexion perdue'); },
    } });
    await uncertain.run('oui');
    assert.match(String(uncertain.logs()[0][3]), /incertain/);
});

test('A02 parcours : un panier sans clé en reçoit une avant l’enregistrement', async () => {
    const h = flowHarness({ session: confirmationCart({ idempotencyKey: undefined }), settings: ZONES });
    await h.run('oui');
    assert.match(String(h.orders()[0][6]), /^[0-9a-f-]{36}$/);
});

// ---------------------------------------------------------------------------
// A02 / A10 — base : commande et statut transactionnels
// ---------------------------------------------------------------------------

function loadDb(client: unknown) {
    return load('backend/src/services/dbService.ts', {
        fs: { existsSync: () => false, mkdirSync() {}, writeFileSync() {} }, path,
        './tenantService': {}, '../types': {},
        '../config/supabase': { isSupabaseEnabled: true, supabase: client },
        './whatsapp/salesEngine': { DELIVERY_ITEM_ID: '_delivery' },
    }).db;
}

const orderRow = { id: 'ORD-1', tenant_id: 'owner', user_id: 'client@s.whatsapp.net', items: [], total: 11500, status: 'PENDING', address: 'Cocody', created_at: '2026-09-14T10:00:00Z' };
const cartLines = [{ productId: 'robe', productName: 'Robe', price: 10000, quantity: 1 }];
const orderQuery = (data: unknown, error: unknown = null) => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data, error }) });

test('A02 base : place_order en une transaction, commande et manques restitués', async () => {
    const calls: any[] = [];
    const logs: unknown[] = [];
    const created = loadDb({
        rpc: async (name: string, args: any) => { calls.push([name, args]); return { data: { status: 'created', order: orderRow }, error: null }; },
        from: () => ({ insert: async (rows: unknown) => { logs.push(rows); return { error: null }; } }),
    });
    const result = await created.placeOrder('owner', 'client@s.whatsapp.net', cartLines, 11500, 'Cocody', 'cle-panier');
    assert.equal(result.status, 'created');
    assert.equal(result.order.userId, 'client@s.whatsapp.net');
    assert.equal(calls[0][0], 'place_order');
    assert.equal(calls[0][1].p_idempotency_key, 'cle-panier');
    assert.equal(calls[0][1].p_total, 11500);
    assert.equal(logs.length, 1, 'la vente est journalisée');

    const short = loadDb({ rpc: async () => ({ data: { status: 'insufficient_stock', failures: [{ productId: 'robe', productName: 'Robe', requested: 2, available: 1 }] }, error: null }) });
    const refused = await short.placeOrder('owner', 'client', cartLines, 10000, 'Cocody', 'k');
    assert.equal(refused.status, 'insufficient_stock');
    assert.equal(refused.failures[0].available, 1);
});

test('A02 base : réponse perdue, la clé tranche avant toute conclusion', async () => {
    const lost = loadDb({
        rpc: async () => ({ data: null, error: { message: 'fetch failed' } }),
        from: (table: string) => table === 'orders' ? orderQuery(orderRow) : { insert: async () => ({ error: null }) },
    });
    const recovered = await lost.placeOrder('owner', 'client', cartLines, 11500, 'Cocody', 'cle-panier');
    assert.equal(recovered.status, 'created');
    assert.equal(recovered.recovered, true);

    const absent = loadDb({ rpc: async () => { throw new Error('socket hang up'); }, from: () => orderQuery(null) });
    await assert.rejects(absent.placeOrder('owner', 'client', cartLines, 11500, 'Cocody', 'cle-panier'),
        (error: any) => error.code === 'ORDER_NOT_PLACED');

    // Recherche impossible : ni succès ni « pas enregistrée » ne peuvent être affirmés.
    const blind = loadDb({ rpc: async () => ({ data: null, error: { message: 'fetch failed' } }), from: () => orderQuery(null, { message: 'offline' }) });
    await assert.rejects(blind.placeOrder('owner', 'client', cartLines, 11500, 'Cocody', 'cle-panier'),
        (error: any) => error.code !== 'ORDER_NOT_PLACED');
});

test('A02 base : changement de statut transactionnel, journal seulement quand il change', async () => {
    const calls: any[] = [];
    const logs: unknown[] = [];
    const responses: unknown[] = [
        { data: { status: 'updated', from: 'PENDING', order: { ...orderRow, status: 'CANCELLED' } }, error: null },
        { data: { status: 'unchanged', from: 'CANCELLED', order: { ...orderRow, status: 'CANCELLED' } }, error: null },
        { data: { status: 'not_allowed', from: 'DELIVERED', order: { ...orderRow, status: 'DELIVERED' } }, error: null },
    ];
    const db = loadDb({
        rpc: async (name: string, args: any) => { calls.push([name, args]); return responses.shift(); },
        from: () => ({ insert: async (rows: unknown) => { logs.push(rows); return { error: null }; } }),
    });
    assert.equal((await db.transitionOrderStatus('owner', 'ORD-1', 'CANCELLED')).status, 'updated');
    assert.equal((await db.transitionOrderStatus('owner', 'ORD-1', 'CANCELLED')).status, 'unchanged');
    const late = await db.transitionOrderStatus('owner', 'ORD-1', 'PAID', { allowedFrom: ['PENDING', 'CONFIRMED'] });
    assert.equal(late.status, 'not_allowed');
    assert.equal(late.from, 'DELIVERED');
    assert.deepEqual(plain(calls[2][1].p_allowed_from), ['PENDING', 'CONFIRMED']);
    assert.equal(logs.length, 1);
});

test('A02 base sans fonction SQL : la seconde annulation simultanée ne rend pas le stock', async () => {
    let restocks = 0;
    const updates = [{ data: { ...orderRow, status: 'CANCELLED' }, error: null }, { data: null, error: null }];
    const db = loadDb({
        rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'function not found' } }),
        from: () => ({ update() { return this; }, eq() { return this; }, select() { return this; },
            maybeSingle: async () => updates.shift(), insert: async () => ({ error: null }) }),
    });
    // Deux lectures « PENDING » simultanées, puis la relecture après la course perdue.
    const reads = [{ ...orderRow, status: 'PENDING' }, { ...orderRow, status: 'PENDING' }, { ...orderRow, status: 'CANCELLED' }];
    db.getOrderById = async () => reads.shift();
    db.restockItems = async () => { restocks++; };
    const first = await db.transitionOrderStatus('owner', 'ORD-1', 'CANCELLED');
    const second = await db.transitionOrderStatus('owner', 'ORD-1', 'CANCELLED');
    assert.equal(first.status, 'updated');
    assert.equal(second.status, 'unchanged');
    assert.equal(restocks, 1);
});

test('A02 route statut : stock manquant, commande absente et panne ont chacune leur réponse', async () => {
    const source = fs.readFileSync(path.join(root, 'backend/src/index.ts'), 'utf8');
    const start = source.indexOf("app.put('/api/orders/:id/status'");
    const end = source.indexOf('// Dashboard', start);
    assert.ok(start >= 0 && end > start);
    const outcomes: unknown[] = [
        { status: 'insufficient_stock', from: 'CANCELLED', failures: [{ productName: 'Robe', available: 1 }] },
        { status: 'not_found' },
        new Error('offline'),
        { status: 'updated', from: 'PENDING', order: { id: 'ORD-1', status: 'PAID' } },
    ];
    let handler: Function = () => { throw new Error('route absente'); };
    vm.runInNewContext(ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, {
        app: { put: (_url: string, _auth: unknown, _subscription: unknown, fn: Function) => { handler = fn; } },
        authenticateTenant() {}, checkSubscription() {}, logger: quiet,
        db: { transitionOrderStatus: async () => { const next = outcomes.shift(); if (next instanceof Error) throw next; return next; } },
    }, { timeout: 2000 });
    const expected: [number, RegExp][] = [[409, /Stock insuffisant.*Robe \(1 disponible\)/], [404, /introuvable/], [503, /Réessayez/], [200, /ORD-1/]];
    for (const [code, pattern] of expected) {
        let status = 200;
        let payload: unknown;
        const res = { status(value: number) { status = value; return this; }, json(value: unknown) { payload = value; } };
        await handler({ tenantId: 'owner', params: { id: 'ORD-1' }, body: { status: 'PAID' } }, res);
        assert.equal(status, code);
        assert.match(JSON.stringify(payload), pattern);
    }
});

// ---------------------------------------------------------------------------
// A13 — Inbox ; session ; relance de panier
// ---------------------------------------------------------------------------

test('A13 Inbox : un identifiant @lid est gardé tel quel pour l’envoi manuel', async () => {
    const routes: Record<string, Function> = {};
    const sent: string[] = [];
    const router = { use() {}, get(url: string, fn: Function) { routes[`GET ${url}`] = fn; }, post(url: string, fn: Function) { routes[`POST ${url}`] = fn; } };
    load('backend/src/routes/chatRoutes.ts', {
        express: { Router: () => router }, '../middleware/auth': {},
        '../services/sessionService': { addToHistory: async () => {} },
        '../services/baileysManager': { whatsappManager: { getSession: async () => ({
            status: 'connected', sock: { sendMessage: async (jid: string) => { sent.push(jid); } },
        }) } },
    });
    const res = { status() { return this; }, json() {} };
    for (const jid of ['123456789@lid', '2250700000000@s.whatsapp.net', '2250700000000']) {
        await routes['POST /:jid/send']({ tenantId: 't', params: { jid }, body: { text: 'Bonjour' } }, res);
    }
    assert.deepEqual(sent, ['123456789@lid', '2250700000000@s.whatsapp.net', '2250700000000@s.whatsapp.net']);
});

test('A03 session : remplacer les articles garde la clé et l’adresse du panier', async () => {
    let saved: any;
    const row = { id: 'owner:client', tenant_id: 'owner', user_phone: 'client', state: 'WAITING_FOR_CONFIRMATION', history: [],
        temp_order: { items: [line(ROBE)], total: 10000, idempotencyKey: 'cle-panier', address: 'Cocody' },
        last_interaction: new Date().toISOString() };
    const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: row, error: null }),
        upsert: async (payload: unknown) => { saved = payload; return { error: null }; } };
    const sessions = load('backend/src/services/sessionService.ts', { '../config/supabase': { isSupabaseEnabled: true, supabase: { from: () => query } } });
    await sessions.replaceSessionCart('owner', 'client', [line(ROBE, 3)]);
    assert.equal(saved.temp_order.idempotencyKey, 'cle-panier');
    assert.equal(saved.temp_order.address, 'Cocody');
    assert.equal(saved.temp_order.total, 30000);
});

test('A04 relance : un récapitulatif resté sans « oui » est relancé et devra être revu', async () => {
    const updates: unknown[] = [];
    const sent: string[] = [];
    const conversation = { tenantId: 'owner', userId: 'client', state: 'WAITING_FOR_CONFIRMATION', autopilotEnabled: true, reminderSent: false,
        lastInteraction: new Date(Date.now() - 60 * 60 * 1000), tempOrder: { items: [], total: 10000, summary: '1x Robe', recapShown: true } };
    const service = load('backend/src/services/abandonedCartService.ts', {
        './sessionService': {
            getActiveSessions: async () => [conversation],
            getSession: async () => conversation,
            updateSession: async (_t: string, _u: string, patch: unknown) => { updates.push(plain(patch)); },
        },
        './baileysManager': { whatsappManager: { getSession: async () => ({
            status: 'connected', sock: { sendMessage: async (_j: string, m: { text: string }) => { sent.push(m.text); } },
        }) } },
        './dbService': { db: { getSettings: async () => ({ botActive: true }), isSubscriptionActive: async () => true } },
    }, { setTimeout: (fn: () => void) => fn() });
    await service.checkAbandonedCarts();
    assert.match(sent[0], /répondez \*OUI\*/);
    assert.deepEqual(updates, [
        { tempOrder: { items: [], total: 10000, summary: '1x Robe', recapShown: false } },
        { reminderSent: true },
    ]);
});
