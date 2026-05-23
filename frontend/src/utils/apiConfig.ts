export const getApiUrl = () => {
    let url = import.meta.env.VITE_API_URL;

    // Fallback safety logic for Vercel production/preview deployments
    if (!url) {
        if (typeof window !== 'undefined' && 
            window.location.hostname !== 'localhost' && 
            window.location.hostname !== '127.0.0.1') {
            url = 'https://187-77-171-44.nip.io/api';
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
