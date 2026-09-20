import { test, expect, ouvrirSession, unProduit, uneCommande } from './fixtures/faux-serveur';

/**
 * Le vendeur ciblé travaille sur son téléphone, souvent un écran de 320 px.
 * Ces vérifications ne valent que dans ce format : elles sont ignorées en
 * version bureau.
 */
test.describe('Sur téléphone', () => {
    test.beforeEach(async ({ page }) => {
        await ouvrirSession(page);
    });

    test('la barre du bas mène aux cinq écrans du quotidien', async ({ page }) => {
        await page.goto('/dashboard');
        const barre = page.getByRole('navigation', { name: 'Navigation mobile' });
        await expect(barre).toBeVisible();

        const etapes = [
            { lien: 'Messages', url: /\/dashboard\/inbox$/, titre: 'Conversations' },
            { lien: 'Commandes', url: /\/dashboard\/orders$/, titre: 'Vos commandes' },
            { lien: 'Produits', url: /\/dashboard\/products$/, titre: 'Votre catalogue' },
            { lien: 'Réglages', url: /\/dashboard\/settings$/, titre: 'Les réglages de la boutique' },
        ];

        for (const etape of etapes) {
            await barre.getByRole('link', { name: etape.lien }).click();
            await expect(page).toHaveURL(etape.url);
            await expect(page.getByRole('heading', { name: etape.titre })).toBeVisible();
        }

        await barre.getByRole('link', { name: 'Accueil' }).click();
        await expect(page).toHaveURL(/\/dashboard$/);
    });

    test('aucun écran ne déborde sur la largeur, même à 320 px', async ({ page, api }) => {
        api.produits = [unProduit()];
        api.commandes = [uneCommande()];
        await page.setViewportSize({ width: 320, height: 720 });

        const ecrans = [
            '/dashboard',
            '/dashboard/orders',
            '/dashboard/products',
            '/dashboard/products/prod-sac',
            '/dashboard/inbox',
            '/dashboard/settings',
            '/dashboard/whatsapp',
        ];

        for (const ecran of ecrans) {
            await page.goto(ecran);
            await page.getByRole('heading', { level: 1 }).first().waitFor();
            const mesure = await page.evaluate(() => ({
                page: document.documentElement.scrollWidth,
                fenetre: window.innerWidth,
                coupables: [...document.querySelectorAll('body *')]
                    .filter(element => {
                        const boite = element.getBoundingClientRect();
                        const style = getComputedStyle(element);
                        if (boite.width === 0 || boite.right <= window.innerWidth + 2) return false;
                        if (style.position === 'fixed') return false;
                        // Une bande volontairement défilable (le sélecteur de
                        // filtres, par exemple) a le droit d'être plus large
                        // que l'écran : ce qu'elle contient ne compte pas.
                        for (let noeud: Element | null = element; noeud && noeud !== document.body; noeud = noeud.parentElement) {
                            const debordement = getComputedStyle(noeud).overflowX;
                            if (debordement === 'auto' || debordement === 'scroll' || debordement === 'hidden') return false;
                        }
                        return true;
                    })
                    .slice(0, 3)
                    .map(element => `${element.tagName}.${String(element.className).slice(0, 40)}`),
            }));
            expect(mesure.coupables, `débordement sur ${ecran}`).toEqual([]);
            expect(mesure.page, `défilement horizontal sur ${ecran}`).toBeLessThanOrEqual(mesure.fenetre + 1);
        }
    });

    // Le balayage des pages ne suffisait pas : les réglages n'affichent leur
    // contenu qu'une fois le tiroir ouvert, et c'est là que les zones de
    // livraison débordaient de l'écran sans que personne ne le voie.
    for (const tiroir of ['Livraison et paiements', 'Sa façon de répondre', 'Ma boutique et ses horaires', 'Mon assistant']) {
        test(`le tiroir « ${tiroir} » tient dans un écran de 320 px`, async ({ page }) => {
            await page.setViewportSize({ width: 320, height: 720 });
            await page.goto('/dashboard/settings');
            await page.getByRole('button', { name: new RegExp(tiroir) }).first().click();

            const fenetre = page.getByRole('dialog');
            await expect(fenetre).toBeVisible();
            // On ne regarde pas le bord droit : le tiroir défile verticalement,
            // ce qui rend son débordement horizontal invisible à un test de
            // position. On cherche donc le contenu plus large que sa boîte,
            // c'est-à-dire ce qui force un défilement latéral.
            const coupables = await page.evaluate(() => {
                const dialogue = document.querySelector('[role=dialog]');
                if (!dialogue) return ['aucun tiroir'];
                // Un champ de saisie a toujours un contenu plus large que sa
                // boîte dès que le texte dépasse : ce n'est pas un défaut de mise
                // en page, c'est le défilement normal d'un champ.
                const champs = ['INPUT', 'TEXTAREA', 'SELECT'];
                return [dialogue, ...dialogue.querySelectorAll('*')]
                    .filter(element => !champs.includes(element.tagName)
                        && element.clientWidth > 0
                        && element.scrollWidth > element.clientWidth + 1)
                    .slice(0, 3)
                    .map(element => `${element.tagName}.${String(element.className).slice(0, 45)} (${element.scrollWidth} > ${element.clientWidth})`);
            });
            expect(coupables, `débordement dans « ${tiroir} »`).toEqual([]);
        });
    }

    test('le tiroir d’une commande tient dans l’écran et se referme', async ({ page, api }) => {
        api.commandes = [uneCommande()];
        await page.setViewportSize({ width: 320, height: 720 });

        await page.goto('/dashboard/orders');
        await page.getByRole('button', { name: /a1b2c3/ }).click();

        const tiroir = page.getByRole('dialog');
        const boite = await tiroir.boundingBox();
        expect(boite!.x).toBeGreaterThanOrEqual(-1);
        expect(boite!.width).toBeLessThanOrEqual(321);

        await page.getByRole('button', { name: 'Fermer le tiroir' }).click();
        await expect(tiroir).toHaveCount(0);
    });
});
