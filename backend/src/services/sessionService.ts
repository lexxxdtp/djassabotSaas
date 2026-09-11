import { randomUUID } from 'crypto';
import { supabase, isSupabaseEnabled } from '../config/supabase';
import { CartItem, SelectedVariation } from '../types';
import { simulationScope, SIMULATION_USER_ID } from './simulationContext';

export interface Session {
    id: string; // composite key: tenantId:userId
    userId: string;
    tenantId: string;
    history: { role: 'user' | 'model'; parts: { text: string }[] }[];
    state: 'IDLE' | 'WAITING_FOR_ADDRESS' | 'WAITING_FOR_NAME' | 'WAITING_FOR_VARIATION';
    tempOrder?: {
        items: CartItem[];
        total: number;
        summary: string;
        [key: string]: any;
    };
    lastInteraction: Date;
    reminderSent?: boolean;
    autopilotEnabled: boolean; // default true
}

// In-memory fallback ONLY if Supabase is disabled/fails (not recommended for prod)
const localSessions: Record<string, Session> = {};

const getSessionId = (tenantId: string, userId: string) => `${tenantId}:${userId}`;

export const getSession = async (tenantId: string, userId: string): Promise<Session> => {
    const sessionId = getSessionId(tenantId, userId);

    const simulation = simulationScope(tenantId);
    if (simulation) {
        if (userId !== SIMULATION_USER_ID) throw new Error('Identifiant de simulation invalide');
        simulation.session ??= {
            id: sessionId, tenantId, userId, history: [], state: 'IDLE',
            autopilotEnabled: true, lastInteraction: new Date(),
        };
        return simulation.session;
    }

    if (isSupabaseEnabled && supabase) {
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .maybeSingle();

        // Une lecture impossible ne doit PAS produire une session vide : cela
        // effacerait le panier et l'état d'un client en pleine commande, et le
        // bot repartirait de zéro comme s'il ne l'avait jamais vu.
        if (error) {
            throw new Error(`Lecture de session impossible (${sessionId}) : ${error.message}`);
        }

        if (data) {
            return {
                id: data.id,
                userId: data.user_phone,
                tenantId: data.tenant_id,
                history: typeof data.history === 'string' ? JSON.parse(data.history) : data.history || [],
                state: data.state as any,
                tempOrder: typeof data.temp_order === 'string' ? JSON.parse(data.temp_order) : data.temp_order,
                lastInteraction: new Date(data.last_interaction),
                autopilotEnabled: data.autopilot_enabled ?? true,
                reminderSent: data.reminder_sent ?? false
            };
        }
    }

    // Fallback or Create New
    // Check local fallback first
    if (localSessions[sessionId]) return localSessions[sessionId];

    // Create new session
    const newSession: Session = {
        id: sessionId,
        userId,
        tenantId,
        history: [],
        state: 'IDLE',
        autopilotEnabled: true,
        lastInteraction: new Date()
    };

    // Save to DB immediately to initialize
    await saveSessionToDb(newSession);

    return newSession;
};

export const updateSession = async (tenantId: string, userId: string, updates: Partial<Session>) => {
    let session = await getSession(tenantId, userId);

    // Apply updates
    session = { ...session, ...updates, lastInteraction: new Date() };

    // Persist
    await saveSessionToDb(session);

    return session;
};

export const addToHistory = async (tenantId: string, userId: string, role: 'user' | 'model', text: string) => {
    const session = await getSession(tenantId, userId);

    session.history.push({ role, parts: [{ text }] });
    session.lastInteraction = new Date();

    // Keep history manageable (last 20 turns)
    if (session.history.length > 20) {
        session.history = session.history.slice(-20);
    }

    // Perdre un tour de conversation ne doit pas annuler une réponse déjà envoyée.
    await saveSessionToDb(session, { critical: false });
};

export const clearHistory = async (tenantId: string, userId: string) => {
    const session = await getSession(tenantId, userId);
    session.history = [];
    session.state = 'IDLE';
    session.lastInteraction = new Date();
    session.tempOrder = undefined;

    await saveSessionToDb(session);
};

