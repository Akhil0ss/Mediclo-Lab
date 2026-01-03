'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, database } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import { useRouter } from 'next/navigation';

interface UserProfile {
    role: 'receptionist' | 'doctor' | 'pharmacy' | 'lab' | 'patient' | 'admin' | 'owner';
    name: string;
    email: string;
    doctorId?: string;
    labName?: string;
    setupCompleted?: boolean;
    ownerId?: string;
}

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userProfile: null,
    loading: true
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // 0. PATIENT PORTAL AUTH (Robust "Staff-Style" LocalStorage Check) - PRIORITY 1
        // This ensures patient state is hydrated immediately without waiting for Firebase
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/patient')) {
            const patientMobile = localStorage.getItem('patient_mobile');

            if (patientMobile) {
                console.log('🔍 AuthContext: Patient session detected', { mobile: patientMobile });
                // Hydrate state immediately from localStorage
                // This prevents "flicker" and ensures components have user data
                setUser({
                    uid: localStorage.getItem('patient_id') || 'patient_guest',
                    isAnonymous: true // Mark as anonymous/patient
                } as any);

                setUserProfile({
                    role: 'patient',
                    name: localStorage.getItem('patient_name') || 'Patient',
                    email: '',
                    ownerId: localStorage.getItem('patient_owner_id') || undefined
                });
            } else {
                // No patient session found
                // We do NOT redirect here, we let the individual pages handle it
                // because /patient (login) does not need a session
            }

            setLoading(false);
            return; // STOP - Do not run other auth logic for patient pages
        }

        // Verify pages - Public Access (No Auth needed)
        // We skip auth for Verify to prevent loading delays
        // NOTE: We do NOT skip /print/ anymore, because we need Auth to identify Owners/Staff
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/verify/')) {
            setLoading(false);
            return;
        }

        const authMethod = localStorage.getItem('authMethod');

        if (authMethod === 'username') {
            // Internal username/password authentication - fully independent from Firebase Auth
            const role = localStorage.getItem('userRole') as UserProfile['role'] | null;
            const username = localStorage.getItem('username');
            const userName = localStorage.getItem('userName');
            const userId = localStorage.getItem('userId');
            const doctorId = localStorage.getItem('doctorId');
            const ownerId = localStorage.getItem('ownerId');

            console.log('🔍 AuthContext: Username login detected', {
                role,
                username,
                userId,
                ownerId,
                hasOwnerId: !!ownerId
            });

            if (role && username && userId) {
                setUser({ uid: userId } as any);
                setUserProfile({
                    role,
                    name: userName || username,
                    email: '',
                    doctorId: doctorId || undefined,
                    ownerId: ownerId || undefined
                });

                // Run data cleanup in background (non-blocking)
                if (typeof window !== 'undefined') {
                    import('@/lib/dataCleanup').then(({ runDataCleanup }) => {
                        const cleanupUserId = username || userId || '';
                        const cleanupOwnerId = ownerId || userId || '';
                        runDataCleanup(cleanupUserId, cleanupOwnerId).catch(console.error);
                    });
                }

                // --- INTERNAL USER SESSION MONITORING ---
                // Monitor session to enforce single-device login
                // Use sessionId (Firebase UID) not userId (username)
                const sessionId = localStorage.getItem('sessionId');
                let unsubSession: (() => void) | undefined;

                if (sessionId) {
                    const sessionRef = ref(database, `sessions/${sessionId}`);

                    unsubSession = onValue(sessionRef, async (snapshot) => {
                        if (!snapshot.exists()) {
                            // Session was deleted - another device logged in
                            console.warn('⚠️ Session deleted remotely. Logging out.');

                            // Sign out from Firebase Auth first to prevent redirect to setup-profile
                            const { signOut } = await import('firebase/auth');
                            const { auth } = await import('@/lib/firebase');
                            await signOut(auth);

                            localStorage.clear();
                            window.location.href = '/login?reason=session_expired';
                        } else {
                            const data = snapshot.val();
                            // Verify this session still belongs to our username
                            if (data.username !== username) {
                                console.warn('⚠️ Session username mismatch. Logging out.');

                                // Sign out from Firebase Auth first
                                const { signOut } = await import('firebase/auth');
                                const { auth } = await import('@/lib/firebase');
                                await signOut(auth);

                                localStorage.clear();
                                window.location.href = '/login?reason=session_replaced';
                            }
                        }
                    }, (error) => {
                        console.warn("⚠️ Session monitor error (internal):", error);
                    });
                }

                setLoading(false);

                // Return cleanup function
                return () => {
                    if (unsubSession) {
                        unsubSession();
                    }
                };
            } else {
                // Invalid session, redirect to login
                setLoading(false);
                if (typeof window !== 'undefined' &&
                    !window.location.pathname.includes('/login') &&
                    !window.location.pathname.startsWith('/patient') && // CRITICAL: Never redirect patient pages
                    !window.location.pathname.startsWith('/print/') && // CRITICAL: Never redirect print pages
                    window.location.pathname !== '/') {
                    router.push('/login');
                }
            }
            return; // Don't set up Firebase Auth listener for internal auth
        }

        // Google authentication - uses Firebase Auth
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            let unsubSession: (() => void) | undefined;

            if (firebaseUser) {
                // CRITICAL: Check localStorage BEFORE everything else
                const authMethod = typeof window !== 'undefined' ? localStorage.getItem('authMethod') : null;
                const storedRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;
                const isPatient = typeof window !== 'undefined' && localStorage.getItem('patient_mobile');

                // Check if this is an anonymous user (staff) - even if localStorage is cleared
                const isAnonymousUser = firebaseUser.isAnonymous;

                // If anonymous user but no authMethod, they were logged out - redirect to login
                // CRITICAL: Do NOT redirect if on patient pages or print pages
                if (isAnonymousUser && !authMethod && !isPatient) {
                    // Check path protections
                    if (typeof window !== 'undefined' &&
                        (window.location.pathname.startsWith('/patient') ||
                            window.location.pathname.startsWith('/print/') ||
                            window.location.pathname.startsWith('/verify/'))) {
                        console.log('Anonymous user on protected path - not redirecting');
                        // Do not redirect
                    } else {
                        console.log('Anonymous user with no authMethod - redirecting to login');
                        setLoading(false);
                        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                            window.location.href = '/login';
                        }
                        return;
                    }
                }

                // --- SESSION MANAGEMENT START (GOOGLE USERS ONLY) ---
                // Only run for Google auth users, NOT for internal username auth
                if (typeof window !== 'undefined' && !isPatient && authMethod !== 'username' && !isAnonymousUser) {
                    const sessionRef = ref(database, `sessions/${firebaseUser.uid}`);

                    // 1. Get or Create Local Session ID
                    let localSessionId = localStorage.getItem('app_session_id');
                    if (!localSessionId) {
                        localSessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        localStorage.setItem('app_session_id', localSessionId);

                        // New login on this device -> Update Firebase
                        // We use 'update' to preserve other session data like role/name if they exist
                        const { update } = await import('firebase/database');
                        await update(sessionRef, {
                            sessionId: localSessionId,
                            lastActive: new Date().toISOString(),
                            device: navigator.userAgent
                        });
                    }

                    // 2. Listen for remote session changes
                    unsubSession = onValue(sessionRef, async (snapshot) => {
                        if (snapshot.exists()) {
                            const data = snapshot.val();
                            // If remote session ID exists and is different from local -> LOGOUT
                            if (data.sessionId && data.sessionId !== localSessionId) {
                                console.warn('Duplicate session detected. Logging out.');

                                // Prevent infinite loops by removing listener first if possible, 
                                // but simpler is to just nuke everything
                                await auth.signOut();
                                localStorage.clear();
                                window.location.href = '/login?reason=concurrent_login';
                            }
                        }
                    }, (error) => {
                        console.warn("⚠️ Session monitor error (google):", error);
                    });

                    // Ensure we write THIS session ID to Firebase if it's missing (e.g. fresh login)
                    // But be careful not to overwrite if we just got logged out.
                    // The initial check above handles the "new login" case.
                }
                // --- SESSION MANAGEMENT END ---


                // 🔒 STAFF USER SAFETY CHECK - Prevent ANY redirect to setup-profile
                const isStaffUser = authMethod === 'username' || (storedRole && ['doctor', 'pharmacy', 'lab', 'receptionist'].includes(storedRole));

                // Additional check: If Google user and no session exists, they're a new owner
                const isGoogleUser = authMethod !== 'username';
                const hasSession = false; // Will be set by session check above

                // 1. Patient Portal Check
                if (typeof window !== 'undefined' && window.location.pathname.startsWith('/patient')) {
                    setUserProfile({ role: 'patient', name: 'Patient', email: '' });
                    setLoading(false);
                    return;
                }

                // 2. Session Check (Staff/Doctor/Anonymous Logins)
                try {
                    const sessionRef = ref(database, `sessions/${firebaseUser.uid}`);
                    const sessionSnap = await get(sessionRef);

                    if (sessionSnap.exists()) {
                        const session = sessionSnap.val();
                        console.log('🔍 AuthContext: Session found', {
                            sessionUid: firebaseUser.uid,
                            session,
                            hasOwnerId: !!session.ownerId,
                            hasRole: !!session.role,
                            hasUsername: !!session.username
                        });

                        // Only use session if it has actual user data (role/username)
                        // Session created by session management only has sessionId/device/lastActive
                        if (session.role || session.username) {
                            setUserProfile({
                                role: session.role,
                                name: session.name || session.username,
                                email: '',
                                ownerId: session.ownerId
                            });
                            setLoading(false);
                            return;
                        } else {
                            console.log('⚠️ Session exists but has no user data, continuing to profile check');
                        }
                    } else {
                        console.log('⚠️ AuthContext: No session found for', firebaseUser.uid);
                    }
                } catch (e) {
                    console.error("Session check failed", e);
                }

                // 3. Owner Profile Check
                const profileRef = ref(database, `users/${firebaseUser.uid}/profile`);
                const unsubProfile = onValue(profileRef, (snapshot) => {
                    const profile = snapshot.val();

                    if (profile && profile.setupCompleted) {
                        setUserProfile(profile);
                        setLoading(false);
                    } else {
                        // ⚠️ CRITICAL DECISION POINT - Profile missing

                        // Clear potentially stale localStorage for Google users
                        if (authMethod !== 'username' && !isPatient) {
                            localStorage.removeItem('userRole');
                            localStorage.removeItem('userName');
                            localStorage.removeItem('ownerId');
                        }

                        // Re-check isStaffUser after clearing stale data
                        const currentAuthMethod = localStorage.getItem('authMethod');
                        const currentRole = localStorage.getItem('userRole');
                        const isCurrentlyStaff = currentAuthMethod === 'username' || (currentRole && ['doctor', 'pharmacy', 'lab', 'receptionist'].includes(currentRole));

                        if (isPatient) {
                            // Patient - redirect to patient dashboard
                            setUserProfile({ role: 'patient', name: 'Patient', email: '' });
                            setLoading(false);
                            if (typeof window !== 'undefined' &&
                                !window.location.pathname.startsWith('/patient') &&
                                !window.location.pathname.includes('/print/') &&
                                !window.location.pathname.includes('/verify/')
                            ) {
                                window.location.href = '/patient/dashboard';
                            }
                        } else if (isCurrentlyStaff) {
                            // 🛡️ STAFF - Create mock profile, stay on dashboard
                            console.log('✅ Staff user - creating profile from session');
                            const role = localStorage.getItem('userRole') as any || 'doctor';
                            const userName = localStorage.getItem('userName') || 'Staff User';
                            const userEmail = localStorage.getItem('username') || 'staff@example.com';

                            setUserProfile({
                                role: role,
                                name: userName,
                                email: userEmail,
                                setupCompleted: true, // Always true for staff
                                ownerId: localStorage.getItem('ownerId') || undefined
                            });
                            setLoading(false);
                        } else {
                            // New Owner (Google login, no profile, no staff markers)
                            // This is the ONLY case that goes to setup
                            console.log('New owner detected - proceeding to setup');
                            setUserProfile({
                                role: 'receptionist',
                                name: firebaseUser.displayName || 'User',
                                email: firebaseUser.email || ''
                            });
                            setLoading(false);

                            if (typeof window !== 'undefined' && !window.location.pathname.includes('/setup-profile')) {
                                window.location.href = '/setup-profile';
                            }
                        }
                    }
                }, (error) => {
                    console.warn("⚠️ Profile monitor error:", error);
                });

                return () => {
                    if (unsubProfile) unsubProfile();
                    if (unsubSession) unsubSession();
                };
            } else {
                setUserProfile(null);
                setLoading(false);

                // Clear localStorage on logout
                localStorage.removeItem('authMethod');
                localStorage.removeItem('userId');
                localStorage.removeItem('userRole');
                localStorage.removeItem('username');
                localStorage.removeItem('userName');
                localStorage.removeItem('doctorId');
                localStorage.removeItem('app_session_id'); // Clear session ID

                if (typeof window !== 'undefined' &&
                    !window.location.pathname.includes('/login') &&
                    !window.location.pathname.includes('/register') &&
                    !window.location.pathname.startsWith('/patient') && // Allow patient portal access
                    !window.location.pathname.includes('/print/') && // Allow public print access
                    !window.location.pathname.includes('/verify/') && // Allow public verification access
                    window.location.pathname !== '/') {
                    router.push('/login');
                }
            }
        });

        return () => unsubscribe();
    }, [router]);

    return (
        <AuthContext.Provider value={{ user, userProfile, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
