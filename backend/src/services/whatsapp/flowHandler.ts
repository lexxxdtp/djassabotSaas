import { WASocket } from '@whiskeysockets/baileys';
import { db } from '../dbService';
import { getSession, updateSession, addToHistory, addItemToSessionCart, Session } from '../sessionService';
import { generateAIResponse } from '../aiService';
import { sendOrderNotification } from './notificationService';
import {
    buildInventoryContext,
    parseAIResponse,
    validateDeal,
    computeDelivery,
    buildDeliveryItem,
    cartSummary,
    formatFcfa,
    isCancelIntent,
    looksLikeQuestion,
    looksLikeAddress,
    splitDeliveryItem,
    DealValidation,
} from './salesEngine';
import { Product, Settings, CartItem } from '../../types';
import { logger } from '../../utils/logger';

/**
 * flowHandler — orchestre la conversation de vente.
 *
 * Principe : L'IA PROPOSE, LE SERVEUR DISPOSE.
 * L'IA négocie et conclut en langage naturel, mais chaque ajout au panier
 * passe par validateDeal (prix plancher, stock, quantité). Chaque commande
 * décrémente le stock atomiquement et intègre les frais de livraison.
 */

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

    // --- STATE MACHINE ---

    // 1. EN ATTENTE DE L'ADRESSE DE LIVRAISON
    if (session.state === 'WAITING_FOR_ADDRESS') {
        const tempOrder = session.tempOrder;

        if (!tempOrder || !Array.isArray(tempOrder.items) || tempOrder.items.length === 0) {
            await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
            await reply(sock, tenantId, remoteJid, 'Votre panier a expiré. Pas de souci, on peut recommencer quand vous voulez !');
            return;
        }

        // Le client pose une question au lieu de donner l'adresse → l'IA répond,
        // puis on re-demande l'adresse. On ne crée JAMAIS une commande avec une
        // question en guise d'adresse.
        if (!looksLikeAddress(text)) {
            await answerWithAI(tenantId, remoteJid, text, sock, session, settings, products, {
                stateNote: `The customer has a pending cart awaiting delivery address. Cart: ${tempOrder.summary || cartSummary(tempOrder.items)} (subtotal ${formatFcfa(tempOrder.total)}). Answer their message helpfully, then gently remind them to send their delivery address (quartier + commune) to finalize. Do NOT emit any ADD_TO_CART tag for items already in the cart.`,
                allowDeals: false,
            });
            return;
        }

        await finalizeOrder(tenantId, remoteJid, text.trim(), sock, session, settings, options);
        return;
    }

    // 2. EN ATTENTE D'UN CHOIX DE VARIANTE
    if (session.state === 'WAITING_FOR_VARIATION') {
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
        const userInput = text.trim().toLowerCase();

        const selectedOption = currentVariation.options.find((o: any) => o.value.toLowerCase().includes(userInput)) ||
            currentVariation.options[parseInt(userInput) - 1];

        if (!selectedOption) {
            // Question pendant le choix → l'IA répond puis on re-propose les options
            if (looksLikeQuestion(text)) {
                await answerWithAI(tenantId, remoteJid, text, sock, session, settings, products, {
                    stateNote: `The customer is currently choosing the "${currentVariation.name}" for ${product.name} (options: ${currentVariation.options.map((o: any) => o.value).join(', ')}). Answer their question, then re-ask which option they want. Do NOT emit any ADD_TO_CART tag.`,
                    allowDeals: false,
                });
                return;
            }
            await reply(sock, tenantId, remoteJid, `Je n'ai pas trouvé ce choix 😅 Veuillez choisir parmi : ${currentVariation.options.map((o: any) => o.value).join(', ')}\n(ou écrivez "annuler")`);
            return;
        }

        // Stock de l'option choisie (si géré)
        const qty = tempOrder.quantity || 1;
        if (product.manageStock !== false && selectedOption.stock !== undefined && selectedOption.stock < qty) {
            if (selectedOption.stock <= 0) {
                await reply(sock, tenantId, remoteJid, `Désolé, ${product.name} en ${selectedOption.value} est épuisé 😔 Il reste : ${currentVariation.options.filter((o: any) => o.stock === undefined || o.stock > 0).map((o: any) => o.value).join(', ') || 'aucune option'}. Vous voulez une autre option ?`);
            } else {
                await reply(sock, tenantId, remoteJid, `Il ne reste que ${selectedOption.stock} en ${selectedOption.value} 📦 Je peux vous mettre ${selectedOption.stock} maximum. Dites-moi la quantité, ou choisissez une autre option.`);
            }
            return;
        }

        const newSelectedVariations = [...(tempOrder.selectedVariations || []), { name: currentVariation.name, value: selectedOption.value }];
        const priceAdjustment = selectedOption.priceModifier || 0;
        const nextIdx = tempOrder.variationIndex + 1;

        if (nextIdx < product.variations.length) {
            const nextVar = product.variations[nextIdx];
            const optionsList = nextVar.options.map((o: any, i: number) => `${i + 1}. ${o.value}`).join('\n');

            await updateSession(tenantId, remoteJid, {
                tempOrder: {
                    ...tempOrder,
                    variationIndex: nextIdx,
                    selectedVariations: newSelectedVariations,
                    priceAdjustment: (tempOrder.priceAdjustment || 0) + priceAdjustment,
                },
            });

            await reply(sock, tenantId, remoteJid, `Ok, ${selectedOption.value} ✅ Et pour ${nextVar.name} ?\n${optionsList}`);
            return;
        }

        // Sélection terminée → ajout au panier au PRIX VALIDÉ (négocié) + modificateurs
        const unitPrice = (tempOrder.basePrice || product.price) + (tempOrder.priceAdjustment || 0) + priceAdjustment;
        const cartItem: CartItem = {
            productId: product.id,
            productName: product.name,
            quantity: qty,
            price: unitPrice,
            selectedVariations: newSelectedVariations,
        };

        const updatedOrder = await addItemToSessionCart(tenantId, remoteJid, cartItem);

        // File d'attente : un autre produit à variantes attend son tour
        // (ex: "bazin bleu + robe wax", tous deux avec tailles/couleurs).
        const pendingVariations: { productId: string; quantity: number; price: number }[] = tempOrder.pendingVariations || [];
        if (pendingVariations.length > 0) {
            const [next, ...rest] = pendingVariations;
            const nextProduct = await db.getProductById(tenantId, next.productId);

            if (nextProduct && nextProduct.variations && nextProduct.variations.length > 0) {
                const nextVar = nextProduct.variations[0];
                const optionsList = nextVar.options.map((o: any, i: number) => `${i + 1}. ${o.value}`).join('\n');

                await updateSession(tenantId, remoteJid, {
                    state: 'WAITING_FOR_VARIATION',
                    tempOrder: {
                        items: updatedOrder.items,
                        total: updatedOrder.total,
                        summary: updatedOrder.summary,
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

                await reply(sock, tenantId, remoteJid,
                    `Ajouté ✅ (${cartSummary([cartItem])})\n\nMaintenant pour ${nextProduct.name}, quelle option pour ${nextVar.name} ?\n${optionsList}`);
                return;
            }
            // Produit en file introuvable/sans variantes entre-temps (supprimé ?) → on l'ignore et on continue
        }

        await updateSession(tenantId, remoteJid, { state: 'WAITING_FOR_ADDRESS' });

        await reply(sock, tenantId, remoteJid,
            `Parfait ✅\n\n📦 Récap :\n${cartSummary(updatedOrder.items)}\nSous-total : ${formatFcfa(updatedOrder.total)}\n\n📍 Quelle est l'adresse de livraison ? (quartier + commune)`);
        return;
    }

    // 3. FLUX STANDARD (IDLE) — un seul appel IA, tags validés par le serveur
    await answerWithAI(tenantId, remoteJid, text, sock, session, settings, products, { allowDeals: true });
}

// ---------------------------------------------------------------------------
// APPEL IA + TRAITEMENT DES TAGS
// ---------------------------------------------------------------------------

interface AnswerOptions {
    stateNote?: string;
    allowDeals: boolean;
}

async function answerWithAI(
    tenantId: string,
    remoteJid: string,
    text: string,
    sock: WASocket,
    session: Session,
    settings: Settings,
    products: Product[],
    options: AnswerOptions,
) {
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
        stateNote: options.stateNote,
    });

    const { cleaned, deals, imageUrls } = parseAIResponse(response);

    // Sécurité images : n'envoyer QUE des URLs de l'inventaire du tenant
    const allowedImageUrls = new Set<string>(
        products.flatMap((p: any) => (Array.isArray(p.images) ? p.images : []))
    );
    const safeImages = imageUrls.filter(u => allowedImageUrls.has(u)).slice(0, 4);

    // --- TRAITEMENT DES DEALS (uniquement en flux IDLE) ---
    if (options.allowDeals && deals.length > 0) {
        const validations: DealValidation[] = deals.slice(0, 3).map(d => validateDeal(products, d, settings));

        const accepted = validations.filter((v): v is Extract<DealValidation, { ok: true }> => v.ok);
        const rejected = validations.filter((v): v is Exclude<DealValidation, { ok: true }> => !v.ok);

        // Rejets bloquants → message correctif (on N'ENVOIE PAS la promesse de l'IA)
        const corrections: string[] = [];
        for (const r of rejected) {
            if (r.reason === 'PRICE_TOO_LOW') {
                corrections.push(`Ah, après vérification je ne peux finalement pas faire ${formatFcfa(r.offered)} pour ${r.product.name} 🙏 Mon dernier prix c'est ${formatFcfa(r.floor)}. On valide à ce prix ?`);
                await db.logActivity(tenantId, 'warning', `Négociation bloquée : l'IA a promis ${r.offered} FCFA pour "${r.product.name}" (plancher ${r.floor} FCFA)`, { remoteJid, offered: r.offered, floor: r.floor });
            } else if (r.reason === 'OUT_OF_STOCK') {
                corrections.push(`Désolé, ${r.product.name} est épuisé pour le moment 😔`);
            } else if (r.reason === 'INSUFFICIENT_STOCK') {
                corrections.push(`Il ne reste que ${r.available} ${r.product.name} en stock 📦 Je vous mets les ${r.available} ? (${formatFcfa(r.available * r.product.price)})`);
            } else if (r.reason === 'UNKNOWN_PRODUCT') {
                await db.logActivity(tenantId, 'warning', `L'IA a référencé un produit introuvable : "${r.ref}"`, { remoteJid });
            }
            // BAD_QUANTITY / UNKNOWN_PRODUCT : on ignore le tag, le texte IA part tel quel
        }

        // Produits à variantes : la machine à état n'en traite qu'UN à la fois.
        // Les suivants sont mis en FILE (pendingVariations) pour ne jamais être
        // perdus silencieusement — ex: "je prends le bazin bleu ET la robe wax"
        // où les deux ont des tailles/couleurs à choisir.
        const withVariationsList = accepted.filter(a => a.product.variations && a.product.variations.length > 0);
        const directAdds = accepted.filter(a => !(a.product.variations && a.product.variations.length > 0));
        const [withVariations, ...queuedVariations] = withVariationsList;

        let updatedOrder: { items: CartItem[]; total: number; summary?: string } | undefined;
        for (const a of directAdds) {
            updatedOrder = await addItemToSessionCart(tenantId, remoteJid, a.item);
        }

        if (withVariations) {
            const product = withVariations.product;
            const firstVar = product.variations![0];
            const optionsList = firstVar.options.map((o: any, i: number) => `${i + 1}. ${o.value}`).join('\n');

            await updateSession(tenantId, remoteJid, {
                state: 'WAITING_FOR_VARIATION',
                tempOrder: {
                    ...(session.tempOrder || {}),
                    items: updatedOrder?.items || session.tempOrder?.items || [],
                    total: updatedOrder?.total || session.tempOrder?.total || 0,
                    summary: updatedOrder?.summary || session.tempOrder?.summary || '',
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

            const parts = [cleaned, ...corrections].filter(Boolean);
            const extra = queuedVariations.length > 0 ? ` (${product.name} d'abord, on verra ${queuedVariations.map(q => q.product.name).join(' et ')} juste après)` : '';
            parts.push(`Pour ${product.name}${extra}, quelle option pour ${firstVar.name} ?\n${optionsList}`);
            await reply(sock, tenantId, remoteJid, parts.join('\n\n'));
            return;
        }

        if (updatedOrder) {
            await updateSession(tenantId, remoteJid, { state: 'WAITING_FOR_ADDRESS' });
            const parts = [cleaned, ...corrections].filter(Boolean);
            parts.push(`📦 Récap :\n${cartSummary(updatedOrder.items)}\nSous-total : ${formatFcfa(updatedOrder.total)}\n\n📍 Quelle est l'adresse de livraison ? (quartier + commune)`);
            await reply(sock, tenantId, remoteJid, parts.join('\n\n'));
            return;
        }

        // Aucun deal accepté → uniquement les corrections (l'IA avait promis à tort)
        if (corrections.length > 0) {
            await reply(sock, tenantId, remoteJid, corrections.join('\n\n'));
            return;
        }
        // Sinon (tags tous invalides/inconnus) : on retombe sur la réponse nettoyée
    }

    // --- RÉPONSE STANDARD ---
    if (cleaned) {
        await reply(sock, tenantId, remoteJid, cleaned);
    }
    for (const url of safeImages) {
        try {
            await sock.sendMessage(remoteJid, { image: { url } });
        } catch (e) {
            logger.warn({ url, err: e }, '[FlowHandler] Échec envoi image produit');
        }
    }
    if (!cleaned && safeImages.length === 0) {
        // L'IA n'a rien renvoyé d'utilisable — on journalise la réponse brute
        await addToHistory(tenantId, remoteJid, 'model', response);
    }
}

// ---------------------------------------------------------------------------
// FINALISATION DE COMMANDE (adresse reçue)
// ---------------------------------------------------------------------------

async function finalizeOrder(
    tenantId: string,
    remoteJid: string,
    address: string,
    sock: WASocket,
    session: Session,
    settings: Settings,
    options: FlowOptions = {},
) {
    const tempOrder = session.tempOrder!;
    const { products: productItems } = splitDeliveryItem(tempOrder.items);
    const itemsTotal = productItems.reduce((s, i) => s + i.price * i.quantity, 0);

    // 1. Livraison calculée à partir de l'adresse (zones du vendeur)
    const quote = computeDelivery(itemsTotal, address, settings);
    const orderItems: CartItem[] = quote.fee > 0 ? [...productItems, buildDeliveryItem(quote)] : [...productItems];
    const grandTotal = itemsTotal + quote.fee;

    // MODE SIMULATION : même confirmation, mais rien n'est écrit (ni commande, ni stock)
    if (options.dryRun) {
        const simDeliveryLine = quote.known
            ? (quote.fee > 0 ? `${quote.label} : ${formatFcfa(quote.fee)}` : `${quote.label} ✅`)
            : 'Livraison : à confirmer selon votre zone';
        await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
        await reply(sock, tenantId, remoteJid,
            `🧪 (Simulation — aucune commande réelle créée)\n\n✅ *Commande confirmée !*\n\n${cartSummary(productItems)}\nArticles : ${formatFcfa(itemsTotal)}\n${simDeliveryLine}\n*Total : ${formatFcfa(grandTotal)}*\n\n📍 Livraison à : ${address}`);
        return;
    }

    // 2. Décrément ATOMIQUE du stock — si le stock a bougé entre-temps, on refuse proprement
    const stockResult = await db.decrementStockForItems(tenantId, productItems);
    if (!stockResult.ok) {
        const lines = stockResult.failures.map(f =>
            f.available !== undefined && f.available > 0
                ? `- ${f.productName} : il ne reste que ${f.available} en stock`
                : `- ${f.productName} : épuisé`
        );
        await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
        await reply(sock, tenantId, remoteJid,
            `Ah, mauvaise nouvelle 😔 Entre-temps le stock a changé :\n${lines.join('\n')}\n\nVotre commande n'a pas été validée. Dites-moi si vous voulez ajuster les quantités !`);
        await db.logActivity(tenantId, 'warning', 'Commande refusée : stock insuffisant au moment de la validation', { remoteJid, failures: stockResult.failures });
        return;
    }

    // 3. Création de la commande (livraison incluse dans le total et visible en ligne d'article)
    let order;
    try {
        order = await db.createOrder(tenantId, remoteJid, orderItems, grandTotal, address);
    } catch (e) {
        // La commande a échoué APRÈS le décrément → on rend le stock
        await db.restockItems(tenantId, productItems);
        logger.error({ err: e, tenantId, remoteJid }, '[FlowHandler] createOrder failed, stock restored');
        await reply(sock, tenantId, remoteJid, 'Petit souci technique pour enregistrer la commande 🙏 Réessayez en renvoyant votre adresse.');
        return;
    }

    // 4. Confirmation claire au client (détail articles + livraison + total)
    const deliveryLine = quote.known
        ? (quote.fee > 0 ? `${quote.label} : ${formatFcfa(quote.fee)}` : `${quote.label} ✅`)
        : 'Livraison : à confirmer selon votre zone (le vendeur vous précise ça rapidement)';

    const paymentsArray = Array.isArray(settings.acceptedPayments) ? settings.acceptedPayments : [];
    const hasMobileMoney = paymentsArray.some(p => ['wave', 'om', 'mtn'].includes(p));
    const paymentHint = hasMobileMoney
        ? '\n\n💡 Après paiement (Wave/Orange Money…), envoyez la capture du reçu ici — je valide automatiquement.'
        : '';

    await reply(sock, tenantId, remoteJid,
        `✅ *Commande confirmée !*\n\n${cartSummary(productItems)}\nArticles : ${formatFcfa(itemsTotal)}\n${deliveryLine}\n*Total : ${formatFcfa(grandTotal)}*\n\n📍 Livraison à : ${address}${paymentHint}`);

    // 5. Notification vendeur
    await sendOrderNotification(sock, tenantId, remoteJid, address, { items: orderItems, total: grandTotal });

    // 6. Nettoyage — on garde l'HISTORIQUE (le bot doit se souvenir de la commande)
    await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined, reminderSent: false });

    logger.info({ tenantId, remoteJid, orderId: order.id, grandTotal, deliveryKnown: quote.known }, '[FlowHandler] Order created');
}
