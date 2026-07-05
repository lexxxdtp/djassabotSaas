import fs from 'fs';
import path from 'path';
import * as tenantService from './tenantService';
import { supabase, isSupabaseEnabled } from '../config/supabase';
import {
    Product, CartItem, Order, Settings,
    Tenant, User, Subscription
} from '../types';
import { DELIVERY_ITEM_ID } from './whatsapp/salesEngine';

// Export types for compatibility with existing imports in other files
export { Product, CartItem, Order, Settings, Tenant, User, Subscription };

export interface StockFailure {
    productId: string;
    productName: string;
    requested: number;
    available?: number;
}

/**
 * Ajuste le stock d'un article (delta négatif = commande, positif = restock).
 * Essaie la fonction SQL atomique `adjust_stock` (migration
 * add_adjust_stock_rpc.sql) ; si elle n'est pas déployée, retombe sur un
 * read-modify-write JS (non atomique — un warning est loggé pour le signaler).
 */
const adjustStock = async (
    tenantId: string,
    item: CartItem,
    delta: number
): Promise<{ ok: boolean; available?: number }> => {
    if (!isSupabaseEnabled || !supabase) return { ok: true }; // mode local : pas de stock à gérer

    // 1. Voie atomique (RPC SQL)
    try {
        const { data, error } = await supabase.rpc('adjust_stock', {
            p_tenant_id: tenantId,
            p_product_id: String(item.productId),
            p_delta: delta,
            p_variations: item.selectedVariations && item.selectedVariations.length > 0
                ? item.selectedVariations
                : null,
        });
        if (!error) {
            const row = Array.isArray(data) ? data[0] : data;
            if (row && row.success === false) {
                return { ok: false, available: row.available ?? undefined };
            }
            return { ok: true };
        }
        // Fonction absente (migration pas encore appliquée) → fallback JS
        const missingFn = error.code === 'PGRST202' || /adjust_stock|schema cache|function/i.test(error.message || '');
        if (!missingFn) {
            console.error('[DB] adjust_stock RPC error:', error.message);
        } else {
            console.warn('[DB] ⚠️ Fonction SQL adjust_stock absente — fallback JS NON atomique. Appliquez database/migrations/add_adjust_stock_rpc.sql');
        }
    } catch (e) {
        console.error('[DB] adjust_stock RPC exception:', e);
    }

    // 2. Fallback JS (read-modify-write)
    try {
        const product = await db.getProductById(tenantId, String(item.productId));
        if (!product) return { ok: delta > 0 }; // restock d'un produit supprimé : on ignore
        if (product.manageStock === false) return { ok: true };

        const qty = Math.abs(delta);
        const isDecrement = delta < 0;

        if (isDecrement && product.stock !== undefined && product.stock !== null && product.stock < qty) {
            return { ok: false, available: product.stock };
        }

        // Stock des options de variation sélectionnées
        let newVariations = product.variations;
        if (item.selectedVariations && item.selectedVariations.length > 0 && Array.isArray(product.variations)) {
            for (const sel of item.selectedVariations) {
                const variation = product.variations.find(v => v.name === sel.name);
                const option = variation?.options.find(o => o.value === sel.value);
                if (isDecrement && option && option.stock !== undefined && option.stock < qty) {
                    return { ok: false, available: option.stock };
                }
            }
            newVariations = product.variations.map(v => ({
                ...v,
                options: v.options.map(o => {
                    const selected = item.selectedVariations!.some(s => s.name === v.name && s.value === o.value);
                    if (selected && o.stock !== undefined) {
                        return { ...o, stock: Math.max(0, o.stock + delta) };
                    }
                    return o;
                }),
            }));
        }

        const updates: Partial<Product> = { variations: newVariations };
        if (product.stock !== undefined && product.stock !== null) {
            updates.stock = Math.max(0, product.stock + delta);
        }
        await db.updateProduct(tenantId, String(item.productId), updates);
        return { ok: true };
    } catch (e) {
        console.error('[DB] adjustStock JS fallback failed:', e);
        // En cas de doute sur un décrément, on laisse passer la vente (priorité au CA)
        // mais on loggue — le vendeur verra l'écart de stock.
        return { ok: true };
    }
};

// Local JSON Data Persistence
const DB_FILE = path.join(__dirname, '../../database/store.json');

