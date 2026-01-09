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

    negotiationEnabled: true,
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
    { id: '1', name: 'Bazin Riche', price: 15000, minPrice: 13000, stock: 10, images: ['https://images.unsplash.com/photo-1595461135849-bf08dc936ba9?auto=format&fit=crop&q=60'], description: 'Bazin riche de qualité supérieure.' },
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
        if (!isSupabaseEnabled || !supabase) {
            throw new Error('Supabase is not enabled');
        }
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Product[];
        } catch (e: any) {
            console.error('[DB] Supabase getProducts failed:', e);
            throw new Error(e.message || 'Failed to fetch products');
        }
    },

    createProduct: async (tenantId: string, product: Omit<Product, 'id'>): Promise<Product> => {
        // Map camelCase to snake_case for DB
        const dbProduct = {
            tenant_id: tenantId,
            name: product.name,
            price: product.price,
            stock: product.stock,
            description: product.description,
            images: product.images,
            min_price: product.minPrice,
            variations: product.variations || [],
            ai_instructions: product.aiInstructions || null
        };

        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .insert([dbProduct])
                    .select()
                    .single();
                if (error) {
                    console.error('[DB] Create Product Error:', error);
                    throw error;
                }
                // Map back to camelCase for app
                return {
                    ...data,
                    minPrice: data.min_price,
                    tenantId: data.tenant_id,
                    variations: data.variations || [],
                    aiInstructions: data.ai_instructions
                } as Product;
            } catch (e: any) {
                console.error('[DB] Create Product Failed:', e);
                throw new Error(`Database Error: ${e.message}`);
            }
        }

        throw new Error('Database unavailable');
    },

    updateProduct: async (tenantId: string, id: string, updates: Partial<Product>): Promise<Product | null> => {
        // Map updates to snake_case
        const dbUpdates: any = { ...updates };
        if (updates.minPrice !== undefined) {
            dbUpdates.min_price = updates.minPrice;
            delete dbUpdates.minPrice;
        }
        if (updates.aiInstructions !== undefined) {
            dbUpdates.ai_instructions = updates.aiInstructions;
            delete dbUpdates.aiInstructions;
        }
        // variations is already in correct format (JSON), no mapping needed

        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .update(dbUpdates)
                    .eq('id', id)
                    .eq('tenant_id', tenantId)
                    .select()
                    .single();
                if (error) return null;

                // Map back
                return {
                    ...data,
                    minPrice: data.min_price,
                    tenantId: data.tenant_id,
                    variations: data.variations || [],
                    aiInstructions: data.ai_instructions
                } as Product;
            } catch (e: any) {
                console.error('[DB] Update Product Failed:', e);
                throw new Error(`Database Error: ${e.message}`);
            }
        }

        throw new Error('Database unavailable');
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
                if (data && data.length > 0) {
                    return {
                        ...data[0],
                        minPrice: data[0].min_price,
                        tenantId: data[0].tenant_id,
                        variations: data[0].variations || [],
                        aiInstructions: data[0].ai_instructions
                    };
                }
                return undefined;
            } catch (e) { }
        }
        return localData.products.find((p: any) =>
            p.tenantId === tenantId && p.name.toLowerCase().includes(name.toLowerCase())
        );
    },

    getProductById: async (tenantId: string, id: string): Promise<Product | undefined> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .eq('id', id)
                    .single();
                if (data && !error) {
                    return {
                        ...data,
                        minPrice: data.min_price,
                        tenantId: data.tenant_id,
                        variations: data.variations || [],
                        aiInstructions: data.ai_instructions
                    };
                }
                return undefined;
            } catch (e) { }
        }
        return localData.products.find((p: any) => p.tenantId === tenantId && p.id === id);
    },

    addToCart: async (tenantId: string, userId: string, product: Product, quantity: number = 1) => {
        const key = `${tenantId}:${userId}`;
        if (!localData.carts[key]) localData.carts[key] = [];

        const existing = localData.carts[key].find(item => item.productId === product.id);
        if (existing) {
            existing.quantity += quantity;
        } else {
            localData.carts[key].push({
                productId: product.id,
                productName: product.name,
                quantity,
                price: product.price
            });
        }
        saveData();
        return localData.carts[key];
    },

    getCart: async (tenantId: string, userId: string) => {
        const key = `${tenantId}:${userId}`;
        return localData.carts[key] || [];
    },

    clearCart: async (tenantId: string, userId: string) => {
        const key = `${tenantId}:${userId}`;
        localData.carts[key] = [];
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
                if (!error && data) {
                    // Map snake_case DB columns to camelCase TypeScript interface
                    return {
                        botName: data.bot_name,
                        language: data.language,
                        persona: data.persona,
                        greeting: data.greeting,
                        politeness: data.politeness,
                        emojiLevel: data.emoji_level,
                        responseLength: data.response_length,
                        trainingExamples: data.training_examples || [],
                        negotiationEnabled: data.negotiation_enabled ?? true,
                        negotiationFlexibility: data.negotiation_flexibility ?? 5,
                        voiceEnabled: data.voice_enabled ?? true,
                        systemInstructions: data.system_instructions || '',
                        storeName: data.store_name,
                        address: data.address,
                        phone: data.phone,
                        hours: data.hours,
                        returnPolicy: data.return_policy,
                        deliveryAbidjanPrice: data.delivery_abidjan_price ?? 1500,
                        deliveryInteriorPrice: data.delivery_interior_price ?? 3000,
                        freeDeliveryThreshold: data.free_delivery_threshold ?? 50000,
                        acceptedPayments: data.accepted_payments || ['wave', 'cash'],
                    } as Settings;
                }
            } catch (e) { }
        }
        return localData.settings; // Fallback for single-tenant local dev
    },

    updateSettings: async (tenantId: string, settings: Partial<Settings>): Promise<Settings> => {
        if (isSupabaseEnabled && supabase) {
            try {
                // Map camelCase TypeScript properties to snake_case DB columns
                const dbSettings: any = { tenant_id: tenantId };
                if (settings.botName !== undefined) dbSettings.bot_name = settings.botName;
                if (settings.language !== undefined) dbSettings.language = settings.language;
                if (settings.persona !== undefined) dbSettings.persona = settings.persona;
                if (settings.greeting !== undefined) dbSettings.greeting = settings.greeting;
                if (settings.politeness !== undefined) dbSettings.politeness = settings.politeness;
                if (settings.emojiLevel !== undefined) dbSettings.emoji_level = settings.emojiLevel;
                if (settings.responseLength !== undefined) dbSettings.response_length = settings.responseLength;
                if (settings.trainingExamples !== undefined) dbSettings.training_examples = settings.trainingExamples;
                if (settings.negotiationEnabled !== undefined) dbSettings.negotiation_enabled = settings.negotiationEnabled;
                if (settings.negotiationFlexibility !== undefined) dbSettings.negotiation_flexibility = settings.negotiationFlexibility;
                if (settings.voiceEnabled !== undefined) dbSettings.voice_enabled = settings.voiceEnabled;
                if (settings.systemInstructions !== undefined) dbSettings.system_instructions = settings.systemInstructions;
                if (settings.storeName !== undefined) dbSettings.store_name = settings.storeName;
                if (settings.address !== undefined) dbSettings.address = settings.address;
                if (settings.phone !== undefined) dbSettings.phone = settings.phone;
                if (settings.hours !== undefined) dbSettings.hours = settings.hours;
                if (settings.returnPolicy !== undefined) dbSettings.return_policy = settings.returnPolicy;
                if (settings.deliveryAbidjanPrice !== undefined) dbSettings.delivery_abidjan_price = settings.deliveryAbidjanPrice;
                if (settings.deliveryInteriorPrice !== undefined) dbSettings.delivery_interior_price = settings.deliveryInteriorPrice;
                if (settings.freeDeliveryThreshold !== undefined) dbSettings.free_delivery_threshold = settings.freeDeliveryThreshold;
                if (settings.acceptedPayments !== undefined) dbSettings.accepted_payments = settings.acceptedPayments;
                dbSettings.updated_at = new Date();

                const { data, error } = await supabase
                    .from('settings')
                    .upsert(dbSettings, { onConflict: 'tenant_id' })
                    .select()
                    .single();

                if (!error && data) {
                    // Map back to camelCase for return
                    return {
                        botName: data.bot_name,
                        language: data.language,
                        persona: data.persona,
                        greeting: data.greeting,
                        politeness: data.politeness,
                        emojiLevel: data.emoji_level,
                        responseLength: data.response_length,
                        trainingExamples: data.training_examples || [],
                        negotiationEnabled: data.negotiation_enabled ?? true,
                        negotiationFlexibility: data.negotiation_flexibility ?? 5,
                        voiceEnabled: data.voice_enabled ?? true,
                        systemInstructions: data.system_instructions || '',
                        storeName: data.store_name,
                        address: data.address,
                        phone: data.phone,
                        hours: data.hours,
                        returnPolicy: data.return_policy,
                        deliveryAbidjanPrice: data.delivery_abidjan_price ?? 1500,
                        deliveryInteriorPrice: data.delivery_interior_price ?? 3000,
                        freeDeliveryThreshold: data.free_delivery_threshold ?? 50000,
                        acceptedPayments: data.accepted_payments || ['wave', 'cash'],
                    } as Settings;
                }
            } catch (e) {
                console.error('[DB] Update Settings Error:', e);
            }
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
    getUserByPhone: tenantService.getUserByPhone,
    getUserById: tenantService.getUserById,
    updateUser: tenantService.updateUser,

    // Subscription Management
    createSubscription: tenantService.createSubscription,
    getSubscriptionByTenantId: tenantService.getSubscriptionByTenantId,

    // Default Settings Creation
    createDefaultSettings: tenantService.createDefaultSettings
};
