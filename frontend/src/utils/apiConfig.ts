const PROD_API_URL = 'https://187-77-171-44.nip.io/api';

/** Détecte si on tourne dans l'app mobile Capacitor (iOS/Android). */
const isCapacitorApp = () =>
    typeof window !== 'undefined' &&
    (window.location.protocol === 'capacitor:' ||
        !!(window as any).Capacitor?.isNativePlatform?.());

export const getApiUrl = () => {
    let url = import.meta.env.VITE_API_URL;

    if (!url) {
        if (isCapacitorApp()) {
            // App mobile : le hostname est "localhost" mais on doit viser la prod
            url = PROD_API_URL;
        } else if (typeof window !== 'undefined' &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1') {
            // Fallback safety logic for Vercel production/preview deployments
            url = PROD_API_URL;
        } else {
            url = 'http://localhost:3000/api';
        }
    }

    // Remove trailing slash if present
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    // Ensure it ends with /api
    if (!url.endsWith('/api')) {
        url = `${url}/api`;
    }

    console.log('[API Config] Using API URL:', url); // Debug log for production issues
    return url;
};
