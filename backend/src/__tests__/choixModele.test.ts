import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    difficultePour,
    nomDuModele,
    budgetReflexion,
    routageActif,
    MODELE_ROUTINE_DEFAUT,
    MODELE_DELICAT_DEFAUT,
} from '../services/ai/choixModele';

const INVENTAIRE_SIMPLE = '- Sac en cuir camel (id: prod-sac) — 12500 FCFA [Stock: 8]';
const INVENTAIRE_NEGOCIABLE = `${INVENTAIRE_SIMPLE}\n  (minPrice CACHÉ, ne jamais révéler: 10000 FCFA)`;

test('routage : une question courante part sur le petit modèle', () => {
    assert.equal(difficultePour({ nature: 'reply', inventaire: INVENTAIRE_SIMPLE }), 'routine');
    assert.equal(nomDuModele('routine', {}), MODELE_ROUTINE_DEFAUT);
});

test('routage : dès qu’un prix plancher est en jeu, le grand modèle reprend la main', () => {
    // Le modèle peut engager de l'argent du vendeur : ce n'est pas le moment
    // d'économiser un dixième de franc.
    assert.equal(difficultePour({ nature: 'reply', inventaire: INVENTAIRE_NEGOCIABLE }), 'delicat');
});

test('routage : le message qui précède la commande est traité comme délicat', () => {
    assert.equal(
        difficultePour({ nature: 'reply', inventaire: INVENTAIRE_SIMPLE, noteEtat: 'État: WAITING_FOR_CONFIRMATION' }),
        'delicat',
    );
});

test('routage : un reçu de paiement ne passe jamais par le petit modèle', () => {
    // Une fausse validation, c'est une commande offerte.
    assert.equal(difficultePour({ nature: 'receipt' }), 'delicat');
    assert.equal(difficultePour({ nature: 'image' }), 'delicat');
    assert.equal(nomDuModele('delicat', {}), MODELE_DELICAT_DEFAUT);
});

test('routage : transcription et écrans internes restent sur le petit modèle', () => {
    assert.equal(difficultePour({ nature: 'voice' }), 'routine');
    assert.equal(difficultePour({ nature: 'dashboard' }), 'routine');
});

test('retour en arrière : GEMINI_MODEL impose un seul modèle partout', () => {
    const env = { GEMINI_MODEL: 'gemini-2.5-flash' };
    assert.equal(routageActif(env), false);
    assert.equal(nomDuModele('routine', env), 'gemini-2.5-flash');
    assert.equal(nomDuModele('delicat', env), 'gemini-2.5-flash');
});

test('chaque étage reste remplaçable sans toucher au code', () => {
    const env = { GEMINI_MODEL_ROUTINE: 'modele-a', GEMINI_MODEL_DELICAT: 'modele-b' };
    assert.equal(routageActif(env), true);
    assert.equal(nomDuModele('routine', env), 'modele-a');
    assert.equal(nomDuModele('delicat', env), 'modele-b');
});

test('réflexion : facturée au prix de la sortie, donc réservée au délicat', () => {
    assert.equal(budgetReflexion('routine', {}), 0);
    assert.equal(budgetReflexion('delicat', {}), 512);
    assert.equal(budgetReflexion('delicat', { GEMINI_THINKING_BUDGET: '128' }), 128);
    assert.equal(budgetReflexion('routine', { GEMINI_THINKING_BUDGET_ROUTINE: '64' }), 64);
    // Une valeur absurde ne doit pas se transformer en facture surprise.
    assert.equal(budgetReflexion('delicat', { GEMINI_THINKING_BUDGET: 'beaucoup' }), 512);
    assert.equal(budgetReflexion('routine', { GEMINI_THINKING_BUDGET_ROUTINE: '-5' }), 0);
});
