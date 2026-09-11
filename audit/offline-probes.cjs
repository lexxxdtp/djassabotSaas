// Diagnostic uniquement : code source transpile en memoire, dependances explicitement
// remplacees. Aucun .env, serveur, socket, cron reel ou donnees de production charges.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('../backend/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
function load(file, deps = {}, extra = {}) {
  const filename = path.join(root, file);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    module, exports: module.exports, console: quiet, Buffer,
    __dirname: path.dirname(filename), process: { env: {} },
    require(id) {
      if (Object.hasOwn(deps, id)) return deps[id];
      throw new Error(`Dependance non autorisee dans le diagnostic : ${id}`);
    }, ...extra
  }, { filename, timeout: 2000 });
  return module.exports;
}
let passed = 0;
// Reproductions historiques remplacées par des assertions du comportement corrigé
// dans backend/.../__tests__/auditFixes.test.ts (npm test dans backend).
const corrected = new Set([
  'statistique revenus inclut une commande annulee',
  'montant decimal abrege interprete dix fois trop haut',
  'produit ambigu : premier resultat retenu sans clarification',
  'confirmation client echouee laisse une commande creee et un panier revalidable',
  'champ proprietaire transmis sans liste blanche a la modification produit',
  'erreur decriture du stock retournee comme succes',
  'reconnexion apres coupure : ancien etat connected bloque la recreation',
  'message de groupe traite comme conversation de vente',
  'vocal transcrit meme avec bot en pause',
  'erreur retournee par le service email consideree comme succes',
]);
async function probe(name, fn) {
  if (corrected.has(name)) {
    console.log(`REMPLACE PAR UN TEST DE REGRESSION : ${name}`);
    return;
  }
  await fn(); passed++; console.log(`REPRODUIT : ${name}`);
}
(async () => {
  const engine = load('backend/src/services/whatsapp/salesEngine.ts');
  await probe('montant decimal abrege interprete dix fois trop haut', async () => {
    assert.equal(engine.parseAIResponse('[ADD_TO_CART: p | 1 | 12.5k]').deals[0].unitPrice, 125000);
  });
  await probe('produit ambigu : premier resultat retenu sans clarification', async () => {
    assert.equal(engine.findProduct([{ id: 'a', name: 'Robe rouge' }, { id: 'b', name: 'Robe bleue' }], 'robe').id, 'a');
  });
  await probe('reconnexion apres coupure : ancien etat connected bloque la recreation', async () => {
    const sockets = [], timers = [];
    const createSocket = () => {
      const listeners = {};
      const sock = { ev: { on: (event, fn) => { listeners[event] = fn; } }, listeners, user: { id: 'test:1' } };
      sockets.push(sock); return sock;
    };
    const service = load('backend/src/services/whatsapp/sessionManager.ts', {
      '@whiskeysockets/baileys': { default: createSocket, __esModule: true,
        useMultiFileAuthState: async () => ({ state: { creds: {}, keys: {} }, saveCreds() {} }),
        fetchLatestBaileysVersion: async () => ({ version: [] }), makeCacheableSignalKeyStore: x => x,
        DisconnectReason: { loggedOut: 401 } },
      fs: { existsSync: () => true }, path, pino: () => quiet,
      '../dbService': { db: { updateTenantWhatsAppStatus: async () => {}, updateTenantQRCode: async () => {} } },
      './messageHandler': { handleMessage: async () => {} }, '../resendService': {}
    }, { setTimeout: (fn) => { timers.push(fn); } });
    const manager = new service.SessionManager();
    const starting = manager.createSession('fixture');
    for (let i = 0; i < 3 && !sockets.length; i++) await new Promise(resolve => setImmediate(resolve));
    await sockets[0].listeners['connection.update']({ connection: 'open' });
    await starting;
    await sockets[0].listeners['connection.update']({ connection: 'close', lastDisconnect: { error: { output: { statusCode: 428 } } } });
    assert.equal(manager.getSession('fixture').status, 'connected');
    assert.equal(timers.length, 1);
    timers[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sockets.length, 1);
  });
  await probe('message de groupe traite comme conversation de vente', async () => {
    let calls = 0;
    const service = load('backend/src/services/whatsapp/messageHandler.ts', {
      '@whiskeysockets/baileys': {}, '../dbService': { db: { getSettings: async () => ({ botActive: true }), isSubscriptionActive: async () => true } },
      './flowHandler': { handleFlow: async () => { calls++; } }, '../aiService': {},
      '../sessionService': { getSession: async () => ({ autopilotEnabled: true }), addToHistory: async () => {} }, '../paymentValidationService': {}
    }, { setTimeout: fn => fn() });
    await service.handleMessage('fixture', { readMessages: async () => {}, sendPresenceUpdate: async () => {} },
      { key: { remoteJid: 'fixture@g.us' }, message: { conversation: 'bonjour' } });
    assert.equal(calls, 1);
  });
  await probe('vocal transcrit meme avec bot en pause', async () => {
    let calls = 0;
    const service = load('backend/src/services/whatsapp/messageHandler.ts', {
      '@whiskeysockets/baileys': { downloadMediaMessage: async () => Buffer.from('fixture') },
      '../dbService': { db: { getSettings: async () => ({ botActive: false }) } }, './flowHandler': {},
      '../aiService': { transcribeAudio: async () => { calls++; return 'bonjour'; } },
      '../sessionService': { getSession: async () => ({ autopilotEnabled: false }), addToHistory: async () => {} }, '../paymentValidationService': {}
    });
    await service.handleMessage('fixture', {}, { key: { remoteJid: 'fixture' }, message: { audioMessage: {} } });
    assert.equal(calls, 1);
  });
  await probe('erreur retournee par le service email consideree comme succes', async () => {
    const service = load('backend/src/services/resendService.ts', {
      resend: { Resend: class { emails = { send: async () => ({ data: null, error: { message: 'fixture rejected' } }) }; } }
    });
    assert.equal((await service.sendOtpEmail('fixture@example.invalid', 'fixture')).success, true);
  });
  await probe('statistique revenus inclut une commande annulee', async () => {
    const metrics = load('frontend/src/utils/overviewMetrics.ts');
    assert.equal(metrics.deriveMetrics([{ id: 'fixture', status: 'CANCELLED', total: 10000, createdAt: new Date().toISOString(), items: [], userId: 'fixture' }]).revenue7, 10000);
  });
  await probe('champ proprietaire transmis sans liste blanche a la modification produit', async () => {
    let payload;
    const query = { update(value) { payload = value; return this; }, eq() { return this; }, select() { return this; }, single: async () => ({ data: { id: 'fixture' }, error: null }) };
    const service = load('backend/src/services/dbService.ts', {
      fs: { existsSync: () => false, mkdirSync() {}, writeFileSync() {} }, path,
      './tenantService': {}, '../types': {}, '../config/supabase': { isSupabaseEnabled: true, supabase: { from: () => query } },
      './whatsapp/salesEngine': engine
    });
    await service.db.updateProduct('owner-fixture', 'product-fixture', { tenant_id: 'other-fixture' });
    assert.equal(payload.tenant_id, 'other-fixture');
  });
  await probe('erreur decriture du stock retournee comme succes', async () => {
    const query = { select() { return this; }, eq() { return this; }, update() { return this; },
      single: async () => ({ data: { id: 'fixture', price: 1000, stock: 5, variations: [] } }) };
    const service = load('backend/src/services/dbService.ts', {
      fs: { existsSync: () => false, mkdirSync() {}, writeFileSync() {} }, path, './tenantService': {}, '../types': {},
      '../config/supabase': { isSupabaseEnabled: true, supabase: { rpc: async () => ({ error: { code: 'fixture', message: 'offline' } }), from: () => query } },
      './whatsapp/salesEngine': engine
    });
    service.db.updateProduct = async () => { throw new Error('fixture unavailable'); };
    const result = await service.db.decrementStockForItems('fixture', [{ productId: 'fixture', productName: 'fixture', quantity: 1, price: 1000 }]);
    assert.equal(result.ok, true);
  });
  await probe('confirmation client echouee laisse une commande creee et un panier revalidable', async () => {
    let created = 0, cleared = false;
    const session = { state: 'WAITING_FOR_ADDRESS', autopilotEnabled: true, history: [], tempOrder: { items: [{ productId: 'p', productName: 'fixture', price: 1000, quantity: 1 }], total: 1000 } };
    const service = load('backend/src/services/whatsapp/flowHandler.ts', {
      '../dbService': { db: { getSettings: async () => ({ deliveryEnabled: false }), getProducts: async () => [], decrementStockForItems: async () => ({ ok: true }), createOrder: async () => { created++; return { id: 'fixture' }; } } },
      '../sessionService': { getSession: async () => session, updateSession: async () => { cleared = true; }, addToHistory: async () => {} },
      '../aiService': {}, './notificationService': {}, './salesEngine': engine, '../../utils/logger': { logger: quiet }
    });
    await assert.rejects(service.handleFlow('fixture', 'fixture', 'Cocody', { sendMessage: async () => { throw new Error('fixture network failure'); } }));
    assert.equal(created, 1); assert.equal(cleared, false);
  });
  console.log(`${passed} constats reproduits. Ce sont des diagnostics du comportement actuel, pas des tests prouvant sa correction.`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
