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

    if (isSupabaseEnabled && supabase) {
        console.log('[createTenant] Attempting Supabase insert...');
        const dbTenant = {
            id: tenant.id,
            name: tenant.name,
            business_type: tenant.businessType,
            status: tenant.status,
            subscription_tier: tenant.subscriptionTier,
            whatsapp_connected: tenant.whatsappConnected,
            whatsapp_status: tenant.whatsappStatus,
            created_at: tenant.createdAt,
            updated_at: tenant.updatedAt
        };

        const { data: inserted, error } = await supabase
            .from('tenants')
            .insert(dbTenant)
            .select()
            .single();

        if (error) {
            console.error('[createTenant] Supabase Error:', error);
            throw new Error(`Database Error (Tenants): ${error.message}`);
        }

        return {
            ...inserted,
            businessType: inserted.business_type,
            subscriptionTier: inserted.subscription_tier,
            whatsappConnected: inserted.whatsapp_connected,
            whatsappStatus: inserted.whatsapp_status,
            createdAt: new Date(inserted.created_at),
            updatedAt: new Date(inserted.updated_at)
        };
    }

    throw new Error('Database connection unavailable (Supabase Disabled).');
};

export const getTenantById = async (id: string): Promise<Tenant | null> => {
    try {
        if (isSupabaseEnabled && supabase) {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', id)
                .single();

            if (!error && data) {
                return {
                    id: data.id,
                    name: data.name,
                    businessType: data.business_type,
                    status: data.status,
                    subscriptionTier: data.subscription_tier,
                    whatsappConnected: data.whatsapp_connected,
                    whatsappPhoneNumber: data.whatsapp_phone_number,
                    whatsappStatus: data.whatsapp_status,
                    paystackSubaccountCode: data.paystack_subaccount_code,
                    createdAt: new Date(data.created_at),
                    updatedAt: new Date(data.updated_at)
                };
            }
        }
    } catch (e) {
        console.error('[getTenantById] Error:', e);
    }
    return null;
};

export const getActiveTenants = async (): Promise<Tenant[]> => {
    try {
        if (isSupabaseEnabled && supabase) {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .in('status', ['active', 'trial']);

            if (!error && data) {
                return data.map(d => ({
                    id: d.id,
                    name: d.name,
                    businessType: d.business_type,
                    status: d.status,
                    subscriptionTier: d.subscription_tier,
                    whatsappConnected: d.whatsapp_connected,
                    whatsappPhoneNumber: d.whatsapp_phone_number,
                    whatsappStatus: d.whatsapp_status,
                    paystackSubaccountCode: d.paystack_subaccount_code,
                    createdAt: new Date(d.created_at),
                    updatedAt: new Date(d.updated_at)
                }));
            }
        }
    } catch (e) {
        console.error('[getActiveTenants] Error:', e);
    }
    return [];
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
    } catch (e) {
        console.error('[updateTenantWhatsAppStatus] Error:', e);
    }
};

export const updateTenant = async (
    tenantId: string,
    updates: Partial<Tenant>
): Promise<Tenant | null> => {
    try {
        if (isSupabaseEnabled && supabase) {
            // Map camelCase to snake_case
            const dbUpdates: any = { updated_at: new Date() };
            if (updates.name !== undefined) dbUpdates.name = updates.name;
            if (updates.businessType !== undefined) dbUpdates.business_type = updates.businessType;
            if (updates.status !== undefined) dbUpdates.status = updates.status;
            if (updates.paystackSubaccountCode !== undefined) dbUpdates.paystack_subaccount_code = updates.paystackSubaccountCode;

            const { data, error } = await supabase
                .from('tenants')
                .update(dbUpdates)
                .eq('id', tenantId)
                .select()
                .single();

            if (!error && data) {
                return {
                    id: data.id,
                    name: data.name,
                    businessType: data.business_type,
                    status: data.status,
                    subscriptionTier: data.subscription_tier,
                    whatsappConnected: data.whatsapp_connected,
                    whatsappPhoneNumber: data.whatsapp_phone_number,
                    whatsappStatus: data.whatsapp_status,
                    paystackSubaccountCode: data.paystack_subaccount_code,
                    createdAt: new Date(data.created_at),
                    updatedAt: new Date(data.updated_at)
                };
            }
        }
    } catch (e) {
        console.error('[updateTenant] Error:', e);
    }
    return null;
};

