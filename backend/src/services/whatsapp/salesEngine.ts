import { Product, Settings, CartItem, DeliveryZone, SelectedVariation } from '../../types';

/**
 * salesEngine — logique de vente PURE (sans I/O), partagée entre le vrai bot
 * WhatsApp (flowHandler) et le simulateur du dashboard (aiRoutes).
 *
 * Rôle : c'est le garde-fou serveur autour de l'IA. L'IA propose (tags
 * [ADD_TO_CART]), le serveur DISPOSE : prix plancher, stock, quantités.
 * Aucune promesse faite au client ne part sans être validée ici.
 */

// ---------------------------------------------------------------------------
// CONSTANTES
// ---------------------------------------------------------------------------

/** Pseudo-article représentant les frais de livraison dans une commande. */
export const DELIVERY_ITEM_ID = '_delivery';

/** Quantité maximale acceptée sur une seule ligne (garde-fou anti-hallucination). */
export const MAX_QTY_PER_LINE = 500;

// ---------------------------------------------------------------------------
// CONTEXTE INVENTAIRE (source unique pour le prompt IA)
// ---------------------------------------------------------------------------

/**
 * Construit le contexte inventaire injecté dans le prompt système.
 * IMPORTANT : ce format est contractuel avec le prompt de aiService
 * (tags [IMAGES_AVAILABLE], [Stock: X], minPrice caché, CONSIGNES, id produit).
 */
export const buildInventoryContext = (products: Product[]): string => {
    if (!products || products.length === 0) return 'INVENTAIRE VIDE — aucun produit en vente pour le moment.';

    return products.map(p => {
        const isUnlimited = p.manageStock === false;
        const lines: string[] = [];

        let stockInfo: string;
        if (isUnlimited) {
            stockInfo = '[Stock: Sur commande / Illimité]';
        } else if (p.stock !== undefined && p.stock <= 0) {
            stockInfo = '[RUPTURE DE STOCK]';
        } else {
            stockInfo = p.stock !== undefined ? `[Stock: ${p.stock}]` : '[Stock: Illimité]';
        }

        lines.push(`- ${p.name} (id: ${p.id}) — ${p.price} FCFA ${stockInfo}`);
        if (p.minPrice) lines.push(`  (minPrice CACHÉ, ne jamais révéler: ${p.minPrice} FCFA)`);
        if (p.description) lines.push(`  Description: ${String(p.description).slice(0, 200)}`);

        if (p.variations && p.variations.length > 0) {
            for (const v of p.variations) {
                const opts = v.options.map(o => {
                    const mod = o.priceModifier || 0;
                    const sign = mod > 0 ? '+' : '';
                    const priceTxt = mod !== 0 ? ` (${sign}${mod}, soit ${p.price + mod} FCFA)` : '';
                    let optStock = '';
                    if (!isUnlimited && o.stock !== undefined) optStock = ` [Stock: ${o.stock}]`;
                    return `${o.value}${priceTxt}${optStock}`;
                }).join(', ');
                lines.push(`  * ${v.name}: ${opts}`);
            }
        }

        if (Array.isArray(p.images) && p.images.length > 0) {
            lines.push(`  [IMAGES_AVAILABLE: ${p.images.slice(0, 2).join(', ')}]`);
        }
        if (p.aiInstructions && p.aiInstructions.trim()) {
            lines.push(`  CONSIGNES SPÉCIALES DU VENDEUR (obligatoires): "${p.aiInstructions.trim()}"`);
        }

        return lines.join('\n');
    }).join('\n\n');
};

// ---------------------------------------------------------------------------
// PARSING DES TAGS [ADD_TO_CART]
// ---------------------------------------------------------------------------

export interface RawDeal {
    productRef: string;  // id produit (ou nom si l'IA s'est trompée)
    quantity: number;
    unitPrice: number;
}

export interface ParsedResponse {
    cleaned: string;      // réponse sans les tags (texte client)
    deals: RawDeal[];
    imageUrls: string[];  // URLs des tags [IMAGE: url] (non filtrées — à valider par l'appelant)
    invalidDealCount: number;
}

const CART_TAG_RE = /\[ADD_TO_CART:\s*([^\]]*)\]/gi;
const IMAGE_TAG_RE = /\[IMAGE:\s*([^\]]+?)\s*\]/gi;

const parseNumber = (raw: string): number => {
    const cleaned = raw.trim().toLowerCase().replace(/\s/g, ' ');
    let n: number;
    if (/^\d+(?:[.,]\d{1,3})?\s*k$/.test(cleaned)) {
        n = Math.round(Number(cleaned.replace(/\s*k$/, '').replace(',', '.')) * 1000);
    } else if (/^\d+$/.test(cleaned)) {
        n = Number(cleaned);
    } else if (/^\d{1,3}([ .,])\d{3}(?:\1\d{3})*$/.test(cleaned)) {
        n = Number(cleaned.replace(/[ .,]/g, ''));
    } else {
        return NaN; // Ne pas transformer une décimale ou une saisie cassée en milliers.
    }
    return Number.isSafeInteger(n) ? n : NaN;
};

