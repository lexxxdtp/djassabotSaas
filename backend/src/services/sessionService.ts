export interface Session {
    id: string; // composite key: tenantId:userId
    userId: string;
    tenantId: string;
    history: { role: 'user' | 'model'; parts: { text: string }[] }[];
    state: 'IDLE' | 'WAITING_FOR_ADDRESS' | 'WAITING_FOR_NAME';
    tempOrder?: any;
    lastInteraction: Date;
    reminderSent?: boolean; // Track if abandoned cart reminder was sent
}

const sessions: Record<string, Session> = {};

const getSessionKey = (tenantId: string, userId: string) => `${tenantId}:${userId}`;

export const getSession = (tenantId: string, userId: string): Session => {
    const key = getSessionKey(tenantId, userId);
    if (!sessions[key]) {
        sessions[key] = {
            id: key,
            userId,
            tenantId,
            history: [],
            state: 'IDLE',
            lastInteraction: new Date(),
        };
    }
    return sessions[key];
};

export const updateSession = (tenantId: string, userId: string, updates: Partial<Session>) => {
    const session = getSession(tenantId, userId);
    sessions[session.id] = { ...session, ...updates, lastInteraction: new Date() };
    return sessions[session.id];
};

export const addToHistory = (tenantId: string, userId: string, role: 'user' | 'model', text: string) => {
    const session = getSession(tenantId, userId);
    session.history.push({ role, parts: [{ text }] });
    session.lastInteraction = new Date();

    // Keep history manageable (last 10 turns)
    if (session.history.length > 20) {
        session.history = session.history.slice(-20);
    }
};

export const clearHistory = (tenantId: string, userId: string) => {
    const key = getSessionKey(tenantId, userId);
    if (sessions[key]) {
        sessions[key].history = [];
        sessions[key].state = 'IDLE';
        sessions[key].lastInteraction = new Date();
    }
}

export const getActiveSessions = () => Object.values(sessions);

