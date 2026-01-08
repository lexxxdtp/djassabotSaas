import fs from 'fs';
import path from 'path';
import * as tenantService from './tenantService';
import { supabase, isSupabaseEnabled } from '../config/supabase';
import {
    Product, CartItem, Order, Settings,
    Tenant, User, Subscription
} from '../types';

// Export types for compatibility with existing imports in other files
export { Product, CartItem, Order, Settings, Tenant, User, Subscription };

// Local JSON Data Persistence
const DB_FILE = path.join(__dirname, '../../database/store.json');

interface LocalData {
    settings: Settings;
    products: Product[];
    orders: Order[];
    carts: Record<string, CartItem[]>;
}

const DEFAULT_SETTINGS: Settings = {
    botName: 'Awa',
    language: 'fr',
    persona: 'friendly',
    greeting: 'Bonjour ! Je suis Awa, votre assistante virtuelle. Comment puis-je vous aider ?',
    // Personality defaults
    politeness: 'informal',
    emojiLevel: 'medium',
    responseLength: 'medium',
    trainingExamples: [],

    negotiationFlexibility: 5,
    voiceEnabled: true,
    systemInstructions: '',
    storeName: 'Ma Boutique Mode',
    address: 'Cocody Riviera 2, Abidjan',
    phone: '+225 07 00 00 00 00',
    hours: '08:00 - 20:00',
    returnPolicy: 'satisfait_rembourse',
    deliveryAbidjanPrice: 1500,
    deliveryInteriorPrice: 3000,
    freeDeliveryThreshold: 50000,
    acceptedPayments: ['wave', 'om', 'cash'],
};

const DEFAULT_PRODUCTS: Product[] = [
    { id: '1', name: 'Bazin Riche', price: 15000, stock: 10, images: ['https://images.unsplash.com/photo-1595461135849-bf08dc936ba9?auto=format&fit=crop&q=60'], description: 'Bazin riche de qualité supérieure.' },
    { id: '2', name: 'Mèche Humaine', price: 45000, stock: 5, images: ['https://images.unsplash.com/photo-1595461135849-bf08dc936ba9?auto=format&fit=crop&q=60'], description: 'Mèches naturelles 100% humaines.' },
];

let localData: LocalData = {
    settings: DEFAULT_SETTINGS,
    products: DEFAULT_PRODUCTS,
    orders: [],
    carts: {}
};

// Helpers
const loadData = () => {
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            // restore dates
            if (parsed.orders) {
                parsed.orders = parsed.orders.map((o: any) => ({ ...o, createdAt: new Date(o.createdAt) }));
            }
            localData = { ...localData, ...parsed }; // Merge to ensure new fields in code exist
        } else {
            saveData(); // Create file if not exists
        }
    } catch (e) {
        console.error('Failed to load local database:', e);
    }
};