/** Extrait les tags [ADD_TO_CART] et [IMAGE] de la réponse IA, renvoie le texte nettoyé. */
export const parseAIResponse = (response: string): ParsedResponse => {
    const deals: RawDeal[] = [];
    const imageUrls: string[] = [];
    let invalidDealCount = 0;

    let cleaned = response.replace(CART_TAG_RE, (_m, body: string) => {
        const [ref = '', qty = '', price = '', ...extra] = body.split('|');
        const quantity = /k/i.test(qty) ? NaN : parseNumber(qty);
        const unitPrice = parseNumber(price);
        if (!extra.length && ref.trim() && quantity > 0 && unitPrice > 0 && Number.isSafeInteger(quantity) && Number.isSafeInteger(unitPrice)) {
            deals.push({ productRef: ref.trim(), quantity, unitPrice });
        } else {
            invalidDealCount++;
        }
        return '';
    });

    cleaned = cleaned.replace(IMAGE_TAG_RE, (_m, url: string) => {
        const u = url.trim();
        if (u && !imageUrls.includes(u)) imageUrls.push(u);
        return '';
    });

    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    return { cleaned, deals, imageUrls, invalidDealCount };
};

// ---------------------------------------------------------------------------
// RECHERCHE PRODUIT (id puis fuzzy par nom)
// ---------------------------------------------------------------------------

const normalize = (s: string): string =>
    s.toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // accents
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/**
 * Retrouve un produit par id exact, sinon par correspondance de tokens sur le
 * nom ("bazin bleu" doit matcher "Bazin Riche Bleu"). Une ambiguïté ne choisit rien.
 */
export const findProduct = (products: Product[], ref: string): Product | undefined => {
    if (!ref) return undefined;
    const trimmed = ref.trim();

    const byId = products.find(p => String(p.id) === trimmed);
    if (byId) return byId;

    const exact = products.filter(p => normalize(p.name) === normalize(trimmed));
    if (exact.length) return exact.length === 1 ? exact[0] : undefined;
    const queryTokens = normalize(trimmed).split(' ').filter(Boolean);
    if (queryTokens.length === 0) return undefined;

    const candidates: Product[] = [];
    for (const p of products) {
        const nameTokens = new Set(normalize(p.name).split(' '));
        let matched = 0;
        for (const t of queryTokens) {
            if (nameTokens.has(t)) { matched++; continue; }
            // Tolérance limitée au pluriel, pas aux préfixes arbitraires.
            for (const nt of nameTokens) {
                if (nt === `${t}s` || t === `${nt}s`) { matched++; break; }
            }
        }
        if (matched === queryTokens.length) candidates.push(p);
    }
    return candidates.length === 1 ? candidates[0] : undefined;
};

// ---------------------------------------------------------------------------
// VALIDATION D'UN DEAL (prix plancher + stock) — LE garde-fou
// ---------------------------------------------------------------------------

export type DealRejection =
    | { ok: false; reason: 'UNKNOWN_PRODUCT'; ref: string }
    | { ok: false; reason: 'BAD_QUANTITY'; product: Product }
    | { ok: false; reason: 'PRICE_TOO_LOW'; product: Product; offered: number; floor: number }
    | { ok: false; reason: 'OUT_OF_STOCK'; product: Product }
    | { ok: false; reason: 'INSUFFICIENT_STOCK'; product: Product; requested: number; available: number };

export type DealValidation = { ok: true; product: Product; item: CartItem } | DealRejection;

/** Prix plancher d'un produit : minPrice explicite, sinon marge globale, sinon prix public. */
export const priceFloor = (product: Product, settings: Settings): number => {
    if (!settings.negotiationEnabled) return product.price;
    if (product.minPrice && product.minPrice > 0) return product.minPrice;
    const margin = settings.negotiationMargin ?? 10;
    return Math.max(0, Math.round(product.price * (1 - margin / 100)));
};

/** Stock effectivement disponible (undefined = illimité / non géré). */
export const availableStock = (product: Product): number | undefined => {
    if (product.manageStock === false) return undefined;
    if (product.stock === undefined || product.stock === null) return undefined;
    return product.stock;
};

/**
 * Valide un deal proposé par l'IA. Ne fait confiance à RIEN :
 * - produit retrouvé côté serveur (id puis fuzzy)
 * - quantité entière et bornée
 * - prix unitaire dans [plancher, prix public] (clampé au prix public si au-dessus)
 * - stock suffisant (niveau produit ; le stock par variation est vérifié au choix de la variante)
 */
