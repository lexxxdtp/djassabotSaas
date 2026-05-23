import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiClient } from '../utils/apiClient';

interface User {
    id: string;
    email?: string;
    phone?: string;
    full_name?: string;
    birth_date?: Date;
    role: string;
}

interface Tenant {
    id: string;
    name: string;
    businessType?: string;
    subscription_tier?: string;
    status?: string;
}

interface AuthContextType {
    user: User | null;
    tenant: Tenant | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (token: string, user: User, tenant: Tenant, rememberMe?: boolean) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to get stored data (checks both localStorage and sessionStorage)
const getStoredItem = (key: string): string | null => {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
};

// Helper to get stored JSON
const getStoredJSON = (key: string): unknown => {
    try {
        const item = getStoredItem(key);
        return item ? JSON.parse(item) : null;
    } catch {
        return null;
    }
};

// Helper to clear from both storages
const clearStoredItems = () => {
    ['token', 'user', 'tenant', 'authToken', 'userEmail'].forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    });
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initialize state from storage
    const [token, setToken] = useState<string | null>(() => {
        return getStoredItem('token');
    });
    const [user, setUser] = useState<User | null>(() => {
        return getStoredJSON('user') as User | null;
    });
    const [tenant, setTenant] = useState<Tenant | null>(() => {
        return getStoredJSON('tenant') as Tenant | null;
    });

    const [isLoadingData, setIsLoadingData] = useState(false);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        setTenant(null);

        // Clear from both storages
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        localStorage.removeItem('tenant');
        sessionStorage.removeItem('tenant');
    }, []);

    useEffect(() => {
        const fetchMe = async () => {
            if (!token) return;

            // Avoid loop if we just logged in (state is already set), but logic usually requires refresh on page reload
            // Simplest check: if we have token but maybe stale data?
            // Actually, always fetch on mount (page refresh) to sync status
            setIsLoadingData(true);
            try {
                const res = await apiClient('/auth/me');

                if (res.ok) {
                    const data = await res.json();
                    if (data.user && data.tenant) {
                        setUser(data.user);
                        setTenant(data.tenant);

                        // Update storage
                        const isLocal = !!localStorage.getItem('token');
                        const storage = isLocal ? localStorage : sessionStorage;
                        storage.setItem('user', JSON.stringify(data.user));
                        storage.setItem('tenant', JSON.stringify(data.tenant));


                    }
                } else if (res.status === 401) {
                    // Token invalid/expired
                    logout();
                }
            } catch (err) {
                console.error('[AuthContext] Failed to refresh user data', err);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchMe();
    }, [token, logout]);



    const login = (newToken: string, newUser: User, newTenant: Tenant, rememberMe: boolean = true) => {
        setToken(newToken);
        setUser(newUser);
        setTenant(newTenant);

        // Choose storage based on rememberMe preference
        const storage = rememberMe ? localStorage : sessionStorage;

        // Clear old data from both storages first
        clearStoredItems();

        // Store in chosen storage
        storage.setItem('token', newToken);
        storage.setItem('user', JSON.stringify(newUser));
        storage.setItem('tenant', JSON.stringify(newTenant));

        // Also store authToken for backward compatibility (used by Subscription page)
        storage.setItem('authToken', newToken);

        // Store email for Paystack if available
        if (newUser.email) {
            storage.setItem('userEmail', newUser.email);
        }


    };

    useEffect(() => {
        const handleUnauthorized = () => {
            logout();
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, [logout]);

    return (
        <AuthContext.Provider value={{
            user,
            tenant,
            token,
            isAuthenticated: !!token,
            login,
            logout,
            isLoading: isLoadingData
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
