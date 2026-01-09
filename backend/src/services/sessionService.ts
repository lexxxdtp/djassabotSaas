import { supabase, isSupabaseEnabled } from '../config/supabase';

export interface Session {
    id: string; // composite key: tenantId:userId
    userId: string;
    tenantId: string;
    history: { role: 'user' | 'model'; parts: { text: string }[] }[];
    state: 'IDLE' | 'WAITING_FOR_ADDRESS' | 'WAITING_FOR_NAME';
    tempOrder?: any;
    lastInteraction: Date;
    reminderSent?: boolean;
}

// In-memory fallback ONLY if Supabase is disabled/fails (not recommended for prod)
const localSessions: Record<string, Session> = {};

const getSessionId = (tenantId: string, userId: string) => `${tenantId}:${userId}`;

export const getSession = async (tenantId: string, userId: string): Promise<Session> => {
    const sessionId = getSessionId(tenantId, userId);

    if (isSupabaseEnabled && supabase) {
        try {
            const { data, error } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (data) {
                return {
                    id: data.id,
                    userId: data.user_phone,
                    tenantId: data.tenant_id,
                    history: typeof data.history === 'string' ? JSON.parse(data.history) : data.history || [],
                    state: data.state as any,
                    tempOrder: typeof data.temp_order === 'string' ? JSON.parse(data.temp_order) : data.temp_order,
                    lastInteraction: new Date(data.last_interaction),
                    reminderSent: data.reminder_sent
                };
            }
        } catch (e) {
            console.error('[Session] Error fetching from DB:', e);
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

    await saveSessionToDb(session);
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
                    reminderSent: d.reminder_sent
                }));
            }
        } catch (e) { console.error(e); }
    }
    return Object.values(localSessions);
};

// Helper to save/upsert to DB
const saveSessionToDb = async (session: Session) => {
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
                temp_order: session.tempOrder,
                last_interaction: session.lastInteraction,
                reminder_sent: session.reminderSent || false,
                updated_at: new Date()
            };

            const { error } = await supabase
                .from('sessions')
                .upsert(payload);

            if (error) throw error;
        } catch (e) {
            console.error('[Session] Error saving to DB:', e);
        }
    }
};

