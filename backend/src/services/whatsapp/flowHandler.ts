import { randomUUID } from 'crypto';
import { WASocket } from '@whiskeysockets/baileys';
import { db, PlaceOrderResult } from '../dbService';
import { getSession, updateSession, addToHistory, addItemToSessionCart, replaceSessionCart, Session } from '../sessionService';
import { generateAIResponse } from '../aiService';
import { sendOrderNotification } from './notificationService';
import {
    buildInventoryContext,
    parseAIResponse,
    validateDeal,
    computeDelivery,
    buildOrderLines,
    cartSummary,
    cartTotal,
    cartContextForAI,
    confirmationRecap,
    orderConfirmationText,
    zoneQuestion,
    matchDeliveryZone,
    revalidateCart,
    describeCartIssues,
    applyCartEdits,
    formatFcfa,
    isCancelIntent,
    isConfirmIntent,
    isNegativeReply,
    looksLikeQuestion,
    looksLikeAddress,
    splitDeliveryItem,
    chooseVariationOption,
    DealValidation,
} from './salesEngine';
import { Product, Settings, CartItem, ProductVariation } from '../../types';
import { logger } from '../../utils/logger';

/**
 * flowHandler — orchestre la conversation de vente.
 *
 * Principe : L'IA PROPOSE, LE SERVEUR DISPOSE.
 * L'IA négocie et conclut en langage naturel, mais chaque modification du
 * panier passe par le moteur (prix plancher, stock, quantité). Le parcours :
 *
 *   IDLE ─ajout─► (WAITING_FOR_VARIATION) ─► WAITING_FOR_ADDRESS
 *        ─adresse chiffrée─► WAITING_FOR_CONFIRMATION ─« oui »─► commande
 *
 * La commande n'est écrite qu'après un « oui » sur le récapitulatif (articles,
 * livraison, total), et stock + commande sont enregistrés en une seule
 * opération que l'on peut rejouer sans doublon.
 */

/** Plafond d'articles traités par message : garde-fou contre une réponse IA aberrante. */
const MAX_DEALS_PER_MESSAGE = 3;

/** Envoie un texte au client ET le journalise dans l'historique (Inbox). */
async function reply(sock: WASocket, tenantId: string, remoteJid: string, text: string) {
    await sock.sendMessage(remoteJid, { text });
    await addToHistory(tenantId, remoteJid, 'model', text);
}

export interface FlowOptions {
    /**
     * Mode simulateur (Réglages → Mon Bot) : même conversation, mêmes règles,
     * mais AUCUNE commande créée, AUCUN stock décrémenté, AUCUNE notification vendeur.
     */
    dryRun?: boolean;
}

/**
 * Données déjà chargées par l'appelant (messageHandler a souvent déjà lu
 * `settings` pour vérifier botActive/abonnement avant d'arriver ici). Évite
 * de refaire le même aller-retour Supabase à chaque message. Optionnel :
 * si absent, handleFlow fetch lui-même comme avant (comportement inchangé).
 */
export interface Preloaded {
    settings?: Settings;
    products?: Product[];
}

interface FlowContext {
    tenantId: string;
    remoteJid: string;
    sock: WASocket;
    session: Session;
    settings: Settings;
    products: Product[];
    options: FlowOptions;
}

type TempOrder = NonNullable<Session['tempOrder']>;

const hasCartItems = (tempOrder: Session['tempOrder']): tempOrder is TempOrder =>
    Boolean(tempOrder && Array.isArray(tempOrder.items) && splitDeliveryItem(tempOrder.items).products.length > 0);

const deliveryZones = (settings: Settings) => (Array.isArray(settings.deliveryZones) ? settings.deliveryZones : []);

const optionsList = (variation: ProductVariation) =>
    variation.options.map((o, i) => `${i + 1}. ${o.value}`).join('\n');

/** Champs du choix de variantes en cours, à retirer une fois ce choix terminé. */
const VARIATION_PROGRESS_KEYS = ['productId', 'productName', 'basePrice', 'quantity', 'variationIndex', 'selectedVariations', 'priceAdjustment', 'pendingVariations'];
const withoutVariationProgress = (tempOrder: TempOrder): TempOrder =>
    Object.fromEntries(Object.entries(tempOrder).filter(([key]) => !VARIATION_PROGRESS_KEYS.includes(key))) as TempOrder;

