export const getApiUrl = () => {
    let url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    // Remove trailing slash if present
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    // Ensure it ends with /api
    if (!url.endsWith('/api')) {
        url = `${url}/api`;
    }

    return url;
};
