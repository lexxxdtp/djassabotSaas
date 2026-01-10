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
    login: (token: string, user: User, tenant: Tenant) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
    const [user, setUser] = useState<User | null>(() => {
        try {
            const item = localStorage.getItem('user');
            return item ? JSON.parse(item) : null;
        } catch {
            return null;
        }
    });
    const [tenant, setTenant] = useState<Tenant | null>(() => {
        try {
            const item = localStorage.getItem('tenant');
            return item ? JSON.parse(item) : null;
        } catch {
            return null;
        }
    });
    const isLoading = false;

    const login = (newToken: string, newUser: User, newTenant: Tenant) => {
        setToken(newToken);
        setUser(newUser);
        setTenant(newTenant);

        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        localStorage.setItem('tenant', JSON.stringify(newTenant));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        setTenant(null);

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('tenant');
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
