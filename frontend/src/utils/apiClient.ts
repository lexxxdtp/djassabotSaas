import { getApiUrl } from './apiConfig';

/**
 * Custom fetch wrapper that automatically handles:
 * 1. Base URL resolution
 * 2. Authorization header injection
 * 3. 401 Unauthorized globally to force logout
 */
export const apiClient = async (endpoint: string, options: RequestInit = {}) => {
    const API_URL = getApiUrl();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    const headers: Record<string, string> = {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const config: RequestInit = {
        ...options,
        headers,
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);

        if (response.status === 401) {
            // Token is expired or invalid
            // Dispatch a custom event that AuthContext can listen to for logging out
            window.dispatchEvent(new Event('auth:unauthorized'));
        }

        // 402 = abonnement expiré (middleware checkSubscription côté backend).
        // On prévient l'app pour afficher l'écran de renouvellement au lieu de
        // laisser les pages échouer en silence. On NE déconnecte PAS l'utilisateur.
        if (response.status === 402) {
            window.dispatchEvent(new Event('subscription:expired'));
        }

        return response;
    } catch (error) {
        // Network errors or CORS errors
        console.error('[API Client Error]', error);
        throw error;
    }
};
