export interface Session {
    userId: string;
    history: { role: 'user' | 'model'; parts: { text: string }[] }[];
    state: 'IDLE' | 'WAITING_FOR_ADDRESS' | 'WAITING_FOR_NAME';
    tempOrder?: any;
}

const sessions: Record<string, Session> = {};

export const getSession = (userId: string): Session => {
    if (!sessions[userId]) {
        sessions[userId] = {
            userId,
            history: [],
            state: 'IDLE',
        };
    }
    return sessions[userId];
};

export const updateSession = (userId: string, updates: Partial<Session>) => {
    const session = getSession(userId);
    sessions[userId] = { ...session, ...updates };
    return sessions[userId];
};

export const addToHistory = (userId: string, role: 'user' | 'model', text: string) => {
    const session = getSession(userId);
    session.history.push({ role, parts: [{ text }] });

    // Keep history manageable (last 10 turns)
    if (session.history.length > 20) {
        session.history = session.history.slice(-20);
    }
};

export const clearHistory = (userId: string) => {
    if (sessions[userId]) {
        sessions[userId].history = [];
        sessions[userId].state = 'IDLE';
    }
}
