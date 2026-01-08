import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseEnabled } from '../config/supabase';
import { Tenant, User, Subscription } from '../types';

// Local fallback storage for dev/testing when Supabase is not ready
const localStore = {
    tenants: [] as Tenant[],
    users: [] as User[],
    subscriptions: [] as Subscription[],
    settings: [] as any[]
};

/**
 * TENANT MANAGEMENT FUNCTIONS
 */

export const createTenant = async (data: {
    name: string;
    businessType?: string;
}): Promise<Tenant> => {
    console.log('[createTenant] Called for:', data.name);
    const tenant: Tenant = {
        id: uuidv4(),
        name: data.name,
        businessType: data.businessType || 'boutique',
        status: 'trial',
        subscriptionTier: 'starter',
        whatsappConnected: false,
        whatsappStatus: 'disconnected',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    try {
        if (isSupabaseEnabled && supabase) {
            console.log('[createTenant] Attempting Supabase insert...');
            const { data: inserted, error } = await supabase
                .from('tenants')
                .insert(tenant)
                .select()
                .single();

            if (error) throw error;
            return inserted;
        }
    } catch (e: any) {
        console.warn('[Fallback] Supabase tenant creation failed:', e.message);
    }

    console.log('[createTenant] Saving to Local Store');
    localStore.tenants.push(tenant);
    return tenant;
};

export const getTenantById = async (id: string): Promise<Tenant | null> => {
    try {
        if (isSupabaseEnabled && supabase) {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', id)
                .single();

            if (!error) return data;
        }
    } catch (e) { }

    return localStore.tenants.find(t => t.id === id) || null;
};

export const getActiveTenants = async (): Promise<Tenant[]> => {
    try {
        if (isSupabaseEnabled && supabase) {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .in('status', ['active', 'trial']);

            if (!error) return data || [];
        }
    } catch (e) { }

    return localStore.tenants.filter(t => ['active', 'trial'].includes(t.status));
};

export const updateTenantWhatsAppStatus = async (
    tenantId: string,
    status: 'connected' | 'disconnected',
    phoneNumber?: string
): Promise<void> => {
    try {
        if (isSupabaseEnabled && supabase) {
            await supabase
                .from('tenants')
                .update({
                    whatsapp_connected: status === 'connected',
                    whatsapp_status: status,
                    whatsapp_phone_number: phoneNumber,
                    updated_at: new Date()
                })
                .eq('id', tenantId);
        }
    } catch (e) { }

    const tenant = localStore.tenants.find(t => t.id === tenantId);
    if (tenant) {
        tenant.whatsappConnected = status === 'connected';
        tenant.whatsappStatus = status;
        tenant.whatsappPhoneNumber = phoneNumber;
        tenant.updatedAt = new Date();
    }
};

export const updateTenantQRCode = async (tenantId: string, qrCode: string): Promise<void> => {
    console.log(`[QR Code] Tenant ${tenantId}: ${qrCode.substring(0, 50)}...`);
};

/**
 * USER MANAGEMENT FUNCTIONS
 */

export const createUser = async (data: {
    tenantId: string;
    email: string;
    passwordHash: string;
    role?: 'owner' | 'admin' | 'staff';
}): Promise<User> => {
    console.log('[createUser] Called for:', data.email);
    const user: User = {
        id: uuidv4(),
        tenantId: data.tenantId,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role || 'owner',
        createdAt: new Date()
    };

    try {
        if (isSupabaseEnabled && supabase) {
            console.log('[createUser] Attempting Supabase insert...');
            const { data: inserted, error } = await supabase
                .from('users')
                .insert(user)
                .select()
                .single();

            if (error) throw error;
            return inserted;
        }
    } catch (e: any) {
        console.warn('[Fallback] Supabase user creation failed:', e.message);
    }

    console.log('[createUser] Saving to Local Store');
    localStore.users.push(user);
    return user;
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
    try {
        if (isSupabaseEnabled && supabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (!error) return data;
        }
    } catch (e) { }

    return localStore.users.find(u => u.email === email) || null;
};

export const getUserById = async (id: string): Promise<User | null> => {
    try {
        if (isSupabaseEnabled && supabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();

            if (!error) return data;
        }
    } catch (e) { }

    return localStore.users.find(u => u.id === id) || null;
};

/**
 * SUBSCRIPTION MANAGEMENT FUNCTIONS
 */

export const createSubscription = async (data: {
    tenantId: string;
    plan: 'starter' | 'pro' | 'business';
    status?: 'active' | 'trial' | 'expired' | 'cancelled';
    expiresAt: Date;
}): Promise<Subscription> => {
    const subscription: Subscription = {
        id: uuidv4(),
        tenantId: data.tenantId,
        plan: data.plan,
        status: data.status || 'trial',
        startedAt: new Date(),
        expiresAt: data.expiresAt,
        autoRenew: true
    };

    try {
        if (isSupabaseEnabled && supabase) {
            const { data: inserted, error } = await supabase
                .from('subscriptions')
                .insert(subscription)
                .select()
                .single();

            if (error) throw error;
            return inserted;
        }
    } catch (e) {
        console.warn('[Fallback] Supabase sub creation failed');
    }

    localStore.subscriptions.push(subscription);
    return subscription;
};

export const getSubscriptionByTenantId = async (tenantId: string): Promise<Subscription | null> => {
    try {
        if (isSupabaseEnabled && supabase) {
            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!error) return data;
        }
    } catch (e) { }

    return localStore.subscriptions.find(s => s.tenantId === tenantId) || null;
};

/**
 * SETTINGS DEFAULT CREATION
 */

export const createDefaultSettings = async (tenantId: string, businessName: string): Promise<void> => {
    const settings = {
        id: uuidv4(),
        tenant_id: tenantId,
        bot_name: 'Assistant',
        business_name: businessName,
        business_description: `Bienvenue chez ${businessName}`,
        accepted_payments: JSON.stringify(['cash']),
        delivery_zones: JSON.stringify([]),
        specific_instructions: '',
        created_at: new Date(),
        updated_at: new Date()
    };

    try {
        if (isSupabaseEnabled && supabase) {
            await supabase
                .from('settings')
                .insert(settings);
            return;
        }
    } catch (e) {
        console.warn('[Fallback] Supabase settings creation failed');
    }

    // Also save settings to localStore if needed
    localStore.settings.push(settings);
};
