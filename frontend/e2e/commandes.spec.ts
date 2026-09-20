import { test, expect, ouvrirSession, uneCommande } from './fixtures/faux-serveur';

const NOUVELLE = uneCommande();
const PAYEE = uneCommande({
    id: 'ORD-481517-b2c3d4',
    status: 'PAID',
    total: 9000,
    userId: '2250700000002@s.whatsapp.net',
    address: 'Yopougon Niangon',
});
const LIVREE = uneCommande({ id: 'ORD-481518-c3d4e5', status: 'DELIVERED', total: 5000 });

test.beforeEach(async ({ page }) => {
    await ouvrirSession(page);
});

test.describe('Commandes', () => {
    test('la liste montre le client, le montant et l’état de chaque commande', async ({ page, api }) => {
        api.commandes = [NOUVELLE, PAYEE, LIVREE];

        await page.goto('/dashboard/orders');

        const carte = page.getByRole('button', { name: /a1b2c3/ });
        await expect(carte).toContainText('Nouvelle');
        await expect(carte).toContainText('2250700000001');
        await expect(carte).toContainText(/14\s?000\s?F/);
        // L'identifiant WhatsApp brut ne doit jamais s'afficher dans la liste :
        // il débordait des cartes sur les petits écrans.
        await expect(carte).not.toContainText('@s.whatsapp.net');
        await expect(page.getByRole('button', { name: /Tout/ })).toContainText('3');
    });

    test('le filtre de l’URL n’affiche que les commandes concernées', async ({ page, api }) => {
        api.commandes = [NOUVELLE, PAYEE, LIVREE];

        await page.goto('/dashboard/orders?filter=new');

        await expect(page.getByRole('button', { name: /a1b2c3/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /b2c3d4/ })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /c3d4e5/ })).toHaveCount(0);
    });

    test('la recherche retrouve une commande par son adresse', async ({ page, api }) => {
        api.commandes = [NOUVELLE, PAYEE];

        await page.goto('/dashboard/orders');
        await page.getByPlaceholder('Rechercher par ID, client ou adresse…').fill('Yopougon');

        await expect(page.getByRole('button', { name: /b2c3d4/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /a1b2c3/ })).toHaveCount(0);
    });

    test('« Marquer payée » envoie PAID et met la commande à jour', async ({ page, api }) => {
        api.commandes = [uneCommande()];

        await page.goto('/dashboard/orders');
        await page.getByRole('button', { name: /a1b2c3/ }).click();

        const tiroir = page.getByRole('dialog', { name: 'Commande a1b2c3' });
        await expect(tiroir).toHaveAttribute('aria-modal', 'true');
        await expect(tiroir).toContainText('Cocody Angré, 7e tranche');
        await tiroir.getByRole('button', { name: 'Marquer payée' }).click();

        await expect(tiroir).toContainText('Payée');
        await expect(tiroir.getByRole('button', { name: 'Marquer livrée' })).toBeVisible();

        const appel = api.dernierAppel('PUT /orders/ORD-481516-a1b2c3/status');
        expect(appel?.corps).toEqual({ status: 'PAID' });
        expect(api.commandes[0].status).toBe('PAID');
    });

    test('une commande payée passe à livrée', async ({ page, api }) => {
        api.commandes = [PAYEE];

        await page.goto('/dashboard/orders');
        await page.getByRole('button', { name: /b2c3d4/ }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Marquer livrée' }).click();

        await expect(page.getByRole('dialog')).toContainText('Commande clôturée');
        expect(api.dernierAppel('PUT /orders/ORD-481517-b2c3d4/status')?.corps).toEqual({ status: 'DELIVERED' });
    });

    test('annuler une commande envoie CANCELLED', async ({ page, api }) => {
        api.commandes = [uneCommande()];

        await page.goto('/dashboard/orders');
        await page.getByRole('button', { name: /a1b2c3/ }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();

        await expect(page.getByRole('dialog')).toContainText('Annulée');
        expect(api.dernierAppel('PUT /orders/ORD-481516-a1b2c3/status')?.corps).toEqual({ status: 'CANCELLED' });
    });

    test('si le serveur refuse, la commande reprend son état et le vendeur est prévenu', async ({ page, api }) => {
        api.commandes = [uneCommande()];
        api.force('PUT /orders/ORD-481516-a1b2c3/status', 500, { error: 'Base de données indisponible' });

        await page.goto('/dashboard/orders');
        await page.getByRole('button', { name: /a1b2c3/ }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Marquer payée' }).click();

        await expect(page.getByText('Base de données indisponible')).toBeVisible();
        await page.keyboard.press('Escape');
        // L'affichage optimiste doit être repris : la commande reste « Nouvelle ».
        await expect(page.getByRole('button', { name: /a1b2c3/ })).toContainText('Nouvelle');
        expect(api.commandes[0].status).toBe('PENDING');
    });

    test('la fiche livreur contient le nécessaire, et rien de confidentiel', async ({ page, api, context }, infos) => {
        test.skip(infos.project.name === 'telephone', 'Le partage natif remplace le presse-papiers sur téléphone.');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        api.commandes = [uneCommande()];

        await page.goto('/dashboard/orders');
        await page.getByRole('button', { name: /a1b2c3/ }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Fiche livreur' }).click();

        await expect(page.getByText(/Fiche copiée/)).toBeVisible();
        const fiche = await page.evaluate(() => navigator.clipboard.readText());
        expect(fiche).toContain('Sac en cuir camel');
        expect(fiche).toContain('Cocody Angré, 7e tranche');
        expect(fiche).toContain('+2250700000001');
        expect(fiche).toContain('À ENCAISSER');
        // Le livreur est un tiers : ni conversation, ni identifiant technique.
        expect(fiche).not.toContain('@s.whatsapp.net');
    });

    test('le tiroir se ferme avec la touche Échap', async ({ page, api }) => {
        api.commandes = [uneCommande()];

        await page.goto('/dashboard/orders');
        await page.getByRole('button', { name: /a1b2c3/ }).click();
        await expect(page.getByRole('dialog')).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('sans commande, l’écran le dit au lieu de rester vide', async ({ page, api }) => {
        api.commandes = [];

        await page.goto('/dashboard/orders');

        await expect(page.getByRole('heading', { name: 'Vos commandes' })).toBeVisible();
        await expect(page.getByText(/Aucune commande/)).toBeVisible();
    });
});
