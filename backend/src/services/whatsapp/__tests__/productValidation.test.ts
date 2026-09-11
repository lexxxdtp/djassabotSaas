import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProductInput } from '../../productValidation';

test('produit : NaN et Infinity refusés comme montants', () => {
    // typeof NaN === 'number' et NaN < 0 est faux : l'ancienne validation les laissait passer,
    // et un seul produit à NaN contaminait ensuite tous les totaux.
    assert.match(String(validateProductInput({ price: NaN })), /Prix invalide/);
    assert.match(String(validateProductInput({ price: Infinity })), /Prix invalide/);
    assert.match(String(validateProductInput({ stock: NaN })), /Stock invalide/);
    assert.equal(validateProductInput({ price: 1500, stock: 3 }), null);
});

test('produit : plancher de négociation cohérent avec le prix affiché', () => {
    assert.match(String(validateProductInput({ price: 1000, minPrice: 1500 })), /ne peut pas dépasser/);
    assert.match(String(validateProductInput({ minPrice: -1 })), /Prix minimum invalide/);
    assert.equal(validateProductInput({ price: 1000, minPrice: 800 }), null);
    assert.equal(validateProductInput({ price: 1000, minPrice: 1000 }), null);
});

test('produit : stock entier, jamais fractionnaire ni négatif', () => {
    assert.match(String(validateProductInput({ stock: 1.5 })), /Stock invalide/);
    assert.match(String(validateProductInput({ stock: -2 })), /Stock invalide/);
    assert.equal(validateProductInput({ stock: 0 }), null);
});

test('produit : nom exigé à la création, facultatif en mise à jour partielle', () => {
    assert.match(String(validateProductInput({}, { requireName: true })), /Nom du produit requis/);
    assert.match(String(validateProductInput({ name: '   ' }, { requireName: true })), /Nom du produit requis/);
    assert.equal(validateProductInput({ price: 500 }), null);
});

test('produit : variantes et options vérifiées', () => {
    assert.match(String(validateProductInput({ variations: 'rouge' })), /Variantes invalides/);
    assert.match(String(validateProductInput({ variations: [{ name: 'Taille', options: [] }] })), /au moins une option/);
    assert.match(String(validateProductInput({ variations: [{ name: 'Taille', options: [{ value: 'M', stock: -1 }] }] })), /Stock invalide pour l'option "M"/);
    assert.match(String(validateProductInput({ variations: [{ name: 'Taille', options: [{ value: 'M', priceModifier: NaN }] }] })), /Supplément invalide/);
    // Un supplément négatif est une remise légitime.
    assert.equal(validateProductInput({ variations: [{ name: 'Taille', options: [{ value: 'M', stock: 2, priceModifier: -500 }] }] }), null);
});
