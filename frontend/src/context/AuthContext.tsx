import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
    id: string;
    email: string;
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
    const [user, setUser] = useState<User | null>(null);
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Init from localStorage
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        const storedTenant = localStorage.getItem('tenant');

        if (storedToken && storedUser && storedTenant) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                setTenant(JSON.parse(storedTenant));
            } catch (e) {
                console.error('Failed to parse auth data', e);
                logout();
            }
        }
        setIsLoading(false);
    }, []);

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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
