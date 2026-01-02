// NEW SESSION-BASED AUTHENTICATION SYSTEM
import { ref, set, get, remove } from 'firebase/database';
import { database } from './firebase';

export interface SessionData {
    sessionId: string;
    userId: string;
    ownerId: string;
    role: 'owner' | 'doctor' | 'receptionist' | 'lab' | 'pharmacy' | 'patient';
    username: string;
    name: string;
    createdAt: string;
    expiresAt: string;
    lastActivity: string;
}

// Generate unique session ID
export function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Create new session in Firebase
export async function createSession(sessionData: Omit<SessionData, 'sessionId' | 'createdAt' | 'lastActivity'>): Promise<string> {
    const sessionId = generateSessionId();
    const now = new Date().toISOString();

    const fullSessionData: SessionData = {
        ...sessionData,
        sessionId,
        createdAt: now,
        lastActivity: now
    };

    // Store in Firebase under sessions/{sessionId}
    await set(ref(database, `sessions/${sessionId}`), fullSessionData);

    return sessionId;
}

// Get session from Firebase
export async function getSession(sessionId: string): Promise<SessionData | null> {
    if (!sessionId) return null;

    const sessionRef = ref(database, `sessions/${sessionId}`);
    const snapshot = await get(sessionRef);

    if (!snapshot.exists()) {
        return null;
    }

    const session = snapshot.val() as SessionData;

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
        await deleteSession(sessionId);
        return null;
    }

    // Update last activity
    await set(ref(database, `sessions/${sessionId}/lastActivity`), new Date().toISOString());

    return session;
}

// Delete session
export async function deleteSession(sessionId: string): Promise<void> {
    await remove(ref(database, `sessions/${sessionId}`));
}

// Validate session and return user data
export async function validateSession(sessionId: string | null): Promise<SessionData | null> {
    if (!sessionId) return null;
    return await getSession(sessionId);
}
