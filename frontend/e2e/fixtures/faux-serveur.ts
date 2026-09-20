/**
 * Faux backend pour la recette navigateur.
 *
 * Les parcours sont joués dans un vrai navigateur, contre le vrai frontend,
 * mais l'API est simulée ici : aucun appel ne part vers le VPS, aucune
 * commande réelle n'est créée, aucun stock réel n'est touché. Chaque test
 * décrit l'état de boutique dont il a besoin.
 *
 * Le faux serveur enregistre TOUT ce que le frontend lui envoie (méthode,
 * chemin, corps). Les tests vérifient donc aussi ce qui PART du navigateur,
 * pas seulement ce qui s'affiche : c'est là que se cachent les régressions
 * silencieuses (mauvais statut envoyé, prix en texte au lieu de nombre…).
 */
import { test as base, expect, type Page } from '@playwright/test';

/** Port du backend en développement (cf. utils/apiConfig.ts). */
const PORT_API = '3000';

export const JETON = 'jeton-de-recette';
export const MOT_DE_PASSE = 'Recette2026';

export const UTILISATEUR = {
    id: 'utilisateur-recette',
    email: 'vendeuse@recette.test',
    full_name: 'Awa Koné',
    role: 'owner',
    emailVerified: true,
    phoneVerified: false,
};

export const BOUTIQUE = {
    id: 'boutique-recette',
    name: 'Boutique de recette',
    businessType: 'Prêt-à-porter',
    subscription_tier: 'starter',
    status: 'trial',
};

export type Appel = { methode: string; chemin: string; corps: unknown };
type Reponse = { statut: number; corps: unknown };

const maintenant = () => new Date().toISOString();