export async function handleFlow(
    tenantId: string,
    remoteJid: string,
    text: string,
    sock: WASocket,
    options: FlowOptions = {},
    preloaded: Preloaded = {},
) {
    const session = await getSession(tenantId, remoteJid);

    if (session.autopilotEnabled === false) return;

    const settings = preloaded.settings ?? await db.getSettings(tenantId);
    const products = preloaded.products ?? await db.getProducts(tenantId);

    // --- ANNULATION GLOBALE : valable dans tous les états d'attente ---
    if (session.state !== 'IDLE' && isCancelIntent(text)) {
        await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
        await reply(sock, tenantId, remoteJid, 'Pas de souci, j\'ai tout annulé 👍 Dites-moi si je peux vous aider pour autre chose !');
        return;
    }

    const ctx: FlowContext = { tenantId, remoteJid, sock, session, settings, products, options };

    // --- STATE MACHINE ---
    if (session.state === 'WAITING_FOR_ADDRESS') return handleAddressStep(ctx, text);
    if (session.state === 'WAITING_FOR_CONFIRMATION') return handleConfirmationStep(ctx, text);
    if (session.state === 'WAITING_FOR_VARIATION') return handleVariationStep(ctx, text);

    // FLUX STANDARD (IDLE) — un seul appel IA, tags validés par le serveur
    await answerWithAI(ctx, text, { allowDeals: true });
}

async function expireCart(ctx: FlowContext) {
    await updateSession(ctx.tenantId, ctx.remoteJid, { state: 'IDLE', tempOrder: undefined });
    await reply(ctx.sock, ctx.tenantId, ctx.remoteJid, 'Votre panier a expiré. Pas de souci, on peut recommencer quand vous voulez !');
}

// ---------------------------------------------------------------------------
// 1. EN ATTENTE DE L'ADRESSE DE LIVRAISON
// ---------------------------------------------------------------------------

async function handleAddressStep(ctx: FlowContext, text: string) {
    const tempOrder = ctx.session.tempOrder;
    if (!hasCartItems(tempOrder)) {
        await expireCart(ctx);
        return;
    }

    const zones = deliveryZones(ctx.settings);

    // Une question, une négation (« je ne suis pas à Cocody ») ou une demande de
    // modification ne devient jamais l'adresse : l'IA répond, le panier reste modifiable.
    if (!looksLikeAddress(text, zones.map(zone => zone.name))) {
        await answerWithAI(ctx, text, { allowDeals: true, stateNote: addressStateNote(tempOrder) });
        return;
    }

    // Réponse courte à « dans quelle zone ? » : elle complète l'adresse déjà reçue.
    const typed = text.trim();
    const address = tempOrder.addressDraft && matchDeliveryZone(typed, zones) && typed.split(/\s+/).length <= 3
        ? `${tempOrder.addressDraft}, ${typed}`
        : typed;
    await presentQuote(ctx, tempOrder, address);
}

/**
 * Chiffre la livraison pour l'adresse et soumet le récapitulatif au client.
 * Rien n'est écrit en base à ce stade : la commande attend son « oui ».
 */
async function presentQuote(ctx: FlowContext, tempOrder: TempOrder, address: string, preface?: string) {
    const { tenantId, remoteJid, settings } = ctx;
    const productItems = splitDeliveryItem(tempOrder.items).products;
    const itemsTotal = cartTotal(productItems);
    const quote = computeDelivery(itemsTotal, address, settings);
    const zones = deliveryZones(settings);

    // Zone non reconnue : on la demande une fois parmi les zones desservies,
    // plutôt que d'annoncer un total sans frais de livraison.
    if (settings.deliveryEnabled && !quote.known && zones.length > 0 && !tempOrder.zoneAsked) {
        await updateSession(tenantId, remoteJid, {
            state: 'WAITING_FOR_ADDRESS',
            tempOrder: { ...tempOrder, addressDraft: address, zoneAsked: true },
        });
        await reply(ctx.sock, tenantId, remoteJid, [preface, zoneQuestion(zones)].filter(Boolean).join('\n\n'));
        return;
    }

    await updateSession(tenantId, remoteJid, {
        state: 'WAITING_FOR_CONFIRMATION',
        tempOrder: {
            ...tempOrder,
            address,
            addressDraft: undefined,
            quotedTotal: itemsTotal + quote.fee,
            quotedDeliveryKnown: quote.known,
            recapShown: true,
        },
    });
    await reply(ctx.sock, tenantId, remoteJid, [preface, confirmationRecap(productItems, quote, address)].filter(Boolean).join('\n\n'));
}

// ---------------------------------------------------------------------------
// 2. RÉCAPITULATIF ENVOYÉ, EN ATTENTE DU « OUI »
// ---------------------------------------------------------------------------