export const updateTenantQRCode = async (tenantId: string, qrCode: string): Promise<void> => {
    console.log(`[QR Code] Tenant ${tenantId}: ${qrCode.substring(0, 50)}...`);
};

/**
 * USER MANAGEMENT FUNCTIONS
 */

export const createUser = async (data: {
    tenantId: string;
    email?: string | null;
    phone?: string | null;
    fullName?: string;
    birthDate?: string;
    passwordHash: string;
    role?: 'owner' | 'admin' | 'staff';
}): Promise<User> => {
    console.log('[createUser] Called for:', data.email || data.phone);
    const user: User = {
        id: uuidv4(),
        tenantId: data.tenantId,
        email: data.email || undefined,
        phone: data.phone || undefined,
        full_name: data.fullName,
        birth_date: data.birthDate ? new Date(data.birthDate) : undefined,
        passwordHash: data.passwordHash,
        role: data.role || 'owner',
        emailVerified: false,
        phoneVerified: false,
        createdAt: new Date()
    };

    if (isSupabaseEnabled && supabase) {
        console.log('[createUser] Attempting Supabase insert...');
        const dbUser = {
            id: user.id,
            tenant_id: user.tenantId,
            email: user.email,
            phone: user.phone,
            full_name: user.full_name,
            birth_date: user.birth_date,
            password_hash: user.passwordHash,
            role: user.role,
            email_verified: user.emailVerified,
            phone_verified: user.phoneVerified,
            created_at: user.createdAt
        };

        const { data: inserted, error } = await supabase
            .from('users')
            .insert(dbUser)
            .select()
            .single();

        if (error) {
            console.error('[createUser] Supabase Error:', error);
            throw new Error(`Database Error (Users): ${error.message}`);
        }

        return {
            ...inserted,
            tenantId: inserted.tenant_id,
            emailVerified: inserted.email_verified,
            phoneVerified: inserted.phone_verified,
            createdAt: new Date(inserted.created_at),
            passwordHash: inserted.password_hash
        };
    }

    throw new Error('Database connection unavailable (Supabase Disabled).');
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
    try {
        if (isSupabaseEnabled && supabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (!error && data) {
                return {
                    id: data.id,
                    tenantId: data.tenant_id,
                    email: data.email,
                    phone: data.phone,
                    full_name: data.full_name,
                    birth_date: data.birth_date ? new Date(data.birth_date) : undefined,
                    passwordHash: data.password_hash,
                    role: data.role,
                    emailVerified: data.email_verified,
                    phoneVerified: data.phone_verified,
                    createdAt: new Date(data.created_at)
                };
            }
        }
    } catch (e) {
        console.error('[getUserByEmail] Error:', e);
    }
    return null;
};

export const getUserByPhone = async (phone: string): Promise<User | null> => {
    try {
        if (isSupabaseEnabled && supabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('phone', phone)
                .single();

            if (!error && data) {
                return {
                    id: data.id,
                    tenantId: data.tenant_id,
                    email: data.email,
                    phone: data.phone,
                    full_name: data.full_name,
                    birth_date: data.birth_date ? new Date(data.birth_date) : undefined,
                    passwordHash: data.password_hash,
                    role: data.role,
                    emailVerified: data.email_verified,
                    phoneVerified: data.phone_verified,
                    createdAt: new Date(data.created_at)
                };
            }
        }
    } catch (e) {
        console.error('[getUserByPhone] Error:', e);
    }
    return null;
};

