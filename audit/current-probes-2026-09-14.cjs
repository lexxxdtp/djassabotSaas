// Reproductions d'audit, PAS tests d'acceptation : chaque assertion constate un défaut actuel.
// Aucune clé, aucun .env, aucun service distant. Modules chargés dans une VM à dépendances autorisées.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('../backend/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
const clone = v => JSON.parse(JSON.stringify(v));
function load(file, deps = {}, extra = {}) {
  const filename = path.join(root, file);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    module, exports: module.exports, console: quiet, Buffer, __dirname: path.dirname(filename),
    process: { env: { NODE_ENV: 'production' } },
    require(id) {
      if (Object.hasOwn(deps, id)) return deps[id];
      if (id === 'crypto' || id === 'node:crypto') return require('node:crypto');
      throw new Error(`Dépendance non autorisée : ${id}`);
    }, ...extra
  }, { filename, timeout: 2000 });
  return module.exports;
}
const sales = load('backend/src/services/whatsapp/salesEngine.ts');
const validation = load('backend/src/services/productValidation.ts');
function loadDb(client) {
  return load('backend/src/services/dbService.ts', {
    fs: { existsSync: () => false, mkdirSync() {}, writeFileSync() {} }, path,
    './tenantService': {}, '../types': {},
    '../config/supabase': { isSupabaseEnabled: true, supabase: client },
    './whatsapp/salesEngine': sales
  }).db;
}
function flowHarness({ state = 'WAITING_FOR_ADDRESS', items, products = [], ai = '', settings = {}, temp = {} }) {
  const messages = [], events = [];
  let session = { state, autopilotEnabled: true, history: [], tempOrder: {
    items: items || [{ productId: 'p', productName: 'Robe', quantity: 1, price: 1000 }],
    total: 1000, idempotencyKey: 'cart-key', ...temp
  } };
  const config = { botActive: true, deliveryEnabled: true, deliveryZones: [{ name: 'Cocody', price: 1500 }], ...settings };
  const db = {
    getSettings: async () => config, getProducts: async () => products,
    getProductById: async (_t, id) => products.find(p => p.id === id),
    findOrderByIdempotencyKey: async () => null,
    decrementStockForItems: async () => { events.push('stock'); return { ok: true }; },
    createOrder: async (_t, _j, orderItems, total) => { events.push({ createdTotal: total, items: clone(orderItems) }); return { id: 'order' }; },
    restockItems: async () => events.push('restock'), logActivity: async () => {}
  };
  const service = load('backend/src/services/whatsapp/flowHandler.ts', {
    '../dbService': { db }, '../sessionService': {
      getSession: async () => clone(session), addToHistory: async () => {},
      updateSession: async (_t, _j, patch) => { session = { ...session, ...patch }; return session; },
      addItemToSessionCart: async (_t, _j, item) => {
        session.tempOrder.items.push(item);
        session.tempOrder.total = session.tempOrder.items.reduce((s, i) => s + i.price * i.quantity, 0);
        session.tempOrder.idempotencyKey ||= 'new-key';
        return clone(session.tempOrder);
      }
    },
    '../aiService': { generateAIResponse: async () => ai }, './salesEngine': sales,
    './notificationService': { sendOrderNotification: async () => events.push('merchant') },
    '../../utils/logger': { logger: quiet }
  });
  return { db, events, messages, getSession: () => session,
    run: text => service.handleFlow('tenant', 'client', text, { sendMessage: async (_j, m) => messages.push(m.text) }) };
}
const probes = [];
async function probe(name, run) { await run(); probes.push(name); console.log(`REPRODUIT : ${name}`); }
(async () => {
  await probe('Ajout demandé pendant attente adresse : promesse IA transmise sans ajout', async () => {
    const h = flowHarness({ ai: 'Je rajoute le sac. [ADD_TO_CART: sac | 1 | 2000]' });
    await h.run('ajoute aussi le sac');
    assert.equal(h.getSession().tempOrder.items.length, 1);
    assert.match(h.messages[0], /Je rajoute le sac/);
    assert.equal(h.events.length, 0);
  });
  await probe('Adresse reçue : commande et stock engagés avant accord sur total livraison comprise', async () => {
    const h = flowHarness({});
    await h.run('Cocody carrefour pharmacie');
    assert.equal(h.events[0], 'stock');
    assert.equal(h.events[1].createdTotal, 2500);
    assert.match(h.messages[0], /Commande confirmée/);
  });
  await probe('Phrase refusant une zone interprétée comme adresse', () => {
    assert.equal(sales.looksLikeAddress('Je ne suis pas à Cocody', ['Cocody']), true);
  });
  await probe('Livraison offerte hors zone dès seuil dépassé', () => {
    const quote = sales.computeDelivery(60000, 'Paris', { deliveryEnabled: true, freeDeliveryThreshold: 50000, deliveryZones: [{ name: 'Cocody', price: 1500 }] });
    assert.equal(quote.known, true); assert.equal(quote.fee, 0);
  });
  await probe('Variantes : suppléments cumulés autorisent un prix final négatif', async () => {
    const p = { id: 'p', name: 'Robe', price: 1000, stock: 10, variations: [
      { name: 'Taille', options: [{ value: 'S', priceModifier: -800 }] },
      { name: 'Couleur', options: [{ value: 'Bleu', priceModifier: -800 }] }
    ] };
    assert.equal(validation.validateProductInput(p), null);
    const h = flowHarness({ state: 'WAITING_FOR_VARIATION', products: [p], items: [], temp: {
      productId: 'p', quantity: 1, basePrice: 1000, variationIndex: 1, priceAdjustment: -800,
      selectedVariations: [{ name: 'Taille', value: 'S' }]
    } });
    await h.run('Bleu');
    assert.equal(h.getSession().tempOrder.items[0].price, -600);
  });
  await probe('Deux annulations concurrentes rendent deux fois le stock', async () => {
    const db = loadDb({ from: () => ({ update() { return this; }, eq() { return this; }, select() { return this; }, single: async () => ({ data: { id: 'o', status: 'CANCELLED' } }), insert: async () => ({ error: null }) }) });
    let restocks = 0;
    db.getOrderById = async () => ({ id: 'o', status: 'PENDING', items: [{ productId: 'p', quantity: 1 }] });
    db.restockItems = async () => { restocks++; };
    await Promise.all([db.updateOrderStatus('t', 'o', 'CANCELLED'), db.updateOrderStatus('t', 'o', 'CANCELLED')]);
    assert.equal(restocks, 2);
  });
  await probe('Réponse insertion perdue : remise en stock malgré commande déjà écrite', async () => {
    const h = flowHarness({}); let persisted = false;
    h.db.createOrder = async () => { persisted = true; throw new Error('réponse réseau perdue'); };
    await h.run('Cocody pharmacie');
    assert.equal(persisted, true); assert.ok(h.events.includes('restock'));
    assert.match(h.messages[0], /renvoyant votre adresse/);
  });
  await probe('Paiement tardif : une commande livrée repasse payée', async () => {
    let target;
    const service = load('backend/src/services/paystackService.ts', { axios: { create: () => ({}) }, './dbService': { db: {
      claimPaystackEvent: async () => 'claimed', getOrderById: async () => ({ id: 'o', total: 1000, status: 'DELIVERED' }),
      updateOrderStatus: async (_t, _id, status) => { target = status; return {}; }, completePaystackEvent: async () => {}, logActivity: async () => {}, failPaystackEvent: async () => {}
    } } });
    await service.handlePaystackWebhook('charge.success', { reference: 'r', currency: 'XOF', amount: 100000, metadata: { tenantId: 't', type: 'order', orderId: 'o' } });
    assert.equal(target, 'PAID');
  });
  await probe('Abonnement Pro : aucun changement du forfait effectif lu par le catalogue', async () => {
    let changed = false, saved;
    const service = load('backend/src/services/paystackService.ts', { axios: { create: () => ({}) }, './dbService': { db: {
      claimPaystackEvent: async () => 'claimed', createSubscription: async value => { saved = value; },
      updateTenant: async () => { changed = true; }, completePaystackEvent: async () => {}, logActivity: async () => {}, failPaystackEvent: async () => {}
    } } });
    await service.handlePaystackWebhook('charge.success', { reference: 'r', currency: 'XOF', amount: 1000000, metadata: { tenantId: 't', type: 'subscription', plan: 'pro' } });
    assert.equal(saved.plan, 'pro'); assert.equal(changed, false);
  });
  await probe('Mot de passe oublié : succès affiché malgré refus email', async () => {
    let output;
    const service = load('backend/src/controllers/authController.ts', {
      bcryptjs: {}, '../middleware/auth': {}, uuid: { v4: () => 'reset' }, '../utils/logger': { logger: quiet },
      '../services/firebaseAdminService': {}, '../services/resendService': { sendPasswordResetEmail: async () => ({ success: false }) },
      '../services/dbService': { db: { getUserByEmail: async () => ({ id: 'u' }), storeAuthToken: async () => {} } }
    });
    await service.forgotPassword({ body: { email: 'fixture@example.invalid' } }, { status() { return this; }, json(value) { output = value; } });
    assert.equal(output.success, true); assert.match(output.message, /envoyé/);
  });
  await probe('Inbox : identifiant @lid altéré pour envoi manuel', async () => {
    const routes = {}, sent = [];
    const router = { use() {}, get(url, fn) { routes[`GET ${url}`] = fn; }, post(url, fn) { routes[`POST ${url}`] = fn; } };
    load('backend/src/routes/chatRoutes.ts', {
      express: { Router: () => router }, '../middleware/auth': {},
      '../services/sessionService': { addToHistory: async () => {} },
      '../services/baileysManager': { whatsappManager: { getSession: async () => ({ status: 'connected', sock: { sendMessage: async jid => sent.push(jid) } }) } }
    });
    await routes['POST /:jid/send']({ tenantId: 't', params: { jid: '123456789@lid' }, body: { text: 'Bonjour' } }, { status() { return this; }, json() {} });
    assert.equal(sent[0], '123456789@lid@s.whatsapp.net');
  });
  await probe('Historique vendeur : le 21e message efface le premier', async () => {
    const row = { id: 't:c', tenant_id: 't', user_phone: 'c', state: 'IDLE', history: Array.from({ length: 20 }, (_, i) => ({ role: 'user', parts: [{ text: `m${i}` }] })), last_interaction: new Date().toISOString() };
    let saved;
    const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: clone(row) }), upsert: async value => { saved = value; return {}; } };
    const service = load('backend/src/services/sessionService.ts', { '../config/supabase': { isSupabaseEnabled: true, supabase: { from: () => query } }, './simulationContext': { simulationScope: () => null } });
    await service.addToHistory('t', 'c', 'user', 'm20');
    assert.equal(saved.history.length, 20); assert.equal(saved.history[0].parts[0].text, 'm1');
  });
  console.log(JSON.stringify({ reproduced: probes.length, probes }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
