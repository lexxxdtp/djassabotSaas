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

    // New Defaults
    openingHours: {
        lundi: { open: '08:00', close: '20:00', closed: false },
        mardi: { open: '08:00', close: '20:00', closed: false },
        mercredi: { open: '08:00', close: '20:00', closed: false },
        jeudi: { open: '08:00', close: '20:00', closed: false },
        vendredi: { open: '08:00', close: '20:00', closed: false },
        samedi: { open: '09:00', close: '18:00', closed: false },
        dimanche: { open: '09:00', close: '14:00', closed: true },
    },
    policyDescription: '',

    deliveryEnabled: true,
    deliveryZones: [
        { name: 'Abidjan', price: 1500 },
        { name: 'Intérieur', price: 3000 }
    ],
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
                // Map snake_case DB columns to camelCase for app usage
                return (data || []).map(o => ({
                    ...o,
                    userId: o.user_id,  // Map user_id to userId
                    createdAt: new Date(o.created_at)
                }));
            } catch (e) {
                console.warn('[DB] Supabase getOrders failed, fallback to local');
            }
        }
        return localData.orders.filter((o: any) => o.tenantId === tenantId);
    },


    createOrder: async (tenantId: string, userId: string, items: CartItem[], total: number, address: string, createdAt: Date = new Date()): Promise<Order> => {
        const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        // Supabase uses snake_case column names
        const dbOrder = {
            id: orderId,
            tenant_id: tenantId,
            user_id: userId,  // snake_case for DB
            items,
            total,
            status: 'PENDING',
            address,
            created_at: createdAt.toISOString()  // snake_case for DB
        };

        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .insert(dbOrder)
                    .select()
                    .single();
                if (error) throw error;

                // Log activity: New Sale
                await supabase.from('activity_logs').insert([{
                    tenant_id: tenantId,
                    type: 'sale',
                    message: `Nouvelle commande de ${(total).toLocaleString()} FCFA par ${userId.split('@')[0]}`,
                    metadata: { orderId: data.id, total }
                }]);

                // Map back to camelCase for app usage
                return {
                    ...data,
                    userId: data.user_id,
                    createdAt: new Date(data.created_at)
                } as Order;
            } catch (e) {
                console.warn('[DB] Supabase createOrder failed, fallback to local:', e);
            }
        }

        // Local fallback uses camelCase
        const localOrder: any = {
            id: orderId,
            tenantId,
            userId,
            items,
            total,
            status: 'PENDING',
            address,
            createdAt
        };
        localData.orders.push(localOrder);
        saveData();
        return localOrder;
    },


    updateOrderStatus: async (tenantId: string, orderId: string, status: string): Promise<any> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .update({ status })
                    .eq('id', orderId)
                    .eq('tenant_id', tenantId) // Security check
                    .select()
                    .single();
                if (error) throw error;

                // Log the status change
                await supabase.from('activity_logs').insert([{
                    tenant_id: tenantId,
                    type: 'action',
                    message: `Commande ${orderId.split('-')[1]} passée à ${status}`,
                    metadata: { orderId, status }
                }]);

                return data;
            } catch (e) {
                console.error('[DB] Update Order Status failed', e);
                return null;
            }
        }
        return null; // Fallback mock not implemented for complexity
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
            return (data || []).map((p: any) => ({
                ...p,
                minPrice: p.min_price,
                tenantId: p.tenant_id,
                variations: p.variations || [],
                aiInstructions: p.ai_instructions,
                manageStock: p.manage_stock ?? true
            })) as Product[];
        } catch (e: any) {
            console.error('[DB] Supabase getProducts failed:', e);
            throw new Error(e.message || 'Failed to fetch products');
        }
    },

    createProduct: async (tenantId: string, product: Omit<Product, 'id'>): Promise<Product> => {
        // Validation: Stock cannot be negative
        if (product.stock !== undefined && product.stock < 0) {
            throw new Error('Stock cannot be negative');
        }

        // Validate variations stock
        if (product.variations && product.variations.length > 0) {
            for (const variation of product.variations) {
                if (variation.options) {
                    for (const option of variation.options) {
                        if (option.stock !== undefined && option.stock < 0) {
                            throw new Error(`Stock for option "${option.value}" cannot be negative`);
                        }
                    }
                }
            }
        }

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
            ai_instructions: product.aiInstructions || null,
            manage_stock: product.manageStock ?? true
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
                    aiInstructions: data.ai_instructions,
                    manageStock: data.manage_stock ?? true
                } as Product;
            } catch (e: any) {
                console.error('[DB] Create Product Failed:', e);
                throw new Error(`Database Error: ${e.message}`);
            }
        }

        throw new Error('Database unavailable');
    },

    updateProduct: async (tenantId: string, id: string, updates: Partial<Product>): Promise<Product | null> => {
        // Validation: Stock cannot be negative
        if (updates.stock !== undefined && updates.stock < 0) {
            throw new Error('Stock cannot be negative');
        }

        // Validate variations stock
        if (updates.variations && updates.variations.length > 0) {
            for (const variation of updates.variations) {
                if (variation.options) {
                    for (const option of variation.options) {
                        if (option.stock !== undefined && option.stock < 0) {
                            throw new Error(`Stock for option "${option.value}" cannot be negative`);
                        }
                    }
                }
            }
        }

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
        if (updates.manageStock !== undefined) {
            dbUpdates.manage_stock = updates.manageStock;
            delete dbUpdates.manageStock;
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
                    .maybeSingle();

                if (error) {
                    console.error('[DB] getSettings Error:', error.message);
                    return { ...DEFAULT_SETTINGS };
                }

                if (data) {
                    return {
                        botName: data.bot_name || DEFAULT_SETTINGS.botName,
                        language: data.language || DEFAULT_SETTINGS.language,
                        persona: data.persona || DEFAULT_SETTINGS.persona,
                        greeting: data.greeting || DEFAULT_SETTINGS.greeting,
                        politeness: data.politeness || DEFAULT_SETTINGS.politeness,
                        emojiLevel: data.emoji_level || DEFAULT_SETTINGS.emojiLevel,
                        responseLength: data.response_length || DEFAULT_SETTINGS.responseLength,
                        trainingExamples: data.training_examples || [],
                        negotiationEnabled: data.negotiation_enabled ?? DEFAULT_SETTINGS.negotiationEnabled,
                        negotiationFlexibility: data.negotiation_flexibility ?? DEFAULT_SETTINGS.negotiationFlexibility,
                        voiceEnabled: data.voice_enabled ?? DEFAULT_SETTINGS.voiceEnabled,
                        systemInstructions: data.system_instructions || '',
                        storeName: data.store_name || DEFAULT_SETTINGS.storeName,
                        businessType: data.business_type || '',
                        address: data.address || DEFAULT_SETTINGS.address,
                        locationUrl: data.location_url || '',
                        gpsCoordinates: data.gps_coordinates || '',
                        phone: data.phone || DEFAULT_SETTINGS.phone,
                        socialMedia: data.social_media || {},
                        openingHours: data.opening_hours || DEFAULT_SETTINGS.openingHours,
                        policyDescription: data.policy_description || '',
                        notificationPhone: data.notification_phone || '',
                        deliveryEnabled: data.delivery_enabled ?? DEFAULT_SETTINGS.deliveryEnabled,
                        deliveryZones: data.delivery_zones || DEFAULT_SETTINGS.deliveryZones,
                        freeDeliveryThreshold: data.free_delivery_threshold ?? DEFAULT_SETTINGS.freeDeliveryThreshold,
                        acceptedPayments: data.accepted_payments || DEFAULT_SETTINGS.acceptedPayments,
                        settlementBank: data.settlement_bank,
                        settlementAccount: data.settlement_account,
                    } as Settings;
                } else {
                    return { ...DEFAULT_SETTINGS };
                }
            } catch (e: any) {
                console.error('[DB] getSettings Exception:', e);
                return { ...DEFAULT_SETTINGS };
            }
        }
        return localData.settings;
    },

    updateSettings: async (tenantId: string, settings: Partial<Settings>): Promise<Settings> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const dbSettings: any = { tenant_id: tenantId };
                if (settings.botName !== undefined) dbSettings.bot_name = settings.botName;
                if (settings.language !== undefined) dbSettings.language = settings.language;
                if (settings.persona !== undefined) dbSettings.persona = settings.persona;
                if (settings.greeting !== undefined) dbSettings.greeting = settings.greeting;
                if (settings.politeness !== undefined) dbSettings.politeness = settings.politeness;
                if (settings.emojiLevel !== undefined) dbSettings.emoji_level = settings.emojiLevel;
                if (settings.humorLevel !== undefined) dbSettings.humor_level = settings.humorLevel;
                if (settings.slangLevel !== undefined) dbSettings.slang_level = settings.slangLevel;
                if (settings.responseLength !== undefined) dbSettings.response_length = settings.responseLength;
                if (settings.trainingExamples !== undefined) dbSettings.training_examples = settings.trainingExamples;
                if (settings.negotiationEnabled !== undefined) dbSettings.negotiation_enabled = settings.negotiationEnabled;
                if (settings.negotiationFlexibility !== undefined) dbSettings.negotiation_flexibility = settings.negotiationFlexibility;
                if (settings.voiceEnabled !== undefined) dbSettings.voice_enabled = settings.voiceEnabled;
                if (settings.systemInstructions !== undefined) dbSettings.system_instructions = settings.systemInstructions;
                if (settings.storeName !== undefined) dbSettings.store_name = settings.storeName;
                if (settings.businessType !== undefined) dbSettings.business_type = settings.businessType;
                if (settings.address !== undefined) dbSettings.address = settings.address;
                if (settings.locationUrl !== undefined) dbSettings.location_url = settings.locationUrl;
                if (settings.gpsCoordinates !== undefined) dbSettings.gps_coordinates = settings.gpsCoordinates;
                if (settings.phone !== undefined) dbSettings.phone = settings.phone;
                if (settings.socialMedia !== undefined) dbSettings.social_media = settings.socialMedia;
                if (settings.openingHours !== undefined) dbSettings.opening_hours = settings.openingHours;
                if (settings.policyDescription !== undefined) dbSettings.policy_description = settings.policyDescription;
                if (settings.notificationPhone !== undefined) dbSettings.notification_phone = settings.notificationPhone;
                if (settings.deliveryEnabled !== undefined) dbSettings.delivery_enabled = settings.deliveryEnabled;
                if (settings.deliveryZones !== undefined) dbSettings.delivery_zones = settings.deliveryZones;
                if (settings.freeDeliveryThreshold !== undefined) dbSettings.free_delivery_threshold = settings.freeDeliveryThreshold;
                if (settings.acceptedPayments !== undefined) dbSettings.accepted_payments = settings.acceptedPayments;
                dbSettings.updated_at = new Date().toISOString();

                console.log('[DB] Updating Settings for tenant:', tenantId, dbSettings);

                const { data, error } = await supabase
                    .from('settings')
                    .upsert(dbSettings, { onConflict: 'tenant_id' })
                    .select()
                    .single();

                if (error) throw error;

                if (data) {
                    return {
                        ...DEFAULT_SETTINGS, // Ensure defaults for missing fields
                        ...settings,         // Apply new settings locally
                        // In a real app we would map back 'data' fully, but to save space we assume success implies value.
                        // However, let's map at least the critical ones to be safe
                        botName: data.bot_name,
                    } as Settings;
                }
            } catch (e) {
                console.error('[DB] Update Settings Exception:', e);
                throw e;
            }
        }

        localData.settings = { ...localData.settings, ...settings };
        saveData();
        return localData.settings;
    },

    // --- ACTIVITY LOGS (THE PULSE) ---
    logActivity: async (tenantId: string, type: 'info' | 'sale' | 'warning' | 'action', message: string, metadata: any = {}) => {
        if (isSupabaseEnabled && supabase) {
            try {
                await supabase.from('activity_logs').insert([{ tenant_id: tenantId, type, message, metadata }]);
            } catch (e) { console.error('Log Error', e); }
        }
    },

    getRecentActivity: async (tenantId: string, limit: number = 20) => {
        if (isSupabaseEnabled && supabase) {
            const { data } = await supabase
                .from('activity_logs')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(limit);
            return data || [];
        }
        return [];
    },

    getRecentOrders: async (tenantId: string, limit: number = 5) => {
        if (isSupabaseEnabled && supabase) {
            const { data } = await supabase
                .from('orders')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(limit);
            return data || [];
        }
        return [];
    },

    // Variation Templates
    getVariationTemplates: async (tenantId: string) => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('variation_templates')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('usage_count', { ascending: false })
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return data || [];
            } catch (e) {
                console.error('[DB] Get Variation Templates Error:', e);
                return [];
            }
        }
        return [];
    },

    saveVariationTemplate: async (tenantId: string, name: string, defaultOptions: any[]) => {
        if (isSupabaseEnabled && supabase) {
            try {
                // Check if template already exists for this tenant
                const { data: existing } = await supabase
                    .from('variation_templates')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .eq('name', name)
                    .single();

                if (existing) {
                    // Update existing template
                    const { data, error } = await supabase
                        .from('variation_templates')
                        .update({
                            default_options: defaultOptions,
                            usage_count: (existing.usage_count || 0) + 1
                        })
                        .eq('id', existing.id)
                        .select()
                        .single();

                    if (error) throw error;
                    return data;
                } else {
                    // Create new template
                    const { data, error } = await supabase
                        .from('variation_templates')
                        .insert({
                            tenant_id: tenantId,
                            name,
                            default_options: defaultOptions,
                            usage_count: 1
                        })
                        .select()
                        .single();

                    if (error) throw error;
                    return data;
                }
            } catch (e) {
                console.error('[DB] Save Variation Template Error:', e);
                throw e;
            }
        }
        throw new Error('Supabase not enabled');
    },

    // Tenant Management (Re-exported from centralized tenantService)
    createTenant: tenantService.createTenant,
    getTenantById: tenantService.getTenantById,
    getActiveTenants: tenantService.getActiveTenants,
    updateTenantWhatsAppStatus: tenantService.updateTenantWhatsAppStatus,
    updateTenant: tenantService.updateTenant,
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