export const getUserById = async (id: string): Promise<User | null> => {
    try {
        if (isSupabaseEnabled && supabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();

            if (!error && data) {
                return {
                    id: data.id,
                    tenantId: data.tenant_id,
                    email: data.email,
                    phone: data.phone,
                    full_name: data.full_name,
                    birth_date: data.birth_date ? new Date(data.birth_date) : undefined,
                    passwordHash: data.password_hash,
                    role: data.role,
                    emailVerified: data.email_verified,
                    phoneVerified: data.phone_verified,
                    createdAt: new Date(data.created_at)
                };
            }
        }
    } catch (e) {
        console.error('[getUserById] Error:', e);
    }
    return null;
};

export const updateUser = async (id: string, updates: Partial<User>): Promise<User | null> => {
    try {
        if (isSupabaseEnabled && supabase) {
            const { id: _, tenantId: __, ...safeUpdates } = updates as any;

            // Map updates to snake_case if necessary
            const dbUpdates: any = { ...safeUpdates };
            if (safeUpdates.emailVerified !== undefined) dbUpdates.email_verified = safeUpdates.emailVerified;
            if (safeUpdates.phoneVerified !== undefined) dbUpdates.phone_verified = safeUpdates.phoneVerified;
            // Remove camelCase keys
            delete dbUpdates.emailVerified;
            delete dbUpdates.phoneVerified;

            const { data, error } = await supabase
                .from('users')
                .update(dbUpdates)
                .eq('id', id)
                .select()
                .single();

            if (!error && data) {
                return {
                    id: data.id,
                    tenantId: data.tenant_id,
                    email: data.email,
                    phone: data.phone,
                    full_name: data.full_name,
                    birth_date: data.birth_date ? new Date(data.birth_date) : undefined,
                    passwordHash: data.password_hash,
                    role: data.role,
                    emailVerified: data.email_verified,
                    phoneVerified: data.phone_verified,
                    createdAt: new Date(data.created_at)
                };
            }
        }
    } catch (e) {
        console.error('[updateUser] Error:', e);
    }
    return null;
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

    if (isSupabaseEnabled && supabase) {
        const dbSub = {
            id: subscription.id,
            tenant_id: subscription.tenantId,
            plan: subscription.plan,
            status: subscription.status,
            started_at: subscription.startedAt,
            expires_at: subscription.expiresAt,
            auto_renew: subscription.autoRenew
        };

        const { data: inserted, error } = await supabase
            .from('subscriptions')
            .insert(dbSub)
            .select()
            .single();

        if (error) {
            console.error('[createSubscription] Supabase Error:', error);
            throw new Error(`Database Error (Sub): ${error.message}`);
        }

        return {
            id: inserted.id,
            tenantId: inserted.tenant_id,
            plan: inserted.plan,
            status: inserted.status,
            startedAt: new Date(inserted.started_at),
            expiresAt: new Date(inserted.expires_at),
            autoRenew: inserted.auto_renew
        };
    }

    throw new Error('Database connection unavailable (Supabase Disabled).');
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
    } catch (e) {
        console.error('[getSubscriptionByTenantId] Error:', e);
    }
    return null;
};

/**
 * SETTINGS DEFAULT CREATION
 */

export const createDefaultSettings = async (tenantId: string, businessName: string): Promise<void> => {
    const settings = {
        tenant_id: tenantId,
        bot_name: 'Assistant',
        store_name: businessName, // Corrected from business_name
        policy_description: `Bienvenue chez ${businessName}`, // Corrected from business_description
        accepted_payments: ['cash', 'wave'], // Pass array directly for JSONB
        delivery_zones: [],
        system_instructions: '', // Corrected from specific_instructions
        created_at: new Date(),
        updated_at: new Date()
    };

    if (isSupabaseEnabled && supabase) {
        const { error } = await supabase
            .from('settings')
            .insert(settings);

        if (error) {
            console.error('[createDefaultSettings] DB Error:', error);
            // Don't throw here to avoid blocking signup, just log
        }
        return;
    }
};