async function handleConfirmationStep(ctx: FlowContext, text: string) {
    const { tenantId, remoteJid, session } = ctx;
    const tempOrder = session.tempOrder;
    if (!hasCartItems(tempOrder) || !tempOrder.address) {
        await expireCart(ctx);
        return;
    }

    if (isConfirmIntent(text)) {
        // Un « oui » ne vaut accord que s'il répond au récapitulatif. Après une
        // autre réponse du bot (question, correction), il peut répondre à autre
        // chose : on remontre le récapitulatif au lieu de commander.
        if (tempOrder.recapShown === false) {
            await presentQuote(ctx, { ...tempOrder, zoneAsked: true }, tempOrder.address);
            return;
        }
        await placeConfirmedOrder(ctx, tempOrder);
        return;
    }

    // Nouvelle adresse à la place du « oui » : on rechiffre.
    if (looksLikeAddress(text, deliveryZones(ctx.settings).map(zone => zone.name))) {
        await presentQuote(ctx, { ...tempOrder, zoneAsked: undefined }, text.trim());
        return;
    }

    // Toute autre réponse rend le prochain « oui » ambigu.
    const pending: TempOrder = { ...tempOrder, recapShown: false };
    await updateSession(tenantId, remoteJid, { tempOrder: pending });

    if (isNegativeReply(text)) {
        await reply(ctx.sock, tenantId, remoteJid,
            "D'accord 🙂 Qu'est-ce qu'on change ? Un article, une quantité ou l'adresse de livraison ?\n(Écrivez « annuler » pour tout annuler.)");
        return;
    }

    await answerWithAI({ ...ctx, session: { ...session, tempOrder: pending } }, text, {
        allowDeals: true,
        stateNote: confirmationStateNote(pending),
    });
}

// ---------------------------------------------------------------------------
// ENREGISTREMENT DE LA COMMANDE (après « oui »)
// ---------------------------------------------------------------------------

