import { test, expect, ouvrirSession, uneCommande, reglagesParDefaut } from './fixtures/faux-serveur';

test.beforeEach(async ({ page }) => {
    await ouvrirSession(page);
});

test.describe('Assistant WhatsApp', () => {
    test('WhatsApp déconnecté : l’accueil propose de connecter le numéro', async ({ page, api }) => {
        api.whatsapp = { connected: false, status: 'disconnected' };

        await page.goto('/dashboard');

        await expect(page.getByRole('link', { name: /Connecter WhatsApp/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Activer les réponses' })).toHaveCount(0);
        await expect(page.getByText('WhatsApp déconnecté')).toBeVisible();
    });

    test('activer les réponses enregistre le réglage et le dit', async ({ page, api }) => {
        api.whatsapp = { connected: true, status: 'connected' };
        api.reglages = { ...reglagesParDefaut(), botActive: false };

        await page.goto('/dashboard');
        await expect(page.getByText('Bot en pause')).toBeVisible();

        await page.getByRole('button', { name: 'Activer les réponses' }).click();

        await expect(page.getByText('Bot actif')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Mettre le bot en pause' })).toBeVisible();
        expect(api.dernierAppel('POST /settings')?.corps).toEqual({ botActive: true });
        expect(api.reglages.botActive).toBe(true);
    });

    test('le montant du jour ne s’invente pas quand les commandes sont indisponibles', async ({ page, api }) => {
        api.force('GET /orders', 500, { error: 'Base indisponible' });

        await page.goto('/dashboard');

        await expect(page.getByText('Commandes indisponibles. Nouvelle tentative automatique.')).toBeVisible();
        await expect(page.locator('.home-revenue-amount')).toContainText('—');
    });

    test('les commandes du jour sont résumées sur l’accueil', async ({ page, api }) => {
        api.commandes = [uneCommande(), uneCommande({ id: 'ORD-9-zz', total: 6000, status: 'PAID' })];

        await page.goto('/dashboard');

        await expect(page.locator('.home-revenue-amount')).toContainText(/20\s?000/);
        await expect(page.getByText('2 commandes', { exact: false })).toBeVisible();
    });
});

test.describe('Jumelage du numéro', () => {
    test('le code de jumelage s’affiche pour le numéro saisi', async ({ page, api }) => {
        api.whatsapp = { connected: false, status: 'disconnected' };

        await page.goto('/dashboard/whatsapp');
        await page.getByRole('button', { name: 'Code à taper' }).click();
        await page.getByLabel('Numéro de téléphone').fill('0709483812');
        await page.getByRole('button', { name: 'Recevoir le Code' }).click();

        // Le code est éclaté en une case par caractère : on lit le bloc entier.
        const bloc = page.getByText('Code de Jumelage').locator('xpath=..');
        await expect(bloc).toContainText('DJAS2026');
        // L'indicatif pays est ajouté côté client : le backend reçoit un numéro complet.
        expect(api.dernierAppel('POST /whatsapp/pair-code')?.corps).toEqual({ phoneNumber: '2250709483812' });
    });

    test('un numéro trop court n’atteint jamais le serveur', async ({ page, api }) => {
        api.whatsapp = { connected: false, status: 'disconnected' };

        await page.goto('/dashboard/whatsapp');
        await page.getByRole('button', { name: 'Code à taper' }).click();
        await page.getByLabel('Numéro de téléphone').fill('070948');

        await expect(page.getByRole('button', { name: 'Recevoir le Code' })).toBeDisabled();
        expect(api.appelsVers('POST /whatsapp/pair-code')).toHaveLength(0);
    });

    test('un numéro déjà connecté ne redemande pas de code', async ({ page, api }) => {
        api.whatsapp = { connected: true, status: 'connected' };

        await page.goto('/dashboard/whatsapp');

        await expect(page.getByRole('heading', { name: 'Votre WhatsApp est connecté' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Code à taper' })).toHaveCount(0);
    });
});

test.describe('Réglages', () => {
    test('enregistrer la boutique renvoie les réglages complets', async ({ page, api }) => {
        await page.goto('/dashboard/settings');
        await page.getByRole('button', { name: /Mon assistant/ }).click();

        const tiroir = page.getByRole('dialog', { name: 'Mon assistant' });
        await expect(tiroir).toHaveAttribute('aria-modal', 'true');
        await tiroir.getByRole('button', { name: 'Enregistrer' }).click();

        await expect(page.getByText('Paramètres sauvegardés !')).toBeVisible();
        const envoi = api.dernierAppel('POST /settings')?.corps as Record<string, unknown>;
        // Un enregistrement partiel écraserait le reste de la configuration.
        expect(envoi).toMatchObject({ botName: 'Awa', storeName: 'Boutique de recette' });
        expect(envoi.deliveryZones).toHaveLength(2);
    });

    test('des réglages illisibles ne sont jamais réécrits par-dessus', async ({ page, api }) => {
        api.force('GET /settings', 500, { error: 'Base indisponible' });

        await page.goto('/dashboard/settings');
        await page.getByRole('button', { name: /Mon assistant/ }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();

        await expect(page.getByText(/rechargez la page avant d.enregistrer/)).toBeVisible();
        expect(api.appelsVers('POST /settings')).toHaveLength(0);
    });
});
