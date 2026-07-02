import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseAIResponse,
    validateDeal,
    findProduct,
    priceFloor,
    matchDeliveryZone,
    computeDelivery,
    isCancelIntent,
    looksLikeQuestion,
    looksLikeAddress,
    splitDeliveryItem,
    buildDeliveryItem,
    DELIVERY_ITEM_ID,
} from '../salesEngine';
import { Product, Settings } from '../../../types';

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

const PRODUCTS: Product[] = [
    { id: 'p1', name: 'Bazin Riche Bleu', price: 15000, minPrice: 13000, stock: 10, images: [], description: 'Bazin' },
    { id: 'p2', name: 'Mèche Humaine 22', price: 45000, stock: 2, images: [], description: 'Mèches' },
    { id: 'p3', name: 'Attiéké Poisson', price: 3000, stock: 0, images: [], description: 'Plat' },
    { id: 'p4', name: 'Gâteau sur commande', price: 20000, stock: 0, manageStock: false, images: [], description: 'Pâtisserie' },
    { id: 'p5', name: 'Robe Wax', price: 10000, stock: 5, images: [], description: 'Sans minPrice' },
];

const SETTINGS: Settings = {
    botName: 'Awa', language: 'fr', persona: 'friendly', greeting: '',
    politeness: 'informal', emojiLevel: 'medium', responseLength: 'medium',
    trainingExamples: [], negotiationEnabled: true, negotiationFlexibility: 5,
    negotiationMargin: 10, voiceEnabled: true, systemInstructions: '',
    storeName: 'Test Shop', address: 'Abidjan', phone: '',
    deliveryEnabled: true,
    deliveryZones: [{ name: 'Cocody', price: 1500 }, { name: 'Yopougon', price: 2000 }, { name: 'Intérieur', price: 5000 }],
    freeDeliveryThreshold: 50000,
    acceptedPayments: ['wave', 'om'],
};

// ---------------------------------------------------------------------------
// PARSING DES TAGS
// ---------------------------------------------------------------------------

describe('parseAIResponse', () => {
    test('extrait un tag ADD_TO_CART et nettoie le texte', () => {
        const r = parseAIResponse('Super choix ! [ADD_TO_CART: p1 | 2 | 14000]');
        assert.equal(r.cleaned, 'Super choix !');
        assert.equal(r.deals.length, 1);
        assert.deepEqual(r.deals[0], { productRef: 'p1', quantity: 2, unitPrice: 14000 });
    });

    test('tolère les espaces et séparateurs de milliers ("15 000", "15.000")', () => {
        const r = parseAIResponse('Ok ! [ADD_TO_CART: p1 | 1 | 15 000] et [ADD_TO_CART: p2|2|45.000]');
        assert.equal(r.deals.length, 2);
        assert.equal(r.deals[0].unitPrice, 15000);
        assert.equal(r.deals[1].unitPrice, 45000);
    });

    test('tolère le format "13k"', () => {
        const r = parseAIResponse('[ADD_TO_CART: p1 | 1 | 13k]');
        assert.equal(r.deals[0].unitPrice, 13000);
    });

    test('extrait les tags IMAGE séparément', () => {
        const r = parseAIResponse('Voici ! [IMAGE: https://x.com/a.jpg] [ADD_TO_CART: p1 | 1 | 15000]');
        assert.deepEqual(r.imageUrls, ['https://x.com/a.jpg']);
        assert.equal(r.deals.length, 1);
        assert.equal(r.cleaned, 'Voici !');
    });

    test('réponse sans tag → aucun deal, texte intact', () => {
        const r = parseAIResponse('Bonjour, comment puis-je vous aider ?');
        assert.equal(r.deals.length, 0);
        assert.equal(r.cleaned, 'Bonjour, comment puis-je vous aider ?');
    });
});

// ---------------------------------------------------------------------------
// RECHERCHE PRODUIT
// ---------------------------------------------------------------------------

