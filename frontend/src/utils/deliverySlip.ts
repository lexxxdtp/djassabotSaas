// Fiche livreur — fonction PURE (aucun DOM, réseau ni horloge) pour être testable.
//
// Ce que le livreur doit savoir tient en une fiche : qui, où, quoi, et surtout
// combien il doit encaisser. L'ancien résumé donnait l'identifiant WhatsApp brut
// (« 2250777...@s.whatsapp.net »), mélangeait la livraison aux articles et ne
// disait jamais si la commande était déjà payée — le livreur ne pouvait pas
// savoir s'il devait réclamer de l'argent, ni combien.
//
// Ce qui n'y figure JAMAIS : prix minimum, marge, conversation avec le client.
// La fiche part à un tiers ; elle ne contient que ce dont il a besoin.

const DELIVERY_ITEM_ID = '_delivery';

export interface SlipVariation {
    value: string;
}

export interface SlipItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    selectedVariations?: SlipVariation[];
}

export interface SlipOrder {
    id: string;
    userId: string;
    total: number;
    status: string;
    address?: string;
    items: SlipItem[];
    customerName?: string;
}

export interface SlipContext {
    /** Téléphone du vendeur, pour que le livreur puisse le joindre. */
    merchantPhone?: string;
    /** La commande est-elle déjà encaissée ? Sinon le livreur collecte. */
    alreadyPaid: boolean;
}

const fcfa = (amount: number): string => `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;

/**
 * Numéro lisible à partir d'un identifiant WhatsApp.
 * « 2250777225277@s.whatsapp.net » → « +2250777225277 ».
 * Un identifiant @lid n'est PAS un téléphone : on ne fabrique rien.
 */
export function readablePhone(userId: string): string | null {
    if (!userId || userId.includes('@lid')) return null;
    const digits = userId.split('@')[0].replace(/[^0-9]/g, '');
    return digits.length >= 8 ? `+${digits}` : null;
}

export function buildDeliverySlip(order: SlipOrder, context: SlipContext): string {
    const products = order.items.filter(i => i.productId !== DELIVERY_ITEM_ID);
    const deliveryLine = order.items.find(i => i.productId === DELIVERY_ITEM_ID);

    const itemsTotal = products.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const deliveryFee = deliveryLine ? deliveryLine.price * deliveryLine.quantity : 0;

    const lines: string[] = [];
    const reference = order.id.split('-')[1] || order.id;
    lines.push(`📦 COMMANDE ${reference}`);
    lines.push('');

    const phone = readablePhone(order.userId);
    const who = [order.customerName?.trim(), phone].filter(Boolean).join(' · ');
    lines.push(`👤 Client : ${who || 'contact à récupérer auprès du vendeur'}`);
    lines.push(`📍 Livraison : ${order.address?.trim() || 'ADRESSE MANQUANTE — appelez le vendeur'}`);
    lines.push('');

    lines.push('🛒 À livrer :');
    for (const item of products) {
        const variations = item.selectedVariations?.length
            ? ` (${item.selectedVariations.map(v => v.value).join(', ')})`
            : '';
        lines.push(`  • ${item.quantity}x ${item.productName}${variations}`);
    }
    lines.push('');

    lines.push(`Articles : ${fcfa(itemsTotal)}`);
    // Frais nuls explicites : « rien d'écrit » se lit comme « à réclamer ».
    const deliveryLabel = deliveryLine
        ? (deliveryFee > 0 ? fcfa(deliveryFee) : deliveryLine.productName.replace(/^Livraison\s*/i, '').trim() || fcfa(0))
        : 'À CONFIRMER';
    lines.push(`Livraison : ${deliveryLabel}`);
    lines.push(`${deliveryLine ? 'Total' : 'Sous-total provisoire'} : ${fcfa(order.total)}`);
    lines.push('');

    if (!deliveryLine && context.alreadyPaid) {
        lines.push('✅ ARTICLES DÉJÀ PAYÉS');
        lines.push('⛔ FRAIS DE LIVRAISON : À CONFIRMER AVEC LE VENDEUR');
    } else if (!deliveryLine) {
        lines.push('⛔ MONTANT À ENCAISSER : À CONFIRMER AVEC LE VENDEUR');
    } else if (context.alreadyPaid) {
        lines.push(`✅ DÉJÀ PAYÉ — ne rien encaisser`);
    } else {
        lines.push(`💵 À ENCAISSER : ${fcfa(order.total)}`);
    }

    if (context.merchantPhone) {
        lines.push('');
        lines.push(`📞 Vendeur : ${context.merchantPhone}`);
    }

    // Ce qui manque est dit, pas deviné : le livreur part prévenu.
    const missing: string[] = [];
    if (!order.address?.trim()) missing.push('adresse');
    if (!phone && !order.customerName?.trim()) missing.push('contact client');
    if (!deliveryLine) missing.push('zone de livraison non confirmée');
    if (missing.length > 0) {
        lines.push('');
        lines.push(`⚠️ À compléter : ${missing.join(', ')}`);
    }

    return lines.join('\n');
}