async function placeConfirmedOrder(ctx: FlowContext, tempOrder: TempOrder) {
    const { tenantId, remoteJid, settings, products, options } = ctx;
    const address: string = tempOrder.address;
    const current = splitDeliveryItem(tempOrder.items).products;

    // 1. Le catalogue a pu changer depuis le récapitulatif (prix, planchers,
    // options, stock) : le client revoit alors un récapitulatif corrigé.
    const check = revalidateCart(products, current, settings);
    if (check.issues.length > 0) {
        const explanation = `Petite mise à jour avant de valider 🙏\n${describeCartIssues(check.issues)}`;
        if (check.items.length === 0) {
            await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
            await reply(ctx.sock, tenantId, remoteJid, `${explanation}\n\nVotre panier est maintenant vide. Dites-moi si je peux vous proposer autre chose !`);
            return;
        }
        const updated = await replaceSessionCart(tenantId, remoteJid, check.items);
        await presentQuote(ctx, { ...updated, zoneAsked: true } as TempOrder, address, explanation);
        return;
    }

    // 2. Livraison et total recalculés avec les réglages actuels : on n'enregistre
    // que le montant exact que le client vient d'accepter.
    const itemsTotal = cartTotal(current);
    const quote = computeDelivery(itemsTotal, address, settings);
    const grandTotal = itemsTotal + quote.fee;
    if (tempOrder.quotedTotal !== grandTotal || tempOrder.quotedDeliveryKnown !== quote.known) {
        await presentQuote(ctx, { ...tempOrder, zoneAsked: true }, address, 'Le montant a changé depuis le récapitulatif 🙏 Voici le détail à jour :');
        return;
    }
    const orderItems = buildOrderLines(current, quote);

    // MODE SIMULATION : même parcours, mais rien n'est écrit (ni commande, ni stock)
    if (options.dryRun) {
        await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
        await reply(ctx.sock, tenantId, remoteJid,
            `🧪 (Simulation — aucune commande réelle créée)\n\n${orderConfirmationText(current, quote, address, settings.acceptedPayments)}`);
        return;
    }

    // 3. Clé d'idempotence garantie AVANT l'écriture : c'est elle qui rend une
    // nouvelle tentative sûre si la réponse de la base se perd.
    let idempotencyKey: string | undefined = tempOrder.idempotencyKey;
    if (!idempotencyKey) {
        idempotencyKey = randomUUID();
        await updateSession(tenantId, remoteJid, { tempOrder: { ...tempOrder, idempotencyKey } });
    }

    // 4. Stock réservé et commande créée en une seule opération.
    let result: PlaceOrderResult;
    try {
        result = await db.placeOrder(tenantId, remoteJid, orderItems, grandTotal, address, idempotencyKey);
    } catch (error) {
        const notPlaced = (error as { code?: string } | null)?.code === 'ORDER_NOT_PLACED';
        logger.error({ err: error, tenantId, remoteJid, notPlaced }, '[FlowHandler] Commande non enregistrée');
        if (!notPlaced) {
            // Issue inconnue : la commande existe peut-être. Le vendeur doit pouvoir vérifier.
            await db.logActivity(tenantId, 'warning',
                `Enregistrement incertain d'une commande de ${formatFcfa(grandTotal)} (client ${remoteJid.split('@')[0]}). Vérifiez la liste des commandes.`,
                { remoteJid, idempotencyKey, total: grandTotal });
        }
        await reply(ctx.sock, tenantId, remoteJid,
            'Petit souci technique pour enregistrer la commande 🙏 Répondez *OUI* dans un instant pour réessayer : elle ne sera pas comptée deux fois.');
        return;
    }

    if (result.status === 'insufficient_stock') {
        const lines = result.failures.map(f =>
            f.available !== undefined && f.available > 0
                ? `- ${f.productName} : il ne reste que ${f.available} en stock`
                : `- ${f.productName} : épuisé`
        );
        await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
        await reply(ctx.sock, tenantId, remoteJid,
            `Ah, mauvaise nouvelle 😔 Entre-temps le stock a changé :\n${lines.join('\n')}\n\nVotre commande n'a pas été validée. Dites-moi si vous voulez ajuster les quantités !`);
        await db.logActivity(tenantId, 'warning', 'Commande refusée : stock insuffisant au moment de la validation', { remoteJid, failures: result.failures });
        return;
    }

    const { order } = result;

    // 5. Fermer le panier avant tout envoi : un échec WhatsApp ne doit pas laisser
    // une commande déjà créée dans l'état « à confirmer ». Si cette fermeture
    // échoue, le client est prévenu et le vendeur alerté.
    try {
        await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined, reminderSent: false });
    } catch (e) {
        logger.error({ err: e, tenantId, remoteJid, orderId: order.id }, '[FlowHandler] Cart close failed after order creation');
        await db.logActivity(tenantId, 'warning',
            `Commande ${String(order.id).split('-')[1] ?? order.id} enregistrée, mais le panier du client n'a pas pu être fermé. Vérifiez qu'elle n'a pas été saisie deux fois.`,
            { orderId: order.id, remoteJid }
        ).catch(() => { });
        try {
            await reply(ctx.sock, tenantId, remoteJid,
                `✅ Votre commande est bien enregistrée (total ${formatFcfa(order.total)}).\n\n⚠️ Inutile de la valider une deuxième fois : le vendeur vous recontacte pour la suite.`);
        } catch { /* la commande existe : on n'insiste pas */ }
        return;
    }

    if (result.status === 'existing') {
        logger.warn({ tenantId, remoteJid, orderId: order.id }, '[FlowHandler] Panier déjà commandé, doublon évité');
        try {
            await reply(ctx.sock, tenantId, remoteJid,
                `✅ Votre commande était déjà enregistrée (total ${formatFcfa(order.total)}). Pas d'inquiétude, elle n'a pas été comptée deux fois.`);
        } catch (error) {
            logger.error({ err: error, tenantId, orderId: order.id }, '[FlowHandler] Duplicate notice failed');
        }
        return;
    }

    // 6. Confirmation client (détail articles + livraison + total), puis vendeur
    try {
        await reply(ctx.sock, tenantId, remoteJid, orderConfirmationText(current, quote, address, settings.acceptedPayments));
    } catch (error) {
        // La vente existe : ne pas demander au client de rejouer sa validation.
        logger.error({ err: error, tenantId, orderId: order.id }, '[FlowHandler] Customer confirmation failed after order creation');
    }

    try {
        await sendOrderNotification(ctx.sock, tenantId, remoteJid, address, { items: orderItems, total: grandTotal });
    } catch (error) {
        logger.error({ err: error, tenantId, orderId: order.id }, '[FlowHandler] Merchant notification failed after order creation');
    }

    logger.info({ tenantId, remoteJid, orderId: order.id, grandTotal, deliveryKnown: quote.known, recovered: result.recovered }, '[FlowHandler] Order created');
}

// ---------------------------------------------------------------------------
// 3. EN ATTENTE D'UN CHOIX DE VARIANTE
// ---------------------------------------------------------------------------

