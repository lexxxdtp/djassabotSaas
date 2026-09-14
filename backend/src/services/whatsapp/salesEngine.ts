import { Product, Settings, CartItem, DeliveryZone, SelectedVariation } from '../../types';

/**
 * salesEngine — logique de vente PURE (sans I/O), partagée entre le vrai bot
 * WhatsApp (flowHandler) et le simulateur du dashboard (aiRoutes).
 *
 * Rôle : c'est le garde-fou serveur autour de l'IA. L'IA propose (tags
 * [ADD_TO_CART], [REMOVE_FROM_CART], [SET_QUANTITY]), le serveur DISPOSE :
 * prix plancher, stock, quantités, puis total accepté par le client.
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
// PARSING DES TAGS DE PANIER ET D'IMAGE
// ---------------------------------------------------------------------------

export interface RawDeal {
    productRef: string;  // id produit (ou nom si l'IA s'est trompée)
    quantity: number;
    unitPrice: number;
}

/** Modification d'un panier existant demandée par l'IA. */
export interface CartEdit {
    kind: 'remove' | 'set_quantity';
    productRef: string;
    quantity?: number;   // set_quantity uniquement ; 0 revient à retirer
}

export interface ParsedResponse {
    cleaned: string;      // réponse sans les tags (texte client)
    deals: RawDeal[];
    cartEdits: CartEdit[];
    imageUrls: string[];  // URLs des tags [IMAGE: url] (non filtrées — à valider par l'appelant)
    invalidDealCount: number; // tags de panier mal formés (ajout, retrait ou quantité)
}

const CART_TAG_RE = /\[ADD_TO_CART:\s*([^\]]*)\]/gi;
const REMOVE_TAG_RE = /\[REMOVE_FROM_CART:\s*([^\]]*)\]/gi;
const QUANTITY_TAG_RE = /\[SET_QUANTITY:\s*([^\]]*)\]/gi;
const IMAGE_TAG_RE = /\[IMAGE:\s*([^\]]+?)\s*\]/gi;
/** Tag machine inventé ou recopié du contexte ([CONFIRM_ORDER], [IMAGES_AVAILABLE: …]) : jamais montré au client. */
const STRAY_TAG_RE = /\[[A-Z][A-Z_]{2,}(?::[^\]]*)?\]/g;

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

