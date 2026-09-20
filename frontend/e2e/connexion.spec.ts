import { test, expect, ouvrirSession, UTILISATEUR, MOT_DE_PASSE } from './fixtures/faux-serveur';

test.describe('Connexion', () => {
    test('le tableau de bord est fermé à qui n’est pas connecté', async ({ page, api }) => {
        await page.goto('/dashboard');

        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole('heading', { name: 'On reprend ?' })).toBeVisible();
        // Rien ne doit avoir été demandé au serveur au nom d'un visiteur.
        expect(api.appelsVers('GET /auth/me')).toHaveLength(0);
    });

    test('un mauvais mot de passe est annoncé, sans ouvrir de session', async ({ page, api }) => {
        await page.goto('/login');

        await page.getByLabel('Email ou Téléphone').fill(UTILISATEUR.email);
        await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
        await page.getByRole('button', { name: 'Ouvrir ma boutique' }).click();

        await expect(page.getByRole('alert')).toHaveText(/Identifiants invalides/);
        await expect(page).toHaveURL(/\/login$/);
        expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
        expect(api.appelsVers('POST /auth/login')).toHaveLength(1);
    });

    test('le bon mot de passe ouvre la boutique et normalise l’identifiant', async ({ page, api }) => {
        await page.goto('/login');

        // Saisie telle qu'elle arrive d'un téléphone : majuscules et espaces.
        await page.getByLabel('Email ou Téléphone').fill(`  ${UTILISATEUR.email.toUpperCase()} `);
        await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
        await page.getByRole('button', { name: 'Ouvrir ma boutique' }).click();

        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole('heading', { level: 1 })).toContainText(/Bonjour|Bonsoir/);
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Awa');

        const envoi = api.dernierAppel('POST /auth/login')?.corps as { identifier: string; rememberMe: boolean };
        expect(envoi.identifier).toBe(UTILISATEUR.email);
        expect(envoi.rememberMe).toBe(true);
        expect(await page.evaluate(() => localStorage.getItem('token'))).not.toBeNull();
    });

    test('un numéro à dix chiffres part au format international', async ({ page, api }) => {
        await page.goto('/login');

        await page.getByLabel('Email ou Téléphone').fill('0709483812');
        await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
        await page.getByRole('button', { name: 'Ouvrir ma boutique' }).click();

        await expect(page.getByRole('alert')).toBeVisible();
        expect((api.dernierAppel('POST /auth/login')?.corps as { identifier: string }).identifier)
            .toBe('+2250709483812');
    });

    test('un jeton expiré renvoie à la connexion et efface la session', async ({ page, api }) => {
        await ouvrirSession(page);
        api.force('GET /auth/me', 401, { error: 'Token invalide' });

        await page.goto('/dashboard');

        await expect(page).toHaveURL(/\/login$/);
        expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
        expect(await page.evaluate(() => localStorage.getItem('user'))).toBeNull();
    });

    test('se déconnecter ferme la session', async ({ page }, infos) => {
        test.skip(infos.project.name === 'telephone', 'Le bouton vit dans la barre latérale, masquée sur téléphone.');
        await ouvrirSession(page);

        await page.goto('/dashboard');
        await page.getByRole('button', { name: 'Se déconnecter' }).click();

        await expect(page).toHaveURL(/\/login$/);
        expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    });
});