async function handleVariationStep(ctx: FlowContext, text: string) {
    const { tenantId, remoteJid, session, options } = ctx;
    const tempOrder = session.tempOrder;
    if (!tempOrder?.productId) {
        await updateSession(tenantId, remoteJid, { state: 'IDLE' });
        return;
    }

    const product = await db.getProductById(tenantId, tempOrder.productId);
    if (!product || !product.variations || product.variations.length === 0) {
        await updateSession(tenantId, remoteJid, { state: 'IDLE' });
        return;
    }

    const currentVariation = product.variations[tempOrder.variationIndex];

    const choice = chooseVariationOption(text, currentVariation.options as any);

    // Deux options possibles : demander, jamais trancher à la place du client.
    if (choice.kind === 'ambiguous') {
        await reply(ctx.sock, tenantId, remoteJid,
            `Vous voulez dire laquelle ? ${choice.candidates.map(o => o.value).join(' ou ')} 🙂`);
        return;
    }

    const selectedOption: any = choice.kind === 'match' ? choice.option : undefined;

    if (!selectedOption) {
        // Question pendant le choix → l'IA répond puis on re-propose les options
        if (looksLikeQuestion(text)) {
            await answerWithAI(ctx, text, {
                allowDeals: false,
                stateNote: `The customer is currently choosing the "${currentVariation.name}" for ${product.name} (options: ${currentVariation.options.map(o => o.value).join(', ')}). Answer their question, then re-ask which option they want. Do NOT emit any cart tag.`,
                blockedCartReply: `Terminons d'abord le choix pour ${product.name} 🙂 Quelle option pour ${currentVariation.name} ?\n${optionsList(currentVariation)}`,
            });
            return;
        }
        await reply(ctx.sock, tenantId, remoteJid, `Je n'ai pas trouvé ce choix 😅 Veuillez choisir parmi : ${currentVariation.options.map(o => o.value).join(', ')}\n(ou écrivez "annuler")`);
        return;
    }

    // Stock de l'option choisie (si géré)
    const qty = tempOrder.quantity || 1;
    if (product.manageStock !== false && selectedOption.stock !== undefined && selectedOption.stock < qty) {
        if (selectedOption.stock <= 0) {
            await reply(ctx.sock, tenantId, remoteJid, `Désolé, ${product.name} en ${selectedOption.value} est épuisé 😔 Il reste : ${currentVariation.options.filter(o => o.stock === undefined || o.stock > 0).map(o => o.value).join(', ') || 'aucune option'}. Vous voulez une autre option ?`);
        } else {
            await reply(ctx.sock, tenantId, remoteJid, `Il ne reste que ${selectedOption.stock} en ${selectedOption.value} 📦 Je peux vous mettre ${selectedOption.stock} maximum. Dites-moi la quantité, ou choisissez une autre option.`);
        }
        return;
    }

    const newSelectedVariations = [...(tempOrder.selectedVariations || []), { name: currentVariation.name, value: selectedOption.value }];
    const priceAdjustment = selectedOption.priceModifier || 0;
    const nextIdx = tempOrder.variationIndex + 1;

    if (nextIdx < product.variations.length) {
        const nextVar = product.variations[nextIdx];

        await updateSession(tenantId, remoteJid, {
            tempOrder: {
                ...tempOrder,
                variationIndex: nextIdx,
                selectedVariations: newSelectedVariations,
                priceAdjustment: (tempOrder.priceAdjustment || 0) + priceAdjustment,
            },
        });

        await reply(ctx.sock, tenantId, remoteJid, `Ok, ${selectedOption.value} ✅ Et pour ${nextVar.name} ?\n${optionsList(nextVar)}`);
        return;
    }

    // Sélection terminée → ajout au panier au PRIX VALIDÉ (négocié) + modificateurs
    const unitPrice = (tempOrder.basePrice || product.price) + (tempOrder.priceAdjustment || 0) + priceAdjustment;

    // Des remises d'options cumulées pouvaient produire un prix négatif, accepté
    // tel quel. On ne vend pas une combinaison dont le prix n'a pas de sens.
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
        if (!options.dryRun) {
            await db.logActivity(tenantId, 'warning',
                `« ${product.name} » (${newSelectedVariations.map(v => v.value).join(', ')}) donne un prix de ${unitPrice} FCFA : corrigez les suppléments des options.`,
                { productId: product.id, unitPrice });
        }
        const preface = `Désolé, je ne peux pas vendre ${product.name} avec ces options pour le moment : son prix est à corriger par le vendeur 🙏`;
        const rest = withoutVariationProgress(tempOrder);
        if (hasCartItems(rest)) {
            await updateSession(tenantId, remoteJid, { tempOrder: rest });
            await continueAfterCartChange(ctx, preface);
        } else {
            await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
            await reply(ctx.sock, tenantId, remoteJid, preface);
        }
        return;
    }

    const cartItem: CartItem = {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        price: unitPrice,
        selectedVariations: newSelectedVariations,
    };

    const updatedOrder = await addItemToSessionCart(tenantId, remoteJid, cartItem) as TempOrder;

    // File d'attente : un autre produit à variantes attend son tour
    // (ex: "bazin bleu + robe wax", tous deux avec tailles/couleurs).
    const pendingVariations: { productId: string; quantity: number; price: number }[] = tempOrder.pendingVariations || [];
    if (pendingVariations.length > 0) {
        const [next, ...rest] = pendingVariations;
        const nextProduct = await db.getProductById(tenantId, next.productId);

        if (nextProduct && nextProduct.variations && nextProduct.variations.length > 0) {
            const nextVar = nextProduct.variations[0];

            await updateSession(tenantId, remoteJid, {
                state: 'WAITING_FOR_VARIATION',
                tempOrder: {
                    ...updatedOrder,
                    productId: nextProduct.id,
                    productName: nextProduct.name,
                    basePrice: next.price,
                    quantity: next.quantity,
                    variationIndex: 0,
                    selectedVariations: [],
                    priceAdjustment: 0,
                    pendingVariations: rest,
                },
            });

            await reply(ctx.sock, tenantId, remoteJid,
                `Ajouté ✅ (${cartSummary([cartItem])})\n\nMaintenant pour ${nextProduct.name}, quelle option pour ${nextVar.name} ?\n${optionsList(nextVar)}`);
            return;
        }
        // Produit en file introuvable/sans variantes entre-temps (supprimé ?) → on l'ignore et on continue
    }

    await updateSession(tenantId, remoteJid, { tempOrder: withoutVariationProgress(updatedOrder) });
    await continueAfterCartChange(ctx, 'Parfait ✅');
}