const ENTETES = {
    'content-type': 'application/json',
    // Le frontend (5173) parle à l'API (3000) : sans ces en-têtes, le
    // navigateur refuserait nos réponses simulées au nom du CORS.
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export type Produit = {
    id: string;
    name: string;
    price: number;
    stock: number;
    description?: string;
    images: string[];
    manageStock?: boolean;
    variations?: { name: string; options: { value: string; stock?: number }[] }[];
};

export type Commande = {
    id: string;
    userId: string;
    total: number;
    status: 'PENDING' | 'CONFIRMED' | 'PAID' | 'SHIPPING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
    address: string;
    createdAt: string;
    items: { productId: string; productName: string; quantity: number; price: number }[];
};

export const unProduit = (extra: Partial<Produit> = {}): Produit => ({
    id: 'prod-sac',
    name: 'Sac en cuir camel',
    price: 12500,
    stock: 8,
    description: 'Cuir véritable, fait à Abidjan.',
    images: [],
    manageStock: true,
    ...extra,
});

export const uneCommande = (extra: Partial<Commande> = {}): Commande => ({
    id: 'ORD-481516-a1b2c3',
    userId: '2250700000001@s.whatsapp.net',
    total: 14000,
    status: 'PENDING',
    address: 'Cocody Angré, 7e tranche',
    createdAt: maintenant(),
    items: [
        { productId: 'prod-sac', productName: 'Sac en cuir camel', quantity: 1, price: 12500 },
        { productId: '_delivery', productName: 'Livraison (Cocody)', quantity: 1, price: 1500 },
    ],
    ...extra,
});

const heures = () => {
    const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    return Object.fromEntries(jours.map(j => [j, { open: '08:00', close: '19:00', closed: j === 'dimanche' }]));
};

export const reglagesParDefaut = () => ({
    botName: 'Awa',
    language: 'fr',
    persona: 'vendeuse',
    greeting: 'Bonjour et bienvenue !',
    politeness: 'standard',
    emojiLevel: 'low',
    humorLevel: 'low',
    slangLevel: 'none',
    responseLength: 'short',
    trainingExamples: [],
    negotiationEnabled: true,
    negotiationFlexibility: 10,
    voiceEnabled: false,
    systemInstructions: '',
    botActive: false,
    storeName: BOUTIQUE.name,
    businessType: 'Prêt-à-porter',
    address: 'Marché de Cocody',
    locationUrl: '',
    gpsCoordinates: '',
    phone: '+2250700000000',
    socialMedia: { facebook: '', instagram: '', tiktok: '', website: '' },
    openingHours: heures(),
    policyDescription: '',
    deliveryEnabled: true,
    deliveryZones: [{ name: 'Cocody', price: 1500 }, { name: 'Yopougon', price: 2000 }],
    freeDeliveryThreshold: 0,
    acceptedPayments: ['wave', 'orange'],
});

export class FauxServeur {
    produits: Produit[] = [unProduit()];
    commandes: Commande[] = [uneCommande()];
    reglages: Record<string, unknown> = reglagesParDefaut();
    whatsapp: { connected: boolean; status: 'disconnected' | 'connecting' | 'connected' } = {
        connected: false,
        status: 'disconnected',
    };
    codeJumelage = 'DJAS2026';
    conversations = [{
        id: '2250700000001@s.whatsapp.net',
        name: 'Aminata',
        lastMessage: 'Le sac camel est encore dispo ?',
        lastInteraction: maintenant(),
        autopilotEnabled: true,
        state: 'WAITING_FOR_CONFIRMATION',
        unreadCount: 1,
    }];
    messages = [
        { role: 'user', parts: [{ text: 'Le sac camel est encore dispo ?' }] },
        { role: 'model', parts: [{ text: 'Oui, il reste 8 pièces.' }] },
    ];
    activite = [{ id: 'log-1', type: 'sale', message: 'Nouvelle commande de 14 000 FCFA', created_at: maintenant() }];

    /** Tout ce que le frontend a envoyé, dans l'ordre. */
    readonly appels: Appel[] = [];
    /** Routes appelées par l'app mais absentes de cette simulation. */
    readonly nonSimulees: string[] = [];

    private readonly forcees = new Map<string, Reponse>();

    /** Impose une réponse : force('POST /products', 403, { error: '…' }). */
    force(cle: string, statut: number, corps: unknown = {}) {
        this.forcees.set(cle, { statut, corps });
    }

    libere(cle: string) {
        this.forcees.delete(cle);
    }

    appelsVers(cle: string): Appel[] {
        return this.appels.filter(a => `${a.methode} ${a.chemin}` === cle);
    }

    dernierAppel(cle: string): Appel | undefined {
        return this.appelsVers(cle).at(-1);
    }

    async installer(page: Page) {
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            const versApi = (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && url.port === PORT_API;
            if (versApi) return this.repondre(route);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
            // Polices, Firebase, reCAPTCHA… : la recette reste hermétique.
            return route.abort();
        });
    }

    private async repondre(route: Parameters<Parameters<Page['route']>[1]>[0]) {
        const requete = route.request();
        const methode = requete.method();
        const url = new URL(requete.url());
        const chemin = url.pathname.replace(/^\/api/, '');

        if (methode === 'OPTIONS') {
            return route.fulfill({ status: 204, headers: ENTETES, body: '' });
        }

        let corps: unknown = null;
        try {
            corps = requete.postDataJSON();
        } catch {
            corps = requete.postData();
        }
        this.appels.push({ methode, chemin, corps });

        const reponse = this.forcees.get(`${methode} ${chemin}`) ?? this.router(methode, chemin, url.search, corps);
        await route.fulfill({
            status: reponse.statut,
            headers: ENTETES,
            body: JSON.stringify(reponse.corps ?? null),
        });
    }

    private router(methode: string, chemin: string, recherche: string, brut: unknown): Reponse {
        // Le corps arrive du navigateur : on le lit comme un dictionnaire, sans
        // jamais faire confiance à sa forme.
        const corps = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
        const ok = (contenu: unknown = { success: true }): Reponse => ({ statut: 200, corps: contenu });
        const paginer = <T,>(liste: T[]) => ({ items: liste, total: liste.length, page: 1, limit: 20, totalPages: 1 });

        // --- Compte ---
        if (chemin === '/auth/me' && methode === 'GET') return ok({ user: UTILISATEUR, tenant: BOUTIQUE });
        if (chemin === '/auth/me' && methode === 'PUT') return ok({ user: { ...UTILISATEUR, ...corps } });
        if (chemin === '/auth/login') {
            if (corps.identifier !== UTILISATEUR.email || corps.password !== MOT_DE_PASSE) {
                return { statut: 401, corps: { error: 'Identifiants invalides' } };
            }
            return ok({ token: JETON, user: UTILISATEUR, tenant: BOUTIQUE });
        }
        if (chemin.startsWith('/auth/')) return ok();

        // --- Réglages ---
        if (chemin === '/settings' && methode === 'GET') return ok(this.reglages);
        if (chemin === '/settings' && methode === 'POST') {
            this.reglages = { ...this.reglages, ...corps };
            return ok();
        }

        // --- WhatsApp ---
        if (chemin === '/whatsapp/status') return ok(this.whatsapp);
        if (chemin === '/whatsapp/pair-code') return ok({ success: true, code: this.codeJumelage });
        if (chemin === '/whatsapp/logout') {
            this.whatsapp = { connected: false, status: 'disconnected' };
            return ok();
        }

        // --- Produits ---
        if (chemin === '/products' && methode === 'GET') {
            return ok(recherche ? paginer(this.produits) : this.produits);
        }
        if (chemin === '/products' && methode === 'POST') {
            const cree = { ...corps, id: `prod-${this.produits.length + 1}`, images: corps.images ?? [] } as Produit;
            this.produits = [...this.produits, cree];
            return { statut: 201, corps: cree };
        }
        if (chemin === '/products/upload') return ok({ url: 'https://exemple.test/photo.jpg' });
        const idProduit = chemin.match(/^\/products\/([^/]+)$/)?.[1];
        if (idProduit) {
            const produit = this.produits.find(p => p.id === idProduit);
            if (methode === 'GET') {
                return produit ? ok(produit) : { statut: 404, corps: { error: 'Produit introuvable' } };
            }
            if (methode === 'PUT') {
                this.produits = this.produits.map(p => (p.id === idProduit ? { ...p, ...corps } as Produit : p));
                return ok(this.produits.find(p => p.id === idProduit));
            }
            if (methode === 'DELETE') {
                this.produits = this.produits.filter(p => p.id !== idProduit);
                return ok();
            }
        }
        if (chemin === '/variation-templates') return methode === 'GET' ? ok([]) : ok();

        // --- Commandes ---
        if (chemin === '/orders' && methode === 'GET') {
            return ok(recherche ? paginer(this.commandes) : this.commandes);
        }
        const idCommande = chemin.match(/^\/orders\/([^/]+)\/status$/)?.[1];
        if (idCommande && methode === 'PUT') {
            const existe = this.commandes.some(c => c.id === idCommande);
            if (!existe) return { statut: 404, corps: { error: 'Commande introuvable' } };
            this.commandes = this.commandes.map(c => (c.id === idCommande ? { ...c, status: corps.status as Commande['status'] } : c));
            return ok();
        }

        // --- Tableau de bord ---
        if (chemin === '/dashboard/pulse') return ok(this.activite);
        if (chemin === '/dashboard/recent-orders') return ok(this.commandes.slice(0, 5));

        // --- Conversations ---
        if (chemin === '/chats' && methode === 'GET') return ok(this.conversations);
        if (/^\/chats\/.+\/messages$/.test(chemin)) return ok(this.messages);
        if (/^\/chats\/.+\/(send|toggle-autopilot)$/.test(chemin)) return ok();

        // --- Écrans secondaires ---
        if (chemin === '/marketing/audience') return ok({ all: 0, vip: 0, recent: 0 });
        if (chemin === '/marketing/stats') return ok({ sent: 0, delivered: 0 });
        if (chemin === '/paystack/plans') return ok([]);
        if (chemin.startsWith('/ai/')) return ok({ response: 'Réponse simulée', images: [], summary: 'Résumé simulé' });

        this.nonSimulees.push(`${methode} ${chemin}`);
        return ok([]);
    }
}

/** Pose une session vendeur valide avant le premier script de la page. */
export async function ouvrirSession(page: Page) {
    await page.addInitScript(donnees => {
        localStorage.setItem('token', donnees.jeton);
        localStorage.setItem('authToken', donnees.jeton);
        localStorage.setItem('user', JSON.stringify(donnees.utilisateur));
        localStorage.setItem('tenant', JSON.stringify(donnees.boutique));
    }, { jeton: JETON, utilisateur: UTILISATEUR, boutique: BOUTIQUE });
}

export const test = base.extend<{ api: FauxServeur }>({
    // `auto` : le faux serveur est installé même quand le test ne le nomme
    // pas. Sans cela, un test qui ne déclare pas `api` partirait vers le vrai
    // backend et échouerait sur une page vide, sans explication.
    api: [async ({ page }, use) => {
        const api = new FauxServeur();
        await api.installer(page);
        await use(api);
        // Une route inconnue veut dire que l'app appelle un endpoint que la
        // recette ne simule pas : mieux vaut un échec clair qu'une page vide
        // qu'on mettrait des heures à expliquer.
        expect(api.nonSimulees, 'routes appelées mais non simulées').toEqual([]);
    }, { auto: true }],
});

export { expect };