describe('findProduct', () => {
    test('trouve par id exact', () => {
        assert.equal(findProduct(PRODUCTS, 'p2')?.name, 'Mèche Humaine 22');
    });

    test('fuzzy : "bazin bleu" matche "Bazin Riche Bleu"', () => {
        assert.equal(findProduct(PRODUCTS, 'bazin bleu')?.id, 'p1');
    });

    test('fuzzy : accents et pluriels ("meches humaines")', () => {
        assert.equal(findProduct(PRODUCTS, 'meches humaines')?.id, 'p2');
    });

    test('introuvable → undefined', () => {
        assert.equal(findProduct(PRODUCTS, 'climatiseur'), undefined);
    });
});

// ---------------------------------------------------------------------------
// VALIDATION DES DEALS — le garde-fou anti-hallucination
// ---------------------------------------------------------------------------

describe('validateDeal (négociation)', () => {
    test('prix négocié valide (>= minPrice) → accepté au prix négocié', () => {
        const v = validateDeal(PRODUCTS, { productRef: 'p1', quantity: 1, unitPrice: 13500 }, SETTINGS);
        assert.ok(v.ok);
        if (v.ok) assert.equal(v.item.price, 13500);
    });

    test('prix sous le minPrice → REFUSÉ avec le plancher (jailbreak bloqué)', () => {
        const v = validateDeal(PRODUCTS, { productRef: 'p1', quantity: 1, unitPrice: 11000 }, SETTINGS);
        assert.ok(!v.ok);
        if (!v.ok && v.reason === 'PRICE_TOO_LOW') {
            assert.equal(v.floor, 13000);
            assert.equal(v.offered, 11000);
        } else assert.fail('attendu PRICE_TOO_LOW');
    });

    test('prix au-dessus du prix public → clampé au prix public (pas de surfacturation)', () => {
        const v = validateDeal(PRODUCTS, { productRef: 'p1', quantity: 1, unitPrice: 99000 }, SETTINGS);
        assert.ok(v.ok);
        if (v.ok) assert.equal(v.item.price, 15000);
    });

    test('sans minPrice → plancher = marge globale (10% de 10000 = 9000)', () => {
        assert.equal(priceFloor(PRODUCTS[4], SETTINGS), 9000);
        const ok = validateDeal(PRODUCTS, { productRef: 'p5', quantity: 1, unitPrice: 9000 }, SETTINGS);
        assert.ok(ok.ok);
        const ko = validateDeal(PRODUCTS, { productRef: 'p5', quantity: 1, unitPrice: 8999 }, SETTINGS);
        assert.ok(!ko.ok);
    });

    test('négociation désactivée → seul le prix public passe', () => {
        const noNego = { ...SETTINGS, negotiationEnabled: false };
        const ko = validateDeal(PRODUCTS, { productRef: 'p1', quantity: 1, unitPrice: 14000 }, noNego);
        assert.ok(!ko.ok && ko.reason === 'PRICE_TOO_LOW');
        const ok = validateDeal(PRODUCTS, { productRef: 'p1', quantity: 1, unitPrice: 15000 }, noNego);
        assert.ok(ok.ok);
    });
});

describe('validateDeal (stock & quantités)', () => {
    test('stock insuffisant → INSUFFICIENT_STOCK avec le disponible', () => {
        const v = validateDeal(PRODUCTS, { productRef: 'p2', quantity: 5, unitPrice: 45000 }, SETTINGS);
        assert.ok(!v.ok);
        if (!v.ok && v.reason === 'INSUFFICIENT_STOCK') assert.equal(v.available, 2);
        else assert.fail('attendu INSUFFICIENT_STOCK');
    });

    test('rupture de stock → OUT_OF_STOCK', () => {
        const v = validateDeal(PRODUCTS, { productRef: 'p3', quantity: 1, unitPrice: 3000 }, SETTINGS);
        assert.ok(!v.ok && v.reason === 'OUT_OF_STOCK');
    });

    test('stock non géré (sur commande) → quantité libre', () => {
        const v = validateDeal(PRODUCTS, { productRef: 'p4', quantity: 30, unitPrice: 20000 }, SETTINGS);
        assert.ok(v.ok);
    });

    test('quantité aberrante (hallucination) → BAD_QUANTITY', () => {
        const v = validateDeal(PRODUCTS, { productRef: 'p4', quantity: 100000, unitPrice: 20000 }, SETTINGS);
        assert.ok(!v.ok && v.reason === 'BAD_QUANTITY');
    });

    test('produit inconnu → UNKNOWN_PRODUCT', () => {
        const v = validateDeal(PRODUCTS, { productRef: 'xyz-inexistant', quantity: 1, unitPrice: 1000 }, SETTINGS);
        assert.ok(!v.ok && v.reason === 'UNKNOWN_PRODUCT');
    });
});

