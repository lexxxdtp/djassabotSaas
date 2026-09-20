import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

import { hashAuthToken, candidatsJeton } from '../utils/authTokens';
import { empreinteMotDePasse, sessionPerimee } from '../utils/sessionFreshness';
import { reserverCampagne, libererCampagne, reinitialiserCampagnes, CAMPAGNES_PAR_JOUR } from '../services/broadcastLock';

// Même discipline que les autres recettes : le module testé est compilé puis
// exécuté dans un bac à sable, avec des dépendances explicites. Aucun .env,
// aucune base, aucun service distant n'est chargé.
const root = path.resolve(__dirname, '../../..');
const muet = { log() {}, warn() {}, error() {}, info() {}, debug() {} };

// Un objet fabriqué dans un bac à sable n'a pas le même prototype que le nôtre :
// on compare son contenu, pas son appartenance à une réalisation JavaScript.
const memeContenu = (a: unknown, b: unknown) => assert.equal(JSON.stringify(a), JSON.stringify(b));

function charger(fichier: string, deps: Record<string, unknown> = {}) {
    const chemin = path.join(root, fichier);
    const js = ts.transpileModule(fs.readFileSync(chemin, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const module = { exports: {} as any };
    vm.runInNewContext(js, {
        module, exports: module.exports, console: muet, Buffer, __dirname: path.dirname(chemin),
        process: { env: {} },
        require(id: string) {
            if (Object.prototype.hasOwnProperty.call(deps, id)) return deps[id];
            if (id === 'crypto' || id === 'node:crypto') return crypto;
            throw new Error(`Dépendance non simulée dans la recette : ${id}`);
        },
    });
    return module.exports;
}

// ---------------------------------------------------------------------------
// M2 — les codes et liens ne sont plus stockés en clair
// ---------------------------------------------------------------------------

function chargerDb(client: unknown) {
    return charger('backend/src/services/dbService.ts', {
        fs: { existsSync: () => false, mkdirSync() {}, writeFileSync() {} }, path,
        './tenantService': {}, '../types': {},
        '../config/supabase': { isSupabaseEnabled: true, supabase: client },
        './whatsapp/salesEngine': { DELIVERY_ITEM_ID: '_delivery' },
        '../utils/authTokens': { hashAuthToken, candidatsJeton },
    }).db;
}

test('jeton : la base reçoit une empreinte, jamais le code envoyé au vendeur', async () => {
    const ecrits: any[] = [];
    const suppressions: unknown[][] = [];
    const client = {
        from: () => ({
            insert(lignes: any[]) { ecrits.push(...lignes); return Promise.resolve({ error: null }); },
            delete() {
                const filtres: unknown[][] = [];
                suppressions.push(filtres);
                const chaine: any = { eq(cle: string, valeur: string) { filtres.push([cle, valeur]); return chaine; } };
                return chaine;
            },
        }),
    };
    const db = chargerDb(client);

    await db.storeAuthToken('vendeuse@test.ci', 'EMAIL_OTP', '123456', new Date(Date.now() + 600000));

    assert.equal(ecrits.length, 1);
    assert.notEqual(ecrits[0].token_value, '123456');
    assert.equal(ecrits[0].token_value, crypto.createHash('sha256').update('123456').digest('hex'));
    // Les codes précédents du même identifiant sont effacés : cinq demandes ne
    // doivent pas laisser cinq codes ouverts à la force brute.
    assert.equal(suppressions.length, 1);
    assert.deepEqual(suppressions[0], [['identifier', 'vendeuse@test.ci'], ['token_type', 'EMAIL_OTP']]);
});

test('jeton : la vérification cherche l’empreinte (et tolère les anciens jetons en clair)', async () => {
    let recherche: unknown[] = [];
    const client = {
        from: () => {
            const chaine: any = {
                select() { return chaine; },
                eq() { return chaine; },
                gt() { return chaine; },
                in(cle: string, valeurs: string[]) { recherche = [cle, valeurs]; return chaine; },
                single: async () => ({ data: { identifier: 'utilisateur-1' }, error: null }),
            };
            return chaine;
        },
    };
    const db = chargerDb(client);

    const resultat = await db.verifyAuthToken('lien-secret', 'PASSWORD_RESET');

    memeContenu(resultat, { valid: true, identifier: 'utilisateur-1' });
    assert.equal(recherche[0], 'token_value');
    assert.deepEqual(recherche[1], [hashAuthToken('lien-secret'), 'lien-secret']);
});

test('jeton : on cherche l’empreinte d’abord, la valeur en clair ensuite (transition)', () => {
    assert.deepEqual(candidatsJeton('abc'), [hashAuthToken('abc'), 'abc']);
    // L'empreinte ne doit jamais ressembler à la valeur d'origine.
    assert.notEqual(hashAuthToken('abc'), 'abc');
    assert.equal(hashAuthToken('abc'), hashAuthToken('abc'));
});

// ---------------------------------------------------------------------------
// A21 / F1 — changer de mot de passe ferme les sessions ouvertes
// ---------------------------------------------------------------------------

test('session : l’empreinte change avec le mot de passe et ne révèle pas le hash', () => {
    const avant = empreinteMotDePasse('$2b$10$ancienhash');
    const apres = empreinteMotDePasse('$2b$10$nouveauhash');
    assert.notEqual(avant, apres);
    assert.equal(avant.length, 16);
    assert.ok(!avant.includes('ancienhash'));
    assert.equal(avant, empreinteMotDePasse('$2b$10$ancienhash'));
});

test('session : périmée après changement, valide sinon, tolérante aux pannes', () => {
    const hash = '$2b$10$ancienhash';
    const empreinte = empreinteMotDePasse(hash);

    assert.equal(sessionPerimee(empreinte, hash), false, 'même mot de passe : la session reste ouverte');
    assert.equal(sessionPerimee(empreinte, '$2b$10$nouveauhash'), true, 'mot de passe changé : la session tombe');
    // Jetons émis avant cette version : on ne déconnecte pas tout le monde.
    assert.equal(sessionPerimee(undefined, hash), false);
    // Lecture impossible (panne) : une panne ne jette pas dehors un vendeur.
    assert.equal(sessionPerimee(empreinte, null), false);
    assert.equal(sessionPerimee(empreinte, undefined), false);
});

// ---------------------------------------------------------------------------
// M3 — une seule campagne à la fois, et pas plus de N par jour
// ---------------------------------------------------------------------------

test('campagne : deux envois simultanés sont refusés, la reprise est possible', () => {
    reinitialiserCampagnes();

    assert.equal(reserverCampagne('boutique-a'), null);
    assert.equal(reserverCampagne('boutique-a'), 'EN_COURS');
    // Une autre boutique n'est pas bloquée par la première.
    assert.equal(reserverCampagne('boutique-b'), null);

    libererCampagne('boutique-a');
    assert.equal(reserverCampagne('boutique-a'), null);
});

test('campagne : le plafond quotidien protège le numéro WhatsApp', () => {
    reinitialiserCampagnes();

    for (let i = 0; i < CAMPAGNES_PAR_JOUR; i++) {
        assert.equal(reserverCampagne('boutique-c'), null, `campagne ${i + 1} autorisée`);
        libererCampagne('boutique-c');
    }

    assert.equal(reserverCampagne('boutique-c'), 'PLAFOND_QUOTIDIEN');
    reinitialiserCampagnes();
});

// ---------------------------------------------------------------------------
// A14 — « mot de passe oublié » dit la même chose à tout le monde
// ---------------------------------------------------------------------------

function chargerAuth(options: { user: any; envoiReussi: boolean }) {
    const journal: any[] = [];
    const jetons: any[] = [];
    const controleur: any = charger('backend/src/controllers/authController.ts', {
        bcryptjs: { hash: async () => 'hash', compare: async () => true },
        '../middleware/auth': { generateToken: () => 'jeton' },
        '../services/dbService': {
            db: {
                getUserByEmail: async () => options.user,
                storeAuthToken: async (...args: unknown[]) => { jetons.push(args); },
            },
        },
        '../services/resendService': {
            sendOtpEmail: async () => ({ success: true }),
            sendPasswordResetEmail: async () => ({ success: options.envoiReussi }),
        },
        '../services/firebaseAdminService': { verifyPhoneToken: async () => null, isFirebaseAdminConfigured: () => false },
        uuid: { v4: () => 'jeton-reset' },
        '../utils/logger': { logger: { info() {}, debug() {}, warn() {}, error: (...a: unknown[]) => journal.push(a) } },
        '../utils/sessionFreshness': { empreinteMotDePasse },
    });
    return { controleur, journal, jetons };
}

const fausseReponse = () => {
    const capture: any = { code: 200 };
    capture.status = (c: number) => { capture.code = c; return capture; };
    capture.json = (corps: unknown) => { capture.corps = corps; return capture; };
    return capture;
};

test('mot de passe oublié : la réponse est identique que le compte existe ou non', async () => {
    const connu = chargerAuth({ user: { id: 'u1', email: 'vendeuse@test.ci' }, envoiReussi: true });
    const inconnu = chargerAuth({ user: null, envoiReussi: true });

    const r1 = fausseReponse();
    const r2 = fausseReponse();
    await connu.controleur.forgotPassword({ body: { email: 'vendeuse@test.ci' } } as any, r1);
    await inconnu.controleur.forgotPassword({ body: { email: 'inconnue@test.ci' } } as any, r2);

    memeContenu(r1.corps, r2.corps);
    assert.equal(r1.code, 200);
    assert.equal(connu.jetons.length, 1, 'un lien est bien créé pour un compte existant');
    assert.equal(inconnu.jetons.length, 0, 'rien n’est écrit pour une adresse inconnue');
});

test('mot de passe oublié : un envoi refusé devient un incident, sans rien révéler au visiteur', async () => {
    const reussi = chargerAuth({ user: { id: 'u1', email: 'vendeuse@test.ci' }, envoiReussi: true });
    const echoue = chargerAuth({ user: { id: 'u1', email: 'vendeuse@test.ci' }, envoiReussi: false });

    const r1 = fausseReponse();
    const r2 = fausseReponse();
    await reussi.controleur.forgotPassword({ body: { email: 'vendeuse@test.ci' } } as any, r1);
    await echoue.controleur.forgotPassword({ body: { email: 'vendeuse@test.ci' } } as any, r2);

    memeContenu(r1.corps, r2.corps);
    assert.equal(reussi.journal.length, 0);
    assert.equal(echoue.journal.length, 1, 'un email non parti doit laisser une trace cherchable');
    assert.equal(echoue.journal[0][0].alerte, 'RESET_EMAIL_NON_ENVOYE');
});

test('la route qui promettait un SMS jamais envoyé n’existe plus', () => {
    const controleur = fs.readFileSync(path.join(root, 'backend/src/controllers/authController.ts'), 'utf8');
    const routes = fs.readFileSync(path.join(root, 'backend/src/routes/authRoutes.ts'), 'utf8');
    assert.ok(!routes.includes('verify-phone-reset'), 'la route est retirée');
    assert.ok(!/export const verifyPhoneReset/.test(controleur), 'le contrôleur est retiré');
});