const saveData = () => {
    try {
        const dir = path.dirname(DB_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(DB_FILE, JSON.stringify(localData, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to save local database:', e);
    }
};

// Initialize DB on module load
loadData();


// Database Methods
export const db = {
    getOrders: async (tenantId: string): Promise<Order[]> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return (data || []).map(o => ({ ...o, createdAt: new Date(o.created_at) }));
            } catch (e) {
                console.warn('[DB] Supabase getOrders failed, fallback to local');
            }
        }
        return localData.orders.filter((o: any) => o.tenantId === tenantId);
    },

    createOrder: async (tenantId: string, userId: string, items: CartItem[], total: number, address: string, createdAt: Date = new Date()): Promise<Order> => {
        const newOrder: any = {
            id: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            tenant_id: tenantId,
            userId,
            items,
            total,
            status: 'PAID',
            address,
            createdAt
        };

        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .insert(newOrder)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            } catch (e) {
                console.warn('[DB] Supabase createOrder failed, fallback to local');
            }
        }

        localData.orders.push(newOrder);
        saveData();
        return newOrder;
    },

    getProducts: async (tenantId: string): Promise<Product[]> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return data as Product[];
            } catch (e) {
                console.warn('[DB] Supabase getProducts failed, fallback to local');
            }
        }
        return localData.products.filter((p: any) => p.tenantId === tenantId);
    },

    createProduct: async (tenantId: string, product: Omit<Product, 'id'>): Promise<Product> => {
        const productWithTenant: any = { ...product, tenant_id: tenantId };

        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .insert([productWithTenant])
                    .select()
                    .single();
                if (error) throw error;
                return data as Product;
            } catch (e) {
                console.warn('[DB] Supabase createProduct failed, fallback to local');
            }
        }

        const newProduct = { ...productWithTenant, id: Math.random().toString(36).substr(2, 9), tenantId };
        localData.products.push(newProduct);
        saveData();
        return newProduct;
    },

    updateProduct: async (tenantId: string, id: string, updates: Partial<Product>): Promise<Product | null> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .update(updates)
                    .eq('id', id)
                    .eq('tenant_id', tenantId)
                    .select()
                    .single();
                if (error) return null;
                return data as Product;
            } catch (e) { }
        }

        const product = localData.products.find((p: any) => p.id === id && p.tenantId === tenantId);
        if (!product) return null;

        Object.assign(product, updates);
        saveData();
        return product;
    },

    deleteProduct: async (tenantId: string, id: string): Promise<boolean> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { error } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', id)
                    .eq('tenant_id', tenantId);
                if (!error) return true;
            } catch (e) { }
        }

        const index = localData.products.findIndex((p: any) => p.id === id && p.tenantId === tenantId);
        if (index === -1) return false;

        localData.products.splice(index, 1);
        saveData();
        return true;
    },

    getProductByName: async (tenantId: string, name: string): Promise<Product | undefined> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data } = await supabase
                    .from('products')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .ilike('name', `%${name}%`)
                    .limit(1);
                return data && data.length > 0 ? data[0] : undefined;
            } catch (e) { }
        }
        return localData.products.find((p: any) =>
            p.tenantId === tenantId && p.name.toLowerCase().includes(name.toLowerCase())
        );
    },

    addToCart: async (userId: string, product: Product, quantity: number = 1) => {
        if (!localData.carts[userId]) localData.carts[userId] = [];

        const existing = localData.carts[userId].find(item => item.productId === product.id);
        if (existing) {
            existing.quantity += quantity;
        } else {
            localData.carts[userId].push({
                productId: product.id,
                productName: product.name,
                quantity,
                price: product.price
            });
        }
        saveData();
        return localData.carts[userId];
    },

    getCart: async (userId: string) => {
        return localData.carts[userId] || [];
    },

    clearCart: async (userId: string) => {
        localData.carts[userId] = [];
        saveData();
    },

    // Settings Methods
    getSettings: async (tenantId: string): Promise<Settings> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('settings')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .single();
                if (!error && data) return data as Settings;
            } catch (e) { }
        }
        return localData.settings; // Fallback for single-tenant local dev
    },

    updateSettings: async (tenantId: string, settings: Partial<Settings>): Promise<Settings> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('settings')
                    .upsert({ tenant_id: tenantId, ...settings })
                    .eq('tenant_id', tenantId) // This is weird in upsert but ok for now
                    .select()
                    .single();
                if (!error && data) return data as Settings;
            } catch (e) { }
        }

        localData.settings = { ...localData.settings, ...settings };
        saveData();
        return localData.settings;
    },

    // Tenant Management (Re-exported from centralized tenantService)
    createTenant: tenantService.createTenant,
    getTenantById: tenantService.getTenantById,
    getActiveTenants: tenantService.getActiveTenants,
    updateTenantWhatsAppStatus: tenantService.updateTenantWhatsAppStatus,
    updateTenantQRCode: tenantService.updateTenantQRCode,

    // User Management
    createUser: tenantService.createUser,
    getUserByEmail: tenantService.getUserByEmail,
    getUserById: tenantService.getUserById,

    // Subscription Management
    createSubscription: tenantService.createSubscription,
    getSubscriptionByTenantId: tenantService.getSubscriptionByTenantId,

    // Default Settings Creation
    createDefaultSettings: tenantService.createDefaultSettings
};
