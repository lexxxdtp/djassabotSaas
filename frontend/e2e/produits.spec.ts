import { test, expect, ouvrirSession, unProduit } from './fixtures/faux-serveur';

test.beforeEach(async ({ page }) => {
    await ouvrirSession(page);
});

const ouvrirFormulaire = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: 'Ajouter un produit' }).first().click();

test.describe('Catalogue', () => {
    test('le catalogue affiche les produits de la boutique', async ({ page, api }) => {
        api.produits = [unProduit(), unProduit({ id: 'prod-pagne', name: 'Pagne wax 6 yards', price: 9000, stock: 3 })];

        await page.goto('/dashboard/products');

        await expect(page.getByRole('heading', { name: 'Votre catalogue' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Sac en cuir camel', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Pagne wax 6 yards', exact: true })).toBeVisible();
        await expect(page.getByText('2 produits dans votre boutique.')).toBeVisible();
    });

    test('une boutique vide explique quoi faire', async ({ page, api }) => {
        api.produits = [];

        await page.goto('/dashboard/products');

        await expect(page.getByRole('heading', { name: 'Votre boutique est vide' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ajouter un produit' }).first()).toBeVisible();
    });

    test('ajouter un produit envoie des nombres, pas du texte', async ({ page, api }) => {
        api.produits = [];

        await page.goto('/dashboard/products');
        await ouvrirFormulaire(page);

        const formulaire = page.getByRole('dialog', { name: 'Nouveau produit' });
        await expect(formulaire).toHaveAttribute('aria-modal', 'true');
        await formulaire.getByPlaceholder('Ex : Robe wax fleurie').fill('Escarpins vernis');
        await formulaire.getByPlaceholder('5000').fill('18500');
        await formulaire.getByPlaceholder('10', { exact: true }).fill('4');
        await formulaire.getByRole('button', { name: 'Ajouter le produit' }).click();

        await expect(page.getByText('Produit créé !')).toBeVisible();
        const envoi = api.dernierAppel('POST /products')?.corps as Record<string, unknown>;
        expect(envoi).toMatchObject({ name: 'Escarpins vernis', price: 18500, stock: 4 });
        expect(typeof envoi.price).toBe('number');
        expect(typeof envoi.stock).toBe('number');
        // Le catalogue se recharge : le produit apparaît sans rechargement manuel.
        await expect(page.getByRole('link', { name: 'Escarpins vernis', exact: true })).toBeVisible();
    });

    test('la limite du forfait est expliquée au lieu d’échouer en silence', async ({ page, api }) => {
        api.force('POST /products', 403, {
            error: 'Limite de 50 produits atteinte sur le forfait Starter.',
            code: 'PLAN_LIMIT_REACHED',
        });

        await page.goto('/dashboard/products');
        await ouvrirFormulaire(page);

        const formulaire = page.getByRole('dialog', { name: 'Nouveau produit' });
        await formulaire.getByPlaceholder('Ex : Robe wax fleurie').fill('Produit de trop');
        await formulaire.getByPlaceholder('5000').fill('3000');
        await formulaire.getByPlaceholder('10', { exact: true }).fill('1');
        await formulaire.getByRole('button', { name: 'Ajouter le produit' }).click();

        await expect(page.getByText('Limite de 50 produits atteinte sur le forfait Starter.')).toBeVisible();
        // Le formulaire reste ouvert : la saisie du vendeur n'est pas perdue.
        await expect(formulaire).toBeVisible();
        await expect(formulaire.getByPlaceholder('Ex : Robe wax fleurie')).toHaveValue('Produit de trop');
    });

    test('le formulaire se ferme avec la touche Échap', async ({ page }) => {
        await page.goto('/dashboard/products');
        await ouvrirFormulaire(page);
        await expect(page.getByRole('dialog', { name: 'Nouveau produit' })).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(page.getByRole('dialog', { name: 'Nouveau produit' })).toHaveCount(0);
    });

    test('la recherche filtre le catalogue', async ({ page, api }) => {
        api.produits = [unProduit(), unProduit({ id: 'prod-pagne', name: 'Pagne wax 6 yards' })];

        await page.goto('/dashboard/products');
        await page.getByPlaceholder('Rechercher un produit…').fill('pagne');

        await expect(page.getByRole('link', { name: 'Pagne wax 6 yards', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Sac en cuir camel', exact: true })).toHaveCount(0);
    });

    test('le stock se corrige depuis la carte du produit', async ({ page, api }) => {
        api.produits = [unProduit({ stock: 8 })];

        await page.goto('/dashboard/products');
        await page.getByRole('button', { name: 'Ajouter une unité de Sac en cuir camel' }).click();

        await expect.poll(() => api.produits[0].stock).toBe(9);
        expect(api.dernierAppel('PUT /products/prod-sac')?.corps).toEqual({ stock: 9 });
    });

    test('supprimer un produit demande confirmation', async ({ page, api }) => {
        api.produits = [unProduit()];

        await page.goto('/dashboard/products');
        await page.getByRole('button', { name: 'Supprimer Sac en cuir camel' }).click();

        const confirmation = page.getByRole('dialog', { name: 'Confirmer la suppression du produit' });
        await expect(confirmation).toContainText('Cette action est irréversible');
        // Renoncer ne supprime rien.
        await confirmation.getByRole('button', { name: 'Annuler' }).click();
        expect(api.appelsVers('DELETE /products/prod-sac')).toHaveLength(0);

        await page.getByRole('button', { name: 'Supprimer Sac en cuir camel' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();

        await expect(page.getByRole('heading', { name: 'Votre boutique est vide' })).toBeVisible();
        expect(api.appelsVers('DELETE /products/prod-sac')).toHaveLength(1);
    });

    test('la fiche produit porte son titre', async ({ page, api }) => {
        api.produits = [unProduit()];

        await page.goto('/dashboard/products/prod-sac');

        // Régression du 20 septembre : la fiche s'ouvrait sans aucun titre.
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sac en cuir camel');
    });
});