export const validateDeal = (products: Product[], deal: RawDeal, settings: Settings): DealValidation => {
    const product = findProduct(products, deal.productRef);
    if (!product) return { ok: false, reason: 'UNKNOWN_PRODUCT', ref: deal.productRef };

    const quantity = deal.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_LINE) {
        return { ok: false, reason: 'BAD_QUANTITY', product };
    }

    const stock = availableStock(product);
    if (stock !== undefined) {
        if (stock <= 0) return { ok: false, reason: 'OUT_OF_STOCK', product };
        if (stock < quantity) return { ok: false, reason: 'INSUFFICIENT_STOCK', product, requested: quantity, available: stock };
    }

    const floor = priceFloor(product, settings);
    let unitPrice = Math.round(deal.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) unitPrice = product.price;
    // Jamais au-dessus du prix public (l'IA ne doit pas surfacturer)
    if (unitPrice > product.price) unitPrice = product.price;
    // Jamais en-dessous du plancher (jailbreak / hallucination)
    if (unitPrice < floor) {
        return { ok: false, reason: 'PRICE_TOO_LOW', product, offered: unitPrice, floor };
    }

    return {
        ok: true,
        product,
        item: {
            productId: product.id,
            productName: product.name,
            quantity,
            price: unitPrice,
        },
    };
};

// ---------------------------------------------------------------------------
// LIVRAISON
// ---------------------------------------------------------------------------

export interface DeliveryQuote {
    known: boolean;        // false = zone non reconnue, frais à confirmer
    fee: number;           // 0 si offerte / inconnue / désactivée
    label: string;         // ex: "Livraison (Cocody)", "Livraison offerte"
    zone?: DeliveryZone;
}

/** Retrouve la zone de livraison mentionnée dans une adresse libre. */
export const matchDeliveryZone = (address: string, zones: DeliveryZone[] | undefined): DeliveryZone | undefined => {
    if (!address || !Array.isArray(zones) || zones.length === 0) return undefined;
    const addr = ` ${normalize(address)} `;
    // On privilégie la zone au nom le plus long (ex: "Abidjan Nord" avant "Abidjan")
    const sorted = [...zones].sort((a, b) => b.name.length - a.name.length);
    for (const z of sorted) {
        const zn = normalize(z.name);
        if (zn && addr.includes(` ${zn} `)) return z;
        // tolérance : nom de zone collé à une ponctuation déjà normalisée
        if (zn && addr.includes(zn) && zn.length >= 4) return z;
    }
    return undefined;
};

/** Calcule les frais de livraison pour une adresse donnée. */
export const computeDelivery = (itemsTotal: number, address: string, settings: Settings): DeliveryQuote => {
    if (!settings.deliveryEnabled) {
        return { known: true, fee: 0, label: 'Retrait / livraison à convenir' };
    }

    const threshold = settings.freeDeliveryThreshold || 0;
    if (threshold > 0 && itemsTotal >= threshold) {
        return { known: true, fee: 0, label: 'Livraison offerte' };
    }

    const zone = matchDeliveryZone(address, settings.deliveryZones);
    if (zone) {
        return { known: true, fee: zone.price, label: `Livraison (${zone.name})`, zone };
    }

    return { known: false, fee: 0, label: 'Livraison à confirmer selon votre zone' };
};

/** Ligne d'article représentant la livraison dans la commande (visible dans le dashboard). */
export const buildDeliveryItem = (quote: DeliveryQuote): CartItem => ({
    productId: DELIVERY_ITEM_ID,
    productName: quote.label,
    quantity: 1,
    price: quote.fee,
});

/** Sépare les vrais articles de la ligne livraison d'une commande. */
export const splitDeliveryItem = (items: CartItem[]): { products: CartItem[]; delivery?: CartItem } => {
    const products = items.filter(i => i.productId !== DELIVERY_ITEM_ID);
    const delivery = items.find(i => i.productId === DELIVERY_ITEM_ID);
    return { products, delivery };
};

// ---------------------------------------------------------------------------
// INTENTIONS CLIENT (annulation, question) — heuristiques sans appel IA
// ---------------------------------------------------------------------------

const CANCEL_PATTERNS = [
    'annule', 'annuler', 'annulle', "j'annule", 'stop', 'laisse tomber', 'laisser tomber',
    'abandonne', 'je ne veux plus', "c'est bon laisse", 'oublie', 'oublié ça',
];

export const isCancelIntent = (text: string): boolean => {
    const t = normalize(text);
    if (t.length > 60) return false; // une longue phrase n'est pas une annulation sèche
    if (/\b(ne|pas|non)\b.*\b(annul|stop|oubli)/.test(t)) return false;
    const clean = t.replace(/[.!?,]+$/g, '').trim();
    return CANCEL_PATTERNS.some(p => clean === normalize(p)) ||
        /^(?:j annule|annule|annuler|annulle) (?:la|ma|cette) commande$/.test(clean);
};

