import { test, expect, ouvrirSession } from './fixtures/faux-serveur';

const JID = '2250700000001@s.whatsapp.net';
const chemin = (suffixe: string) => `/chats/${encodeURIComponent(JID)}/${suffixe}`;

// Le bouton d'autopilote s'abrège sur les petits écrans (« IA Active » → « IA »),
// et le filtre de la liste s'appelle « IA active » : on vise le nom entier.
const BOUTON_IA = /^IA( Active)?$/;

test.beforeEach(async ({ page }) => {
    await ouvrirSession(page);
});

test.describe('Conversations', () => {
    test('ouvrir une discussion montre l’échange avec le client', async ({ page }) => {
        await page.goto('/dashboard/inbox');

        await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible();
        await page.getByRole('button', { name: /Aminata/ }).click();

        await expect(page.getByText('Le sac camel est encore dispo ?').last()).toBeVisible();
        await expect(page.getByText('Oui, il reste 8 pièces.')).toBeVisible();
    });

    test('reprendre la main coupe les réponses automatiques de cette discussion', async ({ page, api }) => {
        await page.goto('/dashboard/inbox');
        await page.getByRole('button', { name: /Aminata/ }).click();

        await page.getByRole('button', { name: BOUTON_IA }).click();

        await expect(page.getByPlaceholder('Écrivez votre message…')).toBeVisible();
        expect(api.dernierAppel(`POST ${chemin('toggle-autopilot')}`)?.corps).toEqual({ enabled: false });
    });

    test('tant que l’IA répond, le champ manuel annonce pourquoi il est inerte', async ({ page }) => {
        await page.goto('/dashboard/inbox');
        await page.getByRole('button', { name: /Aminata/ }).click();

        await expect(page.getByPlaceholder("Désactivez l'IA pour écrire manuellement…")).toBeVisible();
    });

    test('un message refusé par le serveur n’est pas perdu', async ({ page, api }) => {
        api.force(`POST ${chemin('send')}`, 500, { error: 'WhatsApp indisponible' });

        await page.goto('/dashboard/inbox');
        await page.getByRole('button', { name: /Aminata/ }).click();
        await page.getByRole('button', { name: BOUTON_IA }).click();

        const champ = page.getByPlaceholder('Écrivez votre message…');
        await champ.fill('Bonjour, votre commande part ce soir.');
        await page.getByRole('button', { name: 'Envoyer le message' }).click();

        await expect(page.getByText(/Message non envoyé/)).toBeVisible();
        await expect(champ).toHaveValue('Bonjour, votre commande part ce soir.');
    });

    test('un message accepté part et s’affiche', async ({ page, api }) => {
        await page.goto('/dashboard/inbox');
        await page.getByRole('button', { name: /Aminata/ }).click();
        await page.getByRole('button', { name: BOUTON_IA }).click();

        const champ = page.getByPlaceholder('Écrivez votre message…');
        await champ.fill('Votre commande part ce soir.');
        await page.getByRole('button', { name: 'Envoyer le message' }).click();

        await expect(champ).toHaveValue('');
        await expect(page.getByText('Votre commande part ce soir.')).toBeVisible();
        expect(api.dernierAppel(`POST ${chemin('send')}`)?.corps).toEqual({ text: 'Votre commande part ce soir.' });
    });
});
