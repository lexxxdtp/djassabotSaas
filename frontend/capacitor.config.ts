import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.djassabot.app',
    appName: 'DjassaBot',
    webDir: 'dist',
    ios: {
        contentInset: 'automatic',
        backgroundColor: '#000000',
    },
    server: {
        // Le frontend embarqué appelle l'API prod directement (voir apiConfig.ts)
        androidScheme: 'https',
    },
};

export default config;