const QUESTION_STARTERS = [
    'combien', "c'est combien", 'cest combien', 'est-ce', 'est ce', 'pourquoi', 'comment',
    'quand', 'quel', 'quelle', 'vous avez', 'tu as', 'y a', 'il y a', 'avez-vous', 'montre',
    'je peux voir', 'photo', 'attends', 'attend', 'minute',
];

export const looksLikeQuestion = (text: string): boolean => {
    const t = normalize(text);
    if (text.includes('?')) return true;
    return QUESTION_STARTERS.some(q => t.startsWith(normalize(q)));
};

/**
 * Heuristique : ce texte ressemble-t-il à une adresse de livraison plausible ?
 * (On refuse les questions, annulations et messages trop courts pour être une adresse.)
 */
export const looksLikeAddress = (text: string, zones: string[] = []): boolean => {
    if (isCancelIntent(text) || looksLikeQuestion(text)) return false;
    const t = normalize(text);
    if (t.length < 4) return false;
    if (!/[a-z]/.test(t)) return false; // uniquement chiffres/émojis → pas une adresse
    if (/\b(merci|plutot|ajoute|retire|remplace|photos?|prix|prends|annuler)\b/.test(t)) return false;
    const places = ['abidjan', 'cocody', 'angre', 'yopougon', 'abobo', 'adjame', 'marcory', 'koumassi', 'treichville', 'plateau', 'port bouet', 'bingerville', 'anyama', 'bouake', 'yamoussoukro', 'daloa', 'san pedro', ...zones];
    return places.some(place => {
        const name = normalize(place);
        return name.length >= 3 && (` ${t} `).includes(` ${name} `);
    }) || /\b(rue|avenue|quartier|carrefour|cite|lot|ilot)\s+\S+/.test(t);
};

// ---------------------------------------------------------------------------
// FORMATAGE
// ---------------------------------------------------------------------------

export const formatFcfa = (n: number): string => `${n.toLocaleString('fr-FR')} FCFA`;

/** Récapitulatif lisible d'un panier (sans la ligne livraison). */
export const cartSummary = (items: CartItem[]): string =>
    splitDeliveryItem(items).products.map(i => {
        const vars = i.selectedVariations && i.selectedVariations.length > 0
            ? ` (${i.selectedVariations.map((v: SelectedVariation) => v.value).join(', ')})`
            : '';
        return `${i.quantity}x ${i.productName}${vars} — ${formatFcfa(i.price * i.quantity)}`;
    }).join('\n');

// ---------------------------------------------------------------------------
// CHOIX D'UNE OPTION DE VARIATION
// ---------------------------------------------------------------------------

export interface VariationOption {
    value: string;
    [key: string]: unknown;
}

export type OptionChoice =
    | { kind: 'match'; option: VariationOption }
    | { kind: 'none' }
    | { kind: 'ambiguous'; candidates: VariationOption[] };

/**
 * Choisit l'option demandée par le client, ou refuse de choisir.
 *
 * L'ancienne règle était `option.value.toLowerCase().includes(saisie)`. Or
 * « xs » contient « s » et « xl » contient « l » : un client qui répondait
 * « S » se voyait vendre du XS, et « L » du XL — sans que rien ne le signale,
 * ni à lui ni au vendeur, jusqu'à la livraison.
 *
 * Ordre : correspondance exacte, puis numéro de la liste, puis correspondance
 * partielle SEULEMENT si elle désigne une option et une seule. Deux candidates
 * font demander de préciser, ce qui vaut mieux qu'un tirage au sort.
 */
export const chooseVariationOption = (input: string, options: VariationOption[]): OptionChoice => {
    const typed = input.trim().toLowerCase();
    if (!typed || !Array.isArray(options) || options.length === 0) return { kind: 'none' };

    const exact = options.filter(o => String(o.value).trim().toLowerCase() === typed);
    if (exact.length === 1) return { kind: 'match', option: exact[0] };
    if (exact.length > 1) return { kind: 'ambiguous', candidates: exact };

    // « 2 » = deuxième option proposée. Uniquement si la saisie est un nombre seul,
    // sinon une option nommée « 2XL » serait interprétée comme un rang.
    if (/^\d+$/.test(typed)) {
        const index = parseInt(typed, 10) - 1;
        if (index >= 0 && index < options.length) return { kind: 'match', option: options[index] };
        return { kind: 'none' };
    }

    const partial = options.filter(o => String(o.value).trim().toLowerCase().includes(typed));
    if (partial.length === 1) return { kind: 'match', option: partial[0] };
    if (partial.length > 1) return { kind: 'ambiguous', candidates: partial };

    return { kind: 'none' };
};
