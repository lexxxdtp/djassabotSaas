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

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

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

        return response;
    } catch (error) {
        // Network errors or CORS errors
        console.error('[API Client Error]', error);
        throw error;
    }
};