export const getActiveSessions = async (): Promise<Session[]> => {
    if (isSupabaseEnabled && supabase) {
        try {
            const { data } = await supabase
                .from('sessions')
                .select('*')
                // Optionally filter by last_interaction to avoid fetching stale sessions
                .gt('last_interaction', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24h

            if (data) {
                return data.map(d => ({
                    id: d.id,
                    userId: d.user_phone,
                    tenantId: d.tenant_id,
                    history: typeof d.history === 'string' ? JSON.parse(d.history) : d.history || [],
                    state: d.state as any,
                    tempOrder: typeof d.temp_order === 'string' ? JSON.parse(d.temp_order) : d.temp_order,
                    lastInteraction: new Date(d.last_interaction),
                    autopilotEnabled: d.autopilot_enabled ?? true,
                    reminderSent: d.reminder_sent ?? false
                }));
            }
        } catch (e) { console.error(e); }
    }
    return Object.values(localSessions);
};

/**
 * Sauvegarde la session.
 *
 * `critical` distingue deux natures d'écriture :
 * - critique (panier, état, validation) : un échec silencieux fait diverger la
 *   base de ce que le bot vient de dire au client. L'erreur remonte pour que
 *   l'appelant décide (le messageHandler répond « renvoyez votre message »).
 * - non critique (ajout à l'historique de conversation) : la perte d'un tour de
 *   discussion ne justifie pas d'annuler une réponse déjà envoyée.
 */
const saveSessionToDb = async (session: Session, { critical = true }: { critical?: boolean } = {}) => {
    const simulation = simulationScope(session.tenantId);
    if (simulation) {
        if (session.userId !== SIMULATION_USER_ID) throw new Error('Identifiant de simulation invalide');
        simulation.session = session;
        return;
    }
    // Update local cache/fallback
    localSessions[session.id] = session;

    if (isSupabaseEnabled && supabase) {
        try {
            const payload = {
                id: session.id,
                tenant_id: session.tenantId,
                user_phone: session.userId,
                state: session.state,
                history: session.history, // Supabase handles JSONB auto-conversion usually, or stringify if needed
                // undefined est omis en JSON : il laisserait l'ancien panier en base.
                temp_order: session.tempOrder ?? null,
                last_interaction: session.lastInteraction,
                reminder_sent: session.reminderSent || false,
                autopilot_enabled: session.autopilotEnabled ?? true,
                updated_at: new Date()
            };

            const { error } = await supabase
                .from('sessions')
                .upsert(payload);

            if (error) throw error;
        } catch (e) {
            console.error('[Session] Error saving to DB:', e);
            if (critical) {
                throw new Error(`Sauvegarde de session impossible (${session.id}) : ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
};



// --- Cart Management Helpers ---

const areVariationsEqual = (v1?: SelectedVariation[], v2?: SelectedVariation[]): boolean => {
    if (!v1 && !v2) return true;
    if (!v1 || !v2) return false;
    if (v1.length !== v2.length) return false;

    // Check if every variation in v1 exists in v2 with same value
    return v1.every(var1 =>
        v2?.some(var2 => var2.name === var1.name && var2.value === var1.value)
    );
};

export const addItemToSessionCart = async (tenantId: string, userId: string, newItem: CartItem) => {
    const session = await getSession(tenantId, userId);

    // Initialize items if missing (handle legacy structure where tempOrder might just be an object without items)
    let currentItems: CartItem[] = (session.tempOrder && Array.isArray(session.tempOrder.items))
        ? session.tempOrder.items
        : [];

    // Logic to merge
    const existingItemIndex = currentItems.findIndex(item =>
        item.productId === newItem.productId &&
        areVariationsEqual(item.selectedVariations, newItem.selectedVariations)
    );

    // Create a new array to ensure immutability/reactivity if needed, though for backend logic mutation is fine
    const updatedItems = [...currentItems];

    if (existingItemIndex > -1) {
        updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity + newItem.quantity
        };
    } else {
        updatedItems.push(newItem);
    }

    // Calculate new total
    const total = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Generate Summary
    const summary = updatedItems.map(i => {
        const vars = i.selectedVariations && i.selectedVariations.length > 0
            ? `(${i.selectedVariations.map(v => v.value).join(', ')})`
            : '';
        return `${i.quantity}x ${i.productName} ${vars}`;
    }).join('\n');

    const tempOrder = {
        ...session.tempOrder, // Keep other temp props if any
        items: updatedItems,
        total,
        summary,
        // Identifie CE panier, pas son contenu : deux validations du même panier
        // portent la même clé et ne peuvent produire qu'une commande. Un nouveau
        // panier plus tard obtient une autre clé et reste donc autorisé.
        idempotencyKey: session.tempOrder?.idempotencyKey ?? randomUUID(),
    };

    // Update the session
    // Note: Caller handles state transition if necessary (e.g. to WAITING_FOR_ADDRESS)
    await updateSession(tenantId, userId, {
        tempOrder
    });

    return tempOrder;
};