// ---------------------------------------------------------------------------
// LIVRAISON
// ---------------------------------------------------------------------------

describe('livraison', () => {
    test('"Cocody Angré, près de la pharmacie" → zone Cocody (1500 F)', () => {
        const q = computeDelivery(15000, 'Cocody Angré, près de la pharmacie', SETTINGS);
        assert.ok(q.known);
        assert.equal(q.fee, 1500);
    });

    test('zone avec accents/casse ("YOPOUGON bel air")', () => {
        const z = matchDeliveryZone('YOPOUGON bel air', SETTINGS.deliveryZones);
        assert.equal(z?.name, 'Yopougon');
    });

    test('seuil de livraison offerte atteint → 0 F', () => {
        const q = computeDelivery(60000, 'Cocody', SETTINGS);
        assert.ok(q.known);
        assert.equal(q.fee, 0);
        assert.match(q.label, /offerte/i);
    });

    test('zone inconnue → frais à confirmer (known=false, jamais un total inventé)', () => {
        const q = computeDelivery(15000, 'Bingerville carrefour', SETTINGS);
        assert.equal(q.known, false);
        assert.equal(q.fee, 0);
    });

    test('livraison désactivée → 0, connu', () => {
        const q = computeDelivery(15000, 'Cocody', { ...SETTINGS, deliveryEnabled: false });
        assert.ok(q.known);
        assert.equal(q.fee, 0);
    });

    test('la ligne livraison est identifiable et séparable', () => {
        const item = buildDeliveryItem({ known: true, fee: 1500, label: 'Livraison (Cocody)' });
        assert.equal(item.productId, DELIVERY_ITEM_ID);
        const { products, delivery } = splitDeliveryItem([
            { productId: 'p1', productName: 'Bazin', quantity: 1, price: 15000 },
            item,
        ]);
        assert.equal(products.length, 1);
        assert.equal(delivery?.price, 1500);
    });
});

// ---------------------------------------------------------------------------
// INTENTIONS (échappatoires d'état)
// ---------------------------------------------------------------------------

describe('intentions client', () => {
    test('annulations reconnues', () => {
        assert.ok(isCancelIntent('annule'));
        assert.ok(isCancelIntent('Laisse tomber'));
        assert.ok(isCancelIntent('je ne veux plus'));
    });

    test('une adresse n\'est pas une annulation', () => {
        assert.ok(!isCancelIntent('Cocody Angré près de la pharmacie des Oscars'));
    });

    test('questions reconnues (le piège "attends c\'est combien ?" ne devient plus une adresse)', () => {
        assert.ok(looksLikeQuestion('attends c\'est combien déjà ?'));
        assert.ok(looksLikeQuestion('Combien pour 2'));
        assert.ok(looksLikeQuestion('vous avez ça en rouge ?'));
        assert.ok(!looksLikeAddress('attends c\'est combien déjà ?'));
    });

    test('vraie adresse acceptée', () => {
        assert.ok(looksLikeAddress('Yopougon Bel Air, près du feu tricolore'));
        assert.ok(looksLikeAddress('Marcory Zone 4, rue du canal'));
    });

    test('messages trop courts ou sans lettres refusés comme adresse', () => {
        assert.ok(!looksLikeAddress('ok'));
        assert.ok(!looksLikeAddress('👍'));
    });
});