/**
 * Après une modification réelle du panier : adresse déjà connue → on rechiffre
 * et on remontre le récapitulatif à valider ; sinon on demande l'adresse.
 */
async function continueAfterCartChange(ctx: FlowContext, preface?: string) {
    const { tenantId, remoteJid } = ctx;
    const cart = (await getSession(tenantId, remoteJid)).tempOrder;

    if (!hasCartItems(cart)) {
        await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
        await reply(ctx.sock, tenantId, remoteJid,
            [preface, 'Votre panier est maintenant vide. Dites-moi si vous voulez autre chose !'].filter(Boolean).join('\n\n'));
        return;
    }

    if (cart.address) {
        await presentQuote(ctx, { ...cart, zoneAsked: true }, cart.address, preface);
        return;
    }

    await updateSession(tenantId, remoteJid, { state: 'WAITING_FOR_ADDRESS' });
    const productItems = splitDeliveryItem(cart.items).products;
    await reply(ctx.sock, tenantId, remoteJid, [
        preface,
        `📦 Récap :\n${cartSummary(productItems)}\nSous-total : ${formatFcfa(cartTotal(productItems))}\n\n📍 Quelle est l'adresse de livraison ? (quartier + commune)`,
    ].filter(Boolean).join('\n\n'));
}

// ---------------------------------------------------------------------------
// APPEL IA + TRAITEMENT DES TAGS
// ---------------------------------------------------------------------------

const addressStateNote = (tempOrder: TempOrder): string => `The customer has a pending cart awaiting the delivery address.
CART (use these ids in cart tags):
${cartContextForAI(tempOrder.items)}
Subtotal: ${formatFcfa(cartTotal(tempOrder.items))}.
Answer their message helpfully, then gently remind them to send their delivery address (quartier + commune) to finalize.
If they want to add, remove or change the quantity of an item, use the cart tags (ADD_TO_CART / REMOVE_FROM_CART / SET_QUANTITY) — never claim a change without the tag. Do NOT re-emit ADD_TO_CART for items already in the cart.`;

const confirmationStateNote = (tempOrder: TempOrder): string => `The customer is reviewing the final order summary and has NOT confirmed yet.
CART (use these ids in cart tags):
${cartContextForAI(tempOrder.items)}
Delivery address given: ${String(tempOrder.address).slice(0, 200)}
Answer their message. If they want to add, remove or change the quantity of an item, use the cart tags — never claim a change without the tag.
If they want another delivery address, ask them to send the full new address (quartier + commune) in one message — never say the address is changed.
Do NOT ask any yes/no question and never announce a total: the system shows the updated summary and asks them to reply OUI.`;

/**
 * Le vendeur a-t-il coupé le bot, ou repris cette conversation, pendant que
 * l'IA réfléchissait ? Relit l'état plutôt que de se fier à celui d'avant
 * l'attente. En cas d'échec de lecture, on se TAIT : mieux vaut un silence
 * qu'une réponse envoyée par-dessus le vendeur.
 */
async function botWasPausedDuringThinking(tenantId: string, remoteJid: string): Promise<boolean> {
    try {
        const [freshSettings, freshSession] = await Promise.all([
            db.getSettings(tenantId),
            getSession(tenantId, remoteJid),
        ]);
        return freshSettings.botActive === false || freshSession.autopilotEnabled === false;
    } catch (e) {
        logger.error({ err: e, tenantId, remoteJid }, '[FlowHandler] Recontrôle de la pause impossible');
        return true;
    }
}

interface AnswerOptions {
    stateNote?: string;
    allowDeals: boolean;
    /** Réponse envoyée si l'IA tente de toucher au panier alors que l'étape l'interdit. */
    blockedCartReply?: string;
}

