import { defineConfig, devices } from '@playwright/test';

/**
 * Recette navigateur des parcours vendeurs.
 *
 * `npm run test:e2e` lance le serveur de développement puis joue les parcours
 * dans Chromium, en version bureau ET en version téléphone — le vendeur ciblé
 * travaille sur son iPhone, un parcours qui ne marche qu'en 1280 px ne vaut
 * rien. L'API est simulée (e2e/fixtures/faux-serveur.ts) : la recette ne touche
 * ni la production, ni Supabase, ni WhatsApp.
 */
export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    expect: { timeout: 7_000 },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
    use: {
        baseURL: 'http://localhost:5173',
        locale: 'fr-FR',
        timezoneId: 'Africa/Abidjan',
        reducedMotion: 'reduce',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'bureau',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
            testIgnore: /telephone\.spec\.ts/,
        },
        {
            name: 'telephone',
            use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium' },
        },
    ],
    webServer: {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
