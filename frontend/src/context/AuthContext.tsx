import React, { createContext, useContext, useState, type ReactNode } from 'react';

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
    const [token, setToken] = useState<string | null>(() => getStoredItem('token'));
    const [user, setUser] = useState<User | null>(() => getStoredJSON('user') as User | null);
    const [tenant, setTenant] = useState<Tenant | null>(() => getStoredJSON('tenant') as Tenant | null);
    const isLoading = false;

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

    const logout = () => {
        setToken(null);
        setUser(null);
        setTenant(null);

        // Clear from both storages
        clearStoredItems();
    };

    return (
        <AuthContext.Provider value={{
            user,
            tenant,
            token,
            isAuthenticated: !!token,
            login,
            logout,
            isLoading
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