async function answerWithAI(ctx: FlowContext, text: string, answer: AnswerOptions) {
    const { tenantId, remoteJid, session, settings, products, options } = ctx;
    const inventoryContext = buildInventoryContext(products);

    // Le message courant a déjà été ajouté à l'historique par messageHandler ;
    // on l'en retire pour ne pas l'envoyer deux fois à Gemini (une fois dans
    // l'history, une fois comme message courant).
    let historySource = session.history;
    const last = historySource[historySource.length - 1];
    if (last && last.role === 'user' && last.parts?.[0]?.text === text) {
        historySource = historySource.slice(0, -1);
    }
    const history = historySource.flatMap(h => h.parts.map(p => ({ role: h.role, parts: [{ text: p.text }] })));

    const response = await generateAIResponse(text, {
        inventoryContext,
        settings,
        history,
        stateNote: answer.stateNote,
    });

    // L'appel IA dure plusieurs secondes. Le vendeur a pu, pendant ce temps,
    // couper son bot ou reprendre la main sur cette conversation depuis l'Inbox.
    // La pause était contrôlée AVANT l'attente seulement : le bot parlait donc
    // par-dessus le vendeur, quelques secondes après qu'il ait pris le relais.
    if (!options.dryRun && await botWasPausedDuringThinking(tenantId, remoteJid)) {
        logger.info({ tenantId, remoteJid }, '[FlowHandler] Bot mis en pause pendant la réflexion — réponse abandonnée');
        return;
    }

    const { cleaned, deals, cartEdits, imageUrls, invalidDealCount } = parseAIResponse(response);

    // Étape où le panier est figé : la phrase de l'IA (« je vous l'ajoute ») ne
    // part pas, puisque rien ne sera ajouté.
    if (!answer.allowDeals && (deals.length > 0 || cartEdits.length > 0 || invalidDealCount > 0)) {
        await reply(ctx.sock, tenantId, remoteJid, answer.blockedCartReply ?? "Un instant 🙏 Terminons d'abord l'étape en cours.");
        return;
    }

    if (invalidDealCount > 0) {
        await reply(ctx.sock, tenantId, remoteJid, "Je dois vérifier les quantités et les prix avant de modifier le panier. Pouvez-vous préciser votre choix et la quantité souhaitée ?");
        return;
    }

    // --- VALIDATION : rien n'est écrit tant qu'une ligne reste à clarifier ---
    // Plafond de sécurité contre une IA qui émettrait n'importe quoi. Le
    // dépassement était jeté en silence : un client qui commandait cinq
    // articles en recevait trois, sans que personne ne le lui dise.
    const handledDeals = deals.slice(0, MAX_DEALS_PER_MESSAGE);
    const droppedDeals = deals.slice(MAX_DEALS_PER_MESSAGE);
    const validations: DealValidation[] = handledDeals.map(d => validateDeal(products, d, settings));

    const accepted = validations.filter((v): v is Extract<DealValidation, { ok: true }> => v.ok);
    const rejected = validations.filter((v): v is Exclude<DealValidation, { ok: true }> => !v.ok);

    // Rejets bloquants → message correctif (on N'ENVOIE PAS la promesse de l'IA)
    const corrections: string[] = [];
    for (const r of rejected) {
        if (r.reason === 'PRICE_TOO_LOW') {
            corrections.push(`Ah, après vérification je ne peux finalement pas faire ${formatFcfa(r.offered)} pour ${r.product.name} 🙏 Mon dernier prix c'est ${formatFcfa(r.floor)}. On valide à ce prix ?`);
            if (!options.dryRun) await db.logActivity(tenantId, 'warning', `Négociation bloquée : l'IA a promis ${r.offered} FCFA pour "${r.product.name}" (plancher ${r.floor} FCFA)`, { remoteJid, offered: r.offered, floor: r.floor });
        } else if (r.reason === 'OUT_OF_STOCK') {
            corrections.push(`Désolé, ${r.product.name} est épuisé pour le moment 😔`);
        } else if (r.reason === 'INSUFFICIENT_STOCK') {
            corrections.push(`Il ne reste que ${r.available} ${r.product.name} en stock 📦 Je vous mets les ${r.available} ? (${formatFcfa(r.available * r.product.price)})`);
        } else if (r.reason === 'UNKNOWN_PRODUCT') {
            corrections.push("Je ne peux pas identifier cet article avec certitude. Pouvez-vous préciser son nom complet ou envoyer sa photo ?");
            if (!options.dryRun) await db.logActivity(tenantId, 'warning', `L'IA a référencé un produit introuvable : "${r.ref}"`, { remoteJid });
        } else if (r.reason === 'BAD_QUANTITY') {
            corrections.push(`Quelle quantité souhaitez-vous pour ${r.product.name} ? Indiquez un nombre entier valide.`);
        }
    }

    // Ne pas ajouter une partie de la demande ni envoyer une fausse promesse
    // de confirmation quand une autre ligne doit encore être clarifiée.
    if (corrections.length > 0) {
        await reply(ctx.sock, tenantId, remoteJid, corrections.join('\n\n'));
        return;
    }

    // Retraits et quantités : appliqués au panier RÉEL, ou question au client.
    let editedItems: CartItem[] | undefined;
    if (cartEdits.length > 0) {
        const fresh = await getSession(tenantId, remoteJid);
        const outcome = applyCartEdits(fresh.tempOrder?.items || [], cartEdits, products);
        if (!outcome.ok) {
            await reply(ctx.sock, tenantId, remoteJid, outcome.message);
            return;
        }
        editedItems = outcome.items;
    }

    // --- RÉPONSE STANDARD (panier inchangé) ---
    if (deals.length === 0 && !editedItems) {
        // Sécurité images : n'envoyer QUE des URLs de l'inventaire du tenant
        const allowedImageUrls = new Set<string>(
            products.flatMap((p: any) => (Array.isArray(p.images) ? p.images : []))
        );
        const safeImages = imageUrls.filter(u => allowedImageUrls.has(u)).slice(0, 4);

        if (cleaned) {
            await reply(ctx.sock, tenantId, remoteJid, cleaned);
        }
        for (const url of safeImages) {
            try {
                await ctx.sock.sendMessage(remoteJid, { image: { url } });
            } catch (e) {
                logger.warn({ url, err: e }, '[FlowHandler] Échec envoi image produit');
            }
        }
        if (!cleaned && safeImages.length === 0) {
            // L'IA n'a rien renvoyé d'utilisable — on journalise la réponse brute
            await addToHistory(tenantId, remoteJid, 'model', response);
        }
        return;
    }

    // --- ÉCRITURES DU PANIER ---
    if (editedItems) {
        await replaceSessionCart(tenantId, remoteJid, editedItems);
    }

    // Le dépassement est annoncé, jamais avalé.
    if (droppedDeals.length > 0) {
        await reply(ctx.sock, tenantId, remoteJid,
            `J'ai noté les ${MAX_DEALS_PER_MESSAGE} premiers articles 👍 Pour le reste, envoyez-les dans un prochain message et je les ajoute au panier.`);
        if (!options.dryRun) {
            await db.logActivity(tenantId, 'warning',
                `${droppedDeals.length} article(s) demandés au-delà de la limite par message — le client a été invité à les renvoyer`,
                { remoteJid, dropped: droppedDeals.length });
        }
    }

    // Produits à variantes : la machine à état n'en traite qu'UN à la fois.
    // Les suivants sont mis en FILE (pendingVariations) pour ne jamais être
    // perdus silencieusement — ex: "je prends le bazin bleu ET la robe wax"
    // où les deux ont des tailles/couleurs à choisir.
    const withVariationsList = accepted.filter(a => a.product.variations && a.product.variations.length > 0);
    const directAdds = accepted.filter(a => !(a.product.variations && a.product.variations.length > 0));
    const [withVariations, ...queuedVariations] = withVariationsList;

    for (const a of directAdds) {
        await addItemToSessionCart(tenantId, remoteJid, a.item);
    }

    if (withVariations) {
        const product = withVariations.product;
        const firstVar = product.variations![0];
        const cart = (await getSession(tenantId, remoteJid)).tempOrder;

        await updateSession(tenantId, remoteJid, {
            state: 'WAITING_FOR_VARIATION',
            tempOrder: {
                ...(cart || {}),
                items: cart?.items || [],
                total: cart?.total || 0,
                summary: cart?.summary || '',
                productId: product.id,
                productName: product.name,
                basePrice: withVariations.item.price, // prix négocié VALIDÉ comme base
                quantity: withVariations.item.quantity,
                variationIndex: 0,
                selectedVariations: [],
                priceAdjustment: 0,
                pendingVariations: queuedVariations.map(q => ({
                    productId: q.product.id,
                    quantity: q.item.quantity,
                    price: q.item.price,
                })),
            },
        });

        const parts = [cleaned].filter(Boolean);
        const extra = queuedVariations.length > 0 ? ` (${product.name} d'abord, on verra ${queuedVariations.map(q => q.product.name).join(' et ')} juste après)` : '';
        parts.push(`Pour ${product.name}${extra}, quelle option pour ${firstVar.name} ?\n${optionsList(firstVar)}`);
        await reply(ctx.sock, tenantId, remoteJid, parts.join('\n\n'));
        return;
    }

    await continueAfterCartChange(ctx, cleaned || undefined);
}