/** Extrait les tags de panier et [IMAGE] de la réponse IA, renvoie le texte nettoyé. */
export const parseAIResponse = (response: string): ParsedResponse => {
    const deals: RawDeal[] = [];
    const cartEdits: CartEdit[] = [];
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

    cleaned = cleaned.replace(REMOVE_TAG_RE, (_m, body: string) => {
        const ref = body.trim();
        if (ref && !ref.includes('|')) cartEdits.push({ kind: 'remove', productRef: ref });
        else invalidDealCount++;
        return '';
    });

    cleaned = cleaned.replace(QUANTITY_TAG_RE, (_m, body: string) => {
        const [ref = '', qty = '', ...extra] = body.split('|');
        const quantity = /k/i.test(qty) ? NaN : parseNumber(qty);
        if (!extra.length && ref.trim() && Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= MAX_QTY_PER_LINE) {
            cartEdits.push({ kind: 'set_quantity', productRef: ref.trim(), quantity });
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

    cleaned = cleaned.replace(STRAY_TAG_RE, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    return { cleaned, deals, cartEdits, imageUrls, invalidDealCount };
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
// REVALIDATION DU PANIER AU MOMENT DU « OUI »
// ---------------------------------------------------------------------------

const findOption = (product: Product, selection: SelectedVariation) =>
    product.variations?.find(v => v.name === selection.name)?.options.find(o => o.value === selection.value);

/**
 * Somme des suppléments des options choisies, ou null si une option n'existe
 * plus dans la fiche (supprimée ou renommée depuis l'ajout au panier).
 */
export const selectedModifier = (product: Product, selected: SelectedVariation[] | undefined): number | null => {
    let total = 0;
    for (const selection of selected || []) {
        const option = findOption(product, selection);
        if (!option) return null;
        const modifier = option.priceModifier ?? 0;
        if (!Number.isFinite(modifier)) return null;
        total += modifier;
    }
    return total;
};

export type CartIssue =
    | { kind: 'REMOVED'; item: CartItem }
    | { kind: 'STOCK'; item: CartItem; available: number }
    | { kind: 'PRICE'; item: CartItem; newPrice: number };

/**
 * Revérifie le panier contre le catalogue et les réglages ACTUELS, juste avant
 * d'enregistrer la commande. Entre l'ajout et le « oui », le vendeur a pu
 * changer un prix, un plancher, une option ou le stock : le client doit alors
 * revoir le récapitulatif, pas payer un prix que plus rien ne justifie.
 *
 * - produit ou option disparus, quantité invalide, prix final négatif → ligne retirée
 * - stock (produit ou option) insuffisant pour les quantités cumulées → ligne retirée
 * - prix hors [plancher, prix public], suppléments inclus → ramené dans l'intervalle
 */
export const revalidateCart = (products: Product[], items: CartItem[], settings: Settings): { items: CartItem[]; issues: CartIssue[] } => {
    const lines = splitDeliveryItem(items).products;
    const optionKey = (productId: string, selection: SelectedVariation) => `${productId} ${selection.name} ${selection.value}`;
    const perProduct = new Map<string, number>();
    const perOption = new Map<string, number>();
    for (const line of lines) {
        const id = String(line.productId);
        perProduct.set(id, (perProduct.get(id) ?? 0) + line.quantity);
        for (const selection of line.selectedVariations || []) {
            const key = optionKey(id, selection);
            perOption.set(key, (perOption.get(key) ?? 0) + line.quantity);
        }
    }

    const kept: CartItem[] = [];
    const issues: CartIssue[] = [];
    for (const item of lines) {
        const id = String(item.productId);
        const product = products.find(p => String(p.id) === id);
        const modifier = product ? selectedModifier(product, item.selectedVariations) : null;
        const ceiling = product && modifier !== null ? product.price + modifier : NaN;
        if (!product || modifier === null || !Number.isSafeInteger(item.quantity) || item.quantity < 1
            || !Number.isSafeInteger(ceiling) || ceiling < 0) {
            issues.push({ kind: 'REMOVED', item });
            continue;
        }

        if (product.manageStock !== false) {
            let available: number | undefined;
            const stock = availableStock(product);
            if (stock !== undefined && (perProduct.get(id) ?? 0) > stock) available = stock;
            for (const selection of item.selectedVariations || []) {
                const option = findOption(product, selection);
                if (option && option.stock !== undefined && option.stock !== null
                    && (perOption.get(optionKey(id, selection)) ?? 0) > option.stock) {
                    available = Math.min(available ?? option.stock, option.stock);
                }
            }
            if (available !== undefined) {
                issues.push({ kind: 'STOCK', item, available: Math.max(0, available) });
                continue;
            }
        }

        const floor = Math.min(ceiling, Math.max(0, Math.ceil(priceFloor(product, settings) + modifier)));
        let newPrice = item.price;
        if (!Number.isSafeInteger(item.price) || item.price > ceiling) newPrice = ceiling;
        else if (item.price < floor) newPrice = floor;

        if (newPrice !== item.price) {
            issues.push({ kind: 'PRICE', item, newPrice });
            kept.push({ ...item, price: newPrice });
            continue;
        }
        kept.push(item);
    }
    return { items: kept, issues };
};

/** Explication client des corrections apportées par revalidateCart. */
export const describeCartIssues = (issues: CartIssue[]): string => issues.map(issue => {
    const name = `${issue.item.productName}${variationSuffix(issue.item)}`;
    if (issue.kind === 'REMOVED') return `- ${name} : n'est plus disponible, je l'ai retiré`;
    if (issue.kind === 'STOCK') {
        return issue.available > 0
            ? `- ${name} : il n'en reste que ${issue.available}, je l'ai retiré (redites-moi la quantité voulue)`
            : `- ${name} : épuisé entre-temps, je l'ai retiré`;
    }
    return `- ${name} : le prix est maintenant de ${formatFcfa(issue.newPrice)} l'unité`;
}).join('\n');

// ---------------------------------------------------------------------------
// MODIFICATION DU PANIER (retrait, quantité)
// ---------------------------------------------------------------------------

export type CartEditOutcome =
    | { ok: true; items: CartItem[]; changes: string[] }
    | { ok: false; message: string };

/**
 * Applique au panier RÉEL les retraits et changements de quantité demandés par
 * l'IA. Une demande ambiguë ou impossible ne modifie rien et renvoie la
 * question à poser au client : jamais de « c'est fait » sans que ce soit fait.
 */
export const applyCartEdits = (items: CartItem[], edits: CartEdit[], products: Product[]): CartEditOutcome => {
    let lines = splitDeliveryItem(items).products.map(item => ({ ...item }));
    const changes: string[] = [];

    for (const edit of edits) {
        let targets = lines.filter(line => String(line.productId) === edit.productRef);
        if (targets.length === 0) {
            const product = findProduct(products, edit.productRef)
                ?? findProduct(lines.map(line => ({ id: line.productId, name: line.productName }) as Product), edit.productRef);
            if (product) targets = lines.filter(line => String(line.productId) === String(product.id));
        }
        if (targets.length === 0) {
            return {
                ok: false,
                message: lines.length > 0
                    ? `Je ne retrouve pas cet article dans votre panier 🤔 Il contient :\n${cartSummary(lines)}\n\nLequel voulez-vous modifier ?`
                    : 'Votre panier est vide pour le moment 🙂 Dites-moi ce qui vous ferait plaisir !',
            };
        }

        if (edit.kind === 'remove' || edit.quantity === 0) {
            lines = lines.filter(line => !targets.includes(line));
            changes.push(`${targets[0].productName} retiré`);
            continue;
        }

        if (targets.length > 1) {
            return {
                ok: false,
                message: `Vous avez plusieurs ${targets[0].productName} dans le panier :\n${cartSummary(targets)}\n\nLequel voulez-vous modifier ?`,
            };
        }

        const line = targets[0];
        const quantity = edit.quantity as number;
        const product = products.find(p => String(p.id) === String(line.productId));
        if (product && product.manageStock !== false) {
            let available = availableStock(product);
            for (const selection of line.selectedVariations || []) {
                const option = findOption(product, selection);
                if (option && option.stock !== undefined && option.stock !== null) {
                    available = Math.min(available ?? option.stock, option.stock);
                }
            }
            if (available !== undefined && quantity > available) {
                return {
                    ok: false,
                    message: available > 0
                        ? `Il ne reste que ${available} ${line.productName}${variationSuffix(line)} en stock 📦 Dites-moi la quantité voulue (${available} maximum).`
                        : `Désolé, ${line.productName}${variationSuffix(line)} est épuisé 😔`,
                };
            }
        }
        line.quantity = quantity;
        changes.push(`${line.productName}${variationSuffix(line)} : ${quantity}`);
    }

    return { ok: true, items: lines, changes };
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
    const sorted = zones
        .filter(z => z && typeof z.name === 'string')
        .sort((a, b) => b.name.length - a.name.length);
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

    // Sans zone reconnue, aucun tarif n'est annoncé — pas même « offert » : le
    // seuil de gratuité ne vaut que là où le vendeur livre réellement.
    const zone = matchDeliveryZone(address, settings.deliveryZones);
    const price = Number(zone?.price);
    if (!zone || !Number.isSafeInteger(price) || price < 0) {
        return { known: false, fee: 0, label: 'Livraison à confirmer selon votre zone' };
    }

    const threshold = settings.freeDeliveryThreshold || 0;
    if (threshold > 0 && itemsTotal >= threshold) {
        return { known: true, fee: 0, label: 'Livraison offerte', zone };
    }

    return { known: true, fee: price, label: `Livraison (${zone.name})`, zone };
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

/**
 * Lignes enregistrées dans la commande. Une ligne à 0 est nécessaire pour
 * distinguer une livraison réellement offerte d'une zone inconnue dont le
 * tarif doit encore être confirmé (aucune ligne).
 */
export const buildOrderLines = (productItems: CartItem[], quote: DeliveryQuote): CartItem[] =>
    quote.known ? [...productItems, buildDeliveryItem(quote)] : [...productItems];

/** Total des articles, hors livraison. */
export const cartTotal = (items: CartItem[]): number =>
    splitDeliveryItem(items).products.reduce((sum, item) => sum + item.price * item.quantity, 0);

// ---------------------------------------------------------------------------
// INTENTIONS CLIENT (annulation, question, confirmation) — sans appel IA
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

/** « Je ne suis pas à Cocody », « c'est pas à Yopougon » : une zone citée pour être exclue. */
const NEGATED_PLACE_RE = /\b(?:ne|n)\s+(?:suis|habite|reste|vis|serai|sera|est|livre|livrez)\s+(?:pas|plus)\b|\b(?:suis|habite|reste|vis)\s+(?:pas|plus)\b|\bpas\s+(?:a|au|aux|en|dans|sur|vers|chez)\b|\b(?:hors|dehors)\b/;

/**
 * Heuristique : ce texte ressemble-t-il à une adresse de livraison plausible ?
 * (On refuse les questions, annulations, négations et messages trop courts.)
 */
export const looksLikeAddress = (text: string, zones: string[] = []): boolean => {
    if (isCancelIntent(text) || looksLikeQuestion(text)) return false;
    const t = normalize(text);
    if (t.length < 4) return false;
    if (!/[a-z]/.test(t)) return false; // uniquement chiffres/émojis → pas une adresse
    if (NEGATED_PLACE_RE.test(t)) return false;
    if (/\b(merci|plutot|ajoute|retire|remplace|photos?|prix|prends|annuler)\b/.test(t)) return false;
    const places = ['abidjan', 'cocody', 'angre', 'yopougon', 'abobo', 'adjame', 'marcory', 'koumassi', 'treichville', 'plateau', 'port bouet', 'bingerville', 'anyama', 'bouake', 'yamoussoukro', 'daloa', 'san pedro', ...zones];
    return places.some(place => {
        const name = normalize(place);
        return name.length >= 3 && (` ${t} `).includes(` ${name} `);
    }) || /\b(rue|avenue|quartier|carrefour|cite|lot|ilot)\s+\S+/.test(t);
};

const CONFIRM_PHRASES = [
    'oui', 'ouais', 'ouai', 'wi', 'yes', 'ok', 'okay', 'okey', 'd accord', 'daccord', 'dac',
    'je confirme', 'confirme', 'confirmer', 'c est bon', 'cest bon', 'c bon', 'je valide', 'on valide',
    'valide', 'valider', 'go', 'vas y', 'vasy', 'vazy', 'allez y', 'parfait', 'ca marche', 'exactement', 'tout a fait',
];
const CONFIRM_WORDS = new Set([
    ...CONFIRM_PHRASES.flatMap(phrase => phrase.split(' ')),
    'merci', 'beaucoup', 'svp', 'stp', 'chef', 'patron', 'boss', 'deh', 'bien', 'sur', 'pour', 'moi',
    'ma', 'la', 'commande', 'je', 'on', 'hein', 'tantie', 'tonton', 'maman',
]);
const CONFIRM_BLOCKERS = /\b(?:non|nan|pas|mais|sauf|attends?|attendez|plutot|ajoute|ajouter|retire|retirer|enleve|enlever|change|changer|annule|annuler|combien|quand|comment|pourquoi)\b/;

/** Répétitions de chat (« ouiii », « okkk ») ramenées à la forme simple. */
const squeeze = (t: string) => t.replace(/(.)\1{2,}/g, '$1');

/**
 * Le client valide-t-il, sans rien ajouter, le récapitulatif qu'on vient de lui
 * montrer ? Tout doute (question, négation, demande de modification, mot
 * inconnu) renvoie false : un « oui mais… » ne crée jamais une commande.
 */
export const isConfirmIntent = (text: string): boolean => {
    const raw = text.trim();
    if (!raw || raw.includes('?')) return false;
    if (/^[\s\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}]+$/u.test(raw)) return /👍|👌|✅/u.test(raw);
    const t = squeeze(normalize(raw));
    if (!t || t.length > 60 || CONFIRM_BLOCKERS.test(t)) return false;
    if (!CONFIRM_PHRASES.some(phrase => t === phrase || t.startsWith(`${phrase} `))) return false;
    return t.split(' ').every(word => CONFIRM_WORDS.has(word));
};

/** « Non », « pas encore » : le client refuse le récapitulatif sans dire quoi changer. */
export const isNegativeReply = (text: string): boolean => {
    const t = squeeze(normalize(text));
    return /^(?:non|nan|no|nope|pas encore|pas maintenant|pas pour l instant|attends?|attendez)(?: merci)?$/.test(t);
};

// ---------------------------------------------------------------------------
// FORMATAGE
// ---------------------------------------------------------------------------

export const formatFcfa = (n: number): string => `${n.toLocaleString('fr-FR')} FCFA`;

const variationSuffix = (item: CartItem): string =>
    item.selectedVariations && item.selectedVariations.length > 0
        ? ` (${item.selectedVariations.map((v: SelectedVariation) => v.value).join(', ')})`
        : '';

/** Récapitulatif lisible d'un panier (sans la ligne livraison). */
export const cartSummary = (items: CartItem[]): string =>
    splitDeliveryItem(items).products
        .map(i => `${i.quantity}x ${i.productName}${variationSuffix(i)} — ${formatFcfa(i.price * i.quantity)}`)
        .join('\n');

/** Panier tel que l'IA doit le voir pour émettre des tags justes (ids inclus). */
export const cartContextForAI = (items: CartItem[]): string => {
    const lines = splitDeliveryItem(items).products;
    if (lines.length === 0) return '(panier vide)';
    return lines
        .map(i => `- ${i.quantity}x ${i.productName}${variationSuffix(i)} (id: ${i.productId}) — ${i.price} FCFA l'unité`)
        .join('\n');
};

const deliveryAndTotalLines = (quote: DeliveryQuote, itemsTotal: number): string => quote.known
    ? `${quote.fee > 0 ? `${quote.label} : ${formatFcfa(quote.fee)}` : `${quote.label} ✅`}\n*Total : ${formatFcfa(itemsTotal + quote.fee)}*`
    : `Livraison : tarif à confirmer par le vendeur pour votre zone\n*Total articles : ${formatFcfa(itemsTotal)}* (livraison en plus)`;

/** Récapitulatif soumis au client AVANT toute écriture : il doit répondre « oui ». */
export const confirmationRecap = (productItems: CartItem[], quote: DeliveryQuote, address: string): string => {
    const itemsTotal = cartTotal(productItems);
    return `📦 *Récapitulatif de votre commande*\n\n${cartSummary(productItems)}\nArticles : ${formatFcfa(itemsTotal)}\n${deliveryAndTotalLines(quote, itemsTotal)}\n📍 Livraison à : ${address}\n\n✅ Répondez *OUI* pour valider la commande.\n✏️ Sinon, dites-moi ce qu'il faut changer (article, quantité ou adresse).`;
};

/** Confirmation envoyée une fois la commande réellement enregistrée. */
export const orderConfirmationText = (productItems: CartItem[], quote: DeliveryQuote, address: string, acceptedPayments: unknown): string => {
    const itemsTotal = cartTotal(productItems);
    const payments = Array.isArray(acceptedPayments) ? acceptedPayments : [];
    const paymentHint = payments.some(p => ['wave', 'om', 'mtn'].includes(p))
        ? '\n\n💡 Après paiement (Wave/Orange Money…), envoyez la capture du reçu ici. Le vendeur vérifiera la réception du paiement.'
        : '';
    return `✅ *Commande confirmée !*\n\n${cartSummary(productItems)}\nArticles : ${formatFcfa(itemsTotal)}\n${deliveryAndTotalLines(quote, itemsTotal)}\n\n📍 Livraison à : ${address}${paymentHint}`;
};

/** Zone non reconnue : on montre les zones desservies plutôt que d'inventer un tarif. */
export const zoneQuestion = (zones: DeliveryZone[]): string =>
    `Je n'ai pas reconnu votre zone de livraison 🤔 Nous livrons à :\n${zones.map(z => `- ${z.name} : ${formatFcfa(Number(z.price))}`).join('\n')}\n\nDans quelle zone êtes-vous ? (ou précisez votre commune)`;

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