interface LocalData {
    settings: Settings;
    products: Product[];
    orders: Order[];
    carts: Record<string, CartItem[]>;
    authTokens: { identifier: string, tokenType: string, tokenValue: string, expiresAt: string }[];
}

const DEFAULT_SETTINGS: Settings = {
    botActive: false, // Sécurité : le bot ne répond jamais sans activation explicite
    botName: 'Awa',
    language: 'fr',
    persona: 'friendly',
    greeting: 'Bonjour ! Je suis Awa, votre assistante virtuelle. Comment puis-je vous aider ?',
    // Personality defaults
    politeness: 'informal',
    emojiLevel: 'medium',
    humorLevel: 'medium',
    slangLevel: 'low',
    responseLength: 'medium',
    trainingExamples: [],

    negotiationEnabled: true,
    negotiationFlexibility: 5,
    voiceEnabled: true,
    systemInstructions: '',
    storeName: 'Ma Boutique Mode',
    businessType: 'Mode & Vêtements',
    // Jamais de fausses valeurs par défaut : le bot les donnerait aux clients.
    address: '',
    locationUrl: '',
    gpsCoordinates: '',
    phone: '',
    socialMedia: {
        facebook: '',
        instagram: '',
        tiktok: '',
        website: ''
    },

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
    carts: {},
    authTokens: []
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


// Helper to map snake_case DB settings to camelCase Settings type
const mapDbSettingsToSettings = (data: any): Settings => {
    return {
        botActive: data.bot_active ?? false,
        botName: data.bot_name || DEFAULT_SETTINGS.botName,
        language: data.language || DEFAULT_SETTINGS.language,
        persona: data.persona || DEFAULT_SETTINGS.persona,
        greeting: data.greeting || DEFAULT_SETTINGS.greeting,
        politeness: data.politeness || DEFAULT_SETTINGS.politeness,
        emojiLevel: data.emoji_level || DEFAULT_SETTINGS.emojiLevel,
        humorLevel: data.humor_level || 'medium',
        slangLevel: data.slang_level || 'low',
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
        deliveryZones: (typeof data.delivery_zones === 'string' ? JSON.parse(data.delivery_zones) : data.delivery_zones) || DEFAULT_SETTINGS.deliveryZones,
        freeDeliveryThreshold: data.free_delivery_threshold ?? DEFAULT_SETTINGS.freeDeliveryThreshold,
        acceptedPayments: (typeof data.accepted_payments === 'string' ? JSON.parse(data.accepted_payments) : data.accepted_payments) || DEFAULT_SETTINGS.acceptedPayments,
        settlementBank: data.settlement_bank,
        settlementAccount: data.settlement_account,
        negotiationMargin: data.negotiation_margin ?? 10,
    } as Settings;
};

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
                    id: o.id,
                    tenantId: o.tenant_id,
                    userId: o.user_id,
                    items: o.items,
                    total: o.total,
                    status: o.status,
                    address: o.address,
                    createdAt: new Date(o.created_at)
                }));
            } catch (e) {
                console.warn('[DB] Supabase getOrders failed, fallback to local');
            }
        }
        return localData.orders.filter((o: any) => o.tenantId === tenantId);
    },

    /** Pagination des commandes — renvoie { items, total } */
    getOrdersPaged: async (tenantId: string, page: number, limit: number): Promise<{ items: Order[]; total: number }> => {
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error, count } = await supabase
                    .from('orders')
                    .select('*', { count: 'exact' })
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false })
                    .range(from, to);
                if (error) throw error;
                const items = (data || []).map(o => ({
                    id: o.id,
                    tenantId: o.tenant_id,
                    userId: o.user_id,
                    items: o.items,
                    total: o.total,
                    status: o.status,
                    address: o.address,
                    createdAt: new Date(o.created_at)
                }));
                return { items, total: count ?? items.length };
            } catch (e) {
                console.warn('[DB] Supabase getOrdersPaged failed, fallback to local');
            }
        }
        const all = localData.orders.filter((o: any) => o.tenantId === tenantId);
        return { items: all.slice(from, from + limit), total: all.length };
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

                // Log d'activité best-effort : ne doit JAMAIS faire échouer une
                // commande déjà créée avec succès si cette écriture secondaire rate.
                try {
                    await supabase.from('activity_logs').insert([{
                        tenant_id: tenantId,
                        type: 'sale',
                        message: `Nouvelle commande de ${(total).toLocaleString()} FCFA par ${userId.split('@')[0]}`,
                        metadata: { orderId: data.id, total }
                    }]);
                } catch (logErr) {
                    console.warn('[DB] createOrder: activity log failed (non-bloquant):', logErr);
                }

                // Map back to camelCase for app usage
                return {
                    ...data,
                    userId: data.user_id,
                    createdAt: new Date(data.created_at)
                } as Order;
            } catch (e: any) {
                // Commande = donnée critique : on NE retombe PLUS silencieusement sur
                // le fichier local (elle y serait invisible du dashboard, de Supabase,
                // et perdue au redéploiement — alors même que le stock, décrémenté
                // AVANT cet appel, aurait déjà bougé). On remonte l'erreur ;
                // flowHandler.finalizeOrder restocke et prévient le client proprement.
                console.error('[DB] createOrder failed:', e);
                throw new Error(`Database Error (Order): ${e.message || e}`);
            }
        }

        // Mode local UNIQUEMENT si Supabase n'est pas configuré du tout (dev/offline).
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
                // Statut précédent (pour la gestion du stock à l'annulation/réactivation)
                const previous = await db.getOrderById(tenantId, orderId);

                const { data, error } = await supabase
                    .from('orders')
                    .update({ status })
                    .eq('id', orderId)
                    .eq('tenant_id', tenantId) // Security check
                    .select()
                    .single();
                if (error) throw error;

                // Stock : annulation → on rend ; réactivation d'une annulée → on reprend
                if (previous && Array.isArray(previous.items)) {
                    if (status === 'CANCELLED' && previous.status !== 'CANCELLED') {
                        await db.restockItems(tenantId, previous.items);
                    } else if (previous.status === 'CANCELLED' && status !== 'CANCELLED') {
                        const result = await db.decrementStockForItems(tenantId, previous.items);
                        if (!result.ok) {
                            // On ne bloque pas la réactivation, mais le vendeur doit savoir
                            await db.logActivity(tenantId, 'warning',
                                `Commande ${orderId.split('-')[1]} réactivée mais stock insuffisant pour certains articles`,
                                { orderId, failures: result.failures });
                        }
                    }
                }

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

    /** Pagination des produits — renvoie { items, total } */
    getProductsPaged: async (tenantId: string, page: number, limit: number): Promise<{ items: Product[]; total: number }> => {
        if (!isSupabaseEnabled || !supabase) {
            throw new Error('Supabase is not enabled');
        }
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        try {
            const { data, error, count } = await supabase
                .from('products')
                .select('*', { count: 'exact' })
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            const items = (data || []).map((p: any) => ({
                ...p,
                minPrice: p.min_price,
                tenantId: p.tenant_id,
                variations: p.variations || [],
                aiInstructions: p.ai_instructions,
                manageStock: p.manage_stock ?? true
            })) as Product[];
            return { items, total: count ?? items.length };
        } catch (e: any) {
            console.error('[DB] Supabase getProductsPaged failed:', e);
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
                if (error) {
                    console.error('[DB] Delete Product Failed:', error);
                    return false;
                }
                return true;
            } catch (e) {
                // On NE retombe PLUS sur le fichier local : un échec ici signalerait
                // "supprimé" au vendeur alors que le produit resterait bien réel dans
                // Supabase (visible/vendable ailleurs, incohérent avec le dashboard).
                console.error('[DB] Delete Product Exception:', e);
                return false;
            }
        }

        // Mode local UNIQUEMENT si Supabase n'est pas configuré du tout (dev/offline).
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

    // --- STOCK (décrément atomique à la commande, restock à l'annulation) ---

    /**
     * Décrémente le stock de chaque article (produit + options de variation).
     * Passe par la fonction SQL atomique `adjust_stock` (verrou de ligne) avec
     * fallback JS non-atomique si la migration n'est pas encore appliquée.
     * En cas d'échec partiel, les décréments déjà faits sont RENDUS (rollback).
     */
    decrementStockForItems: async (tenantId: string, items: CartItem[]): Promise<{ ok: true } | { ok: false; failures: StockFailure[] }> => {
        const productItems = items.filter(i => i.productId !== DELIVERY_ITEM_ID);
        const succeeded: CartItem[] = [];
        const failures: StockFailure[] = [];

        for (const item of productItems) {
            const result = await adjustStock(tenantId, item, -item.quantity);
            if (result.ok) {
                succeeded.push(item);
            } else {
                failures.push({
                    productId: item.productId,
                    productName: item.productName,
                    requested: item.quantity,
                    available: result.available,
                });
            }
        }

        if (failures.length > 0) {
            // Rollback des articles déjà décrémentés pour rester cohérent
            for (const item of succeeded) {
                await adjustStock(tenantId, item, item.quantity);
            }
            return { ok: false, failures };
        }
        return { ok: true };
    },

    /** Rend le stock des articles (annulation de commande, échec de création). */
    restockItems: async (tenantId: string, items: CartItem[]): Promise<void> => {
        for (const item of items.filter(i => i.productId !== DELIVERY_ITEM_ID)) {
            await adjustStock(tenantId, item, item.quantity);
        }
    },

    getOrderById: async (tenantId: string, orderId: string): Promise<Order | null> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .eq('id', orderId)
                    .maybeSingle();
                if (error) throw error;
                if (!data) return null;
                return {
                    id: data.id,
                    tenantId: data.tenant_id,
                    userId: data.user_id,
                    items: data.items,
                    total: data.total,
                    status: data.status,
                    address: data.address,
                    createdAt: new Date(data.created_at),
                } as Order;
            } catch (e) {
                console.error('[DB] getOrderById failed', e);
                return null;
            }
        }
        return (localData.orders.find((o: any) => o.tenantId === tenantId && o.id === orderId) as Order) || null;
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
                    return mapDbSettingsToSettings(data);
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
                if (settings.botActive !== undefined) dbSettings.bot_active = settings.botActive;
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
                if (settings.settlementBank !== undefined) dbSettings.settlement_bank = settings.settlementBank;
                if (settings.settlementAccount !== undefined) dbSettings.settlement_account = settings.settlementAccount;
                if (settings.negotiationMargin !== undefined) dbSettings.negotiation_margin = settings.negotiationMargin;
                dbSettings.updated_at = new Date().toISOString();

                console.log('[DB] Updating Settings for tenant:', tenantId, dbSettings);

                const { data, error } = await supabase
                    .from('settings')
                    .upsert(dbSettings, { onConflict: 'tenant_id' })
                    .select()
                    .single();

                if (error) throw error;

                if (data) {
                    return mapDbSettingsToSettings(data);
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

    /** Email du propriétaire d'un tenant (pour les alertes : bot déconnecté, etc.) */
    getOwnerEmail: async (tenantId: string): Promise<string | null> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('email')
                    .eq('tenant_id', tenantId)
                    .eq('role', 'owner')
                    .limit(1)
                    .maybeSingle();
                if (error) throw error;
                return data?.email || null;
            } catch (e) {
                console.error('[DB] getOwnerEmail Error:', e);
                return null;
            }
        }
        return null;
    },

    /** Anti-fraude : vérifie si une référence de transaction a déjà servi à valider un paiement */
    isTransactionIdUsed: async (tenantId: string, transactionId: string): Promise<boolean> => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { data, error } = await supabase
                    .from('activity_logs')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .eq('type', 'sale')
                    .eq('metadata->>transactionId', transactionId)
                    .limit(1);
                if (error) throw error;
                return (data || []).length > 0;
            } catch (e) {
                console.error('[DB] isTransactionIdUsed Error:', e);
                // En cas de doute, on considère la réf inconnue (validation manuelle restera possible)
                return false;
            }
        }
        return false;
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
            // Map snake_case to camelCase for frontend
            return (data || []).map(o => ({
                id: o.id,
                userId: o.user_id,
                items: o.items,
                total: o.total,
                status: o.status,
                address: o.address,
                createdAt: o.created_at
            }));
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

    /**
     * L'abonnement du tenant est-il actif (donc le bot doit-il répondre) ?
     * Même logique que le middleware `checkSubscription` (auth.ts) pour que le
     * dashboard et le bot WhatsApp soient TOUJOURS d'accord. En cas d'absence
     * d'abonnement ou d'erreur DB, on ne bloque PAS (priorité au service).
     */
    isSubscriptionActive: async (tenantId: string): Promise<boolean> => {
        try {
            const sub = await tenantService.getSubscriptionByTenantId(tenantId);
            if (!sub) return true; // trial créé à l'inscription ; pas de ligne = on laisse passer
            if (sub.status === 'expired' || sub.status === 'cancelled') return false;
            if (new Date(sub.expiresAt) < new Date()) return false;
            return true;
        } catch (e) {
            console.error('[isSubscriptionActive] Error — bot laissé actif par défaut:', e);
            return true;
        }
    },

    // Default Settings Creation
    createDefaultSettings: tenantService.createDefaultSettings,

    // Auth Tokens (OTP / Resets)
    storeAuthToken: async (identifier: string, tokenType: 'EMAIL_OTP' | 'PASSWORD_RESET', tokenValue: string, expiresAt: Date) => {
        if (isSupabaseEnabled && supabase) {
            try {
                const { error } = await supabase.from('auth_tokens').insert([{
                    identifier,
                    token_type: tokenType,
                    token_value: tokenValue,
                    expires_at: expiresAt.toISOString()
                }]);
                if (error) throw error;
                return;
            } catch (e) {
                console.error('[DB] storeAuthToken Failed, fallback to local', e);
            }
        }

        // Remove existing tokens for this identifier+type to prevent clutter
        localData.authTokens = localData.authTokens.filter(t => !(t.identifier === identifier && t.tokenType === tokenType));
        localData.authTokens.push({
            identifier, tokenType, tokenValue, expiresAt: expiresAt.toISOString()
        });
        saveData();
    },

    verifyAuthToken: async (identifierOrTokenValue: string, tokenType: 'EMAIL_OTP' | 'PASSWORD_RESET', valueToMatch?: string): Promise<{ valid: boolean, identifier?: string }> => {
        const now = new Date().toISOString();

        if (isSupabaseEnabled && supabase) {
            try {
                let query = supabase.from('auth_tokens').select('*').eq('token_type', tokenType).gt('expires_at', now);

                if (tokenType === 'EMAIL_OTP') {
                    // For OTP, we check by identifier (email) and match the value
                    query = query.eq('identifier', identifierOrTokenValue).eq('token_value', valueToMatch);
                } else {
                    // For Password Reset, we check by the token value itself
                    query = query.eq('token_value', identifierOrTokenValue);
                }

                const { data, error } = await query.single();
                if (!error && data) return { valid: true, identifier: data.identifier };
                // Pas trouvé (ou erreur) côté Supabase : on NE renvoie PAS invalid ici —
                // le token peut avoir été écrit uniquement en local si storeAuthToken
                // avait échoué sur Supabase au moment de l'envoi. On tombe donc sur la
                // vérification locale ci-dessous avant de conclure à un échec.
            } catch (e) {
                console.warn('[DB] verifyAuthToken Failed, checking local map', e);
            }
        }

        // Local DB Check
        const token = localData.authTokens.find(t => {
            if (t.tokenType !== tokenType || t.expiresAt <= now) return false;
            if (tokenType === 'EMAIL_OTP') {
                return t.identifier === identifierOrTokenValue && t.tokenValue === valueToMatch;
            } else {
                return t.tokenValue === identifierOrTokenValue; // Reset token
            }
        });

        if (token) return { valid: true, identifier: token.identifier };
        return { valid: false };
    },

    deleteAuthToken: async (identifierOrTokenValue: string, tokenType: 'EMAIL_OTP' | 'PASSWORD_RESET') => {
        if (isSupabaseEnabled && supabase) {
            try {
                let query = supabase.from('auth_tokens').delete().eq('token_type', tokenType);
                if (tokenType === 'EMAIL_OTP') {
                    query = query.eq('identifier', identifierOrTokenValue);
                } else {
                    query = query.eq('token_value', identifierOrTokenValue);
                }
                await query;
            } catch (e) {
                console.error('[DB] deleteAuthToken Failed', e);
            }
        }

        localData.authTokens = localData.authTokens.filter(t => {
            if (t.tokenType !== tokenType) return true; // KEEP
            if (tokenType === 'EMAIL_OTP') return t.identifier !== identifierOrTokenValue;
            return t.tokenValue !== identifierOrTokenValue;
        });
        saveData();
    }
};
