'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { authenticateUser } from '@/lib/auth';
import Link from 'next/link';
import LegalModal from '@/components/LegalModals';

export default function LoginPage() {
    const [loginMethod, setLoginMethod] = useState<'google' | 'username'>('google');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreed, setAgreed] = useState(true); // Auto-accepted
    const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'privacy' | 'terms' }>({
        isOpen: false,
        type: 'privacy'
    });
    const router = useRouter();

    const handleUsernameLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!agreed) {
            setError('Please accept the Privacy Policy and Terms of Service to continue.');
            setLoading(false);
            return;
        }

        try {
            // Step 1: Validate credentials via API (no Firebase dependency)
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                setError('Invalid username or password');
                setLoading(false);
                return;
            }

            const data = await response.json();

            console.log('🔍 API Response:', data);

            if (!data.success || !data.user) {
                console.log('❌ Invalid response');
                setError('Invalid username or password');
                setLoading(false);
                return;
            }

            const user = data.user;
            console.log('✅ User data:', user);

            if (!user.isActive) {
                setError('Your account has been disabled. Please contact administrator.');
                setLoading(false);
                return;
            }

            // Step 2: Sign in anonymously to Firebase (independent of owner's Google login)
            const { signInAnonymously } = await import('firebase/auth');
            const { ref, set, get, remove } = await import('firebase/database');
            const { database } = await import('@/lib/firebase');
            const { generateDeviceFingerprint, getDeviceName } = await import('@/lib/deviceFingerprint');

            const authResult = await signInAnonymously(auth);
            const anonymousUID = authResult.user.uid;
            const deviceId = generateDeviceFingerprint();
            const deviceName = getDeviceName();

            // Step 3: Check for existing sessions (single-device security + cleanup)
            const sessionsRef = ref(database, 'sessions');
            const sessionsSnapshot = await get(sessionsRef);

            if (sessionsSnapshot.exists()) {
                const sessions = sessionsSnapshot.val();
                const now = new Date().getTime();
                const oneDayAgo = now - (24 * 60 * 60 * 1000); // Clean up after 1 day

                // Find and remove any existing session for this username
                for (const sessionId in sessions) {
                    const session = sessions[sessionId];

                    // Remove if same username (concurrent login)
                    if (session.username === user.username) {
                        await remove(ref(database, `sessions/${sessionId}`));
                        console.log(`Removed previous session for ${user.username}`);
                    }
                    // Also cleanup old sessions (>1 day) to prevent accumulation
                    else if (session.loginAt) {
                        const loginTime = new Date(session.loginAt).getTime();
                        if (loginTime < oneDayAgo) {
                            await remove(ref(database, `sessions/${sessionId}`));
                            console.log(`Cleaned up old session: ${sessionId}`);
                        }
                    }
                }
            }

            // Step 4: Create new session
            await set(ref(database, `sessions/${anonymousUID}`), {
                userId: user.userId,
                role: user.role,
                username: user.username,
                name: user.name,
                deviceId: deviceId,
                deviceName: deviceName,
                loginAt: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                doctorId: user.doctorId || null,
                ownerId: user.ownerId
            });

            // Step 4.5: Update user auth node with current sessionId for notifications
            const { update } = await import('firebase/database');
            let authPath = '';
            if (user.role === 'doctor' && user.doctorId) {
                authPath = `users/${user.ownerId}/auth/doctors/${user.doctorId}`;
            } else {
                authPath = `users/${user.ownerId}/auth/${user.role}`;
            }
            await update(ref(database, authPath), { currentSessionId: anonymousUID });

            // Step 5: Store session info in localStorage
            localStorage.setItem('authMethod', 'username');
            localStorage.setItem('sessionId', anonymousUID);
            localStorage.setItem('userId', user.userId);
            localStorage.setItem('userRole', user.role);
            localStorage.setItem('username', user.username);
            localStorage.setItem('userName', user.name);
            if (user.doctorId) {
                localStorage.setItem('doctorId', user.doctorId);
            }
            if (user.ownerId) {
                localStorage.setItem('ownerId', user.ownerId);
            }

            // Step 6: Redirect to Unified Dashboard
            window.location.href = '/dashboard';
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');

        if (!agreed) {
            setError('Please accept the Privacy Policy and Terms of Service to continue.');
            setLoading(false);
            return;
        }

        try {
            const result = await signInWithPopup(auth, googleProvider);

            // Store auth method
            localStorage.setItem('authMethod', 'google');

            // Check if setup is completed - will be handled by AuthContext
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Google login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-purple-800 flex items-center justify-center p-4">
            <LegalModal
                isOpen={legalModal.isOpen}
                type={legalModal.type}
                onClose={() => setLegalModal({ ...legalModal, isOpen: false })}
            />
            <div className="w-full max-w-md">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">Spotnet MedOS</h1>
                    <p className="text-purple-200">Advanced Lab & OPD Management System</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Welcome Back</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            <i className="fas fa-exclamation-circle mr-2"></i>
                            {error}
                        </div>
                    )}

                    {/* Login Method Toggle */}
                    <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setLoginMethod('google')}
                            className={`flex-1 py-2 px-4 rounded-md font-semibold transition ${loginMethod === 'google'
                                ? 'bg-white text-purple-600 shadow'
                                : 'text-gray-600 hover:text-gray-800'
                                }`}
                        >
                            <i className="fab fa-google mr-2"></i>Google
                        </button>
                        <button
                            onClick={() => setLoginMethod('username')}
                            className={`flex-1 py-2 px-4 rounded-md font-semibold transition ${loginMethod === 'username'
                                ? 'bg-white text-purple-600 shadow'
                                : 'text-gray-600 hover:text-gray-800'
                                }`}
                        >
                            <i className="fas fa-user mr-2"></i>Username
                        </button>
                    </div>

                    {loginMethod === 'google' ? (
                        <>
                            {/* Google Login */}
                            {/* Terms Checkbox */}
                            <div className="flex items-start gap-3 mb-4">
                                <div className="flex items-center h-5">
                                    <input
                                        id="terms-google"
                                        type="checkbox"
                                        checked={agreed}
                                        onChange={(e) => setAgreed(e.target.checked)}
                                        className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-purple-300 cursor-pointer"
                                    />
                                </div>
                                <label htmlFor="terms-google" className="text-sm text-gray-600">
                                    I agree to{' '}
                                    <button type="button" onClick={() => setLegalModal({ isOpen: true, type: 'terms' })} className="font-medium text-purple-600 hover:underline">
                                        Terms
                                    </button>
                                    {' '}and{' '}
                                    <button type="button" onClick={() => setLegalModal({ isOpen: true, type: 'privacy' })} className="font-medium text-purple-600 hover:underline">
                                        Privacy
                                    </button>
                                </label>
                            </div>

                            <button
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full mb-4 flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 hover:border-gray-400 transition disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                {loading ? 'Signing in...' : 'Continue with Google'}
                            </button>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                                <p className="text-xs text-blue-800">
                                    <i className="fas fa-info-circle mr-2"></i>
                                    <strong>First time?</strong> Sign in with Google to create your lab account.
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Username/Password Login */}
                            <form onSubmit={handleUsernameLogin} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <i className="fas fa-user text-purple-600 mr-2"></i>Username
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                                        placeholder="spot@receptionist"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Format: {'{lab}'}@receptionist, {'{lab}'}@lab, {'{lab}'}@pharmacy, {'{lab}'}@drname
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <i className="fas fa-lock text-purple-600 mr-2"></i>Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                                        placeholder="••••••••••••"
                                    />
                                </div>

                                {/* Terms Checkbox */}
                                <div className="flex items-start gap-3">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="terms-staff"
                                            type="checkbox"
                                            checked={agreed}
                                            onChange={(e) => setAgreed(e.target.checked)}
                                            className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-purple-300 cursor-pointer"
                                        />
                                    </div>
                                    <label htmlFor="terms-staff" className="text-sm text-gray-600">
                                        I agree to{' '}
                                        <button type="button" onClick={() => setLegalModal({ isOpen: true, type: 'terms' })} className="font-medium text-purple-600 hover:underline">
                                            Terms
                                        </button>
                                        {' '}and{' '}
                                        <button type="button" onClick={() => setLegalModal({ isOpen: true, type: 'privacy' })} className="font-medium text-purple-600 hover:underline">
                                            Privacy
                                        </button>
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50 shadow-lg"
                                >
                                    {loading ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin mr-2"></i>Signing in...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-sign-in-alt mr-2"></i>Sign In
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                                <p className="text-xs text-yellow-800">
                                    <i className="fas fa-info-circle mr-2"></i>
                                    <strong>Backup Login:</strong> Use this if Google login is not working.
                                    Contact your administrator if you forgot your password.
                                </p>
                            </div>
                        </>
                    )}

                    <p className="mt-6 text-center text-sm text-gray-600">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-purple-600 font-semibold hover:text-purple-700">
                            Sign up with Google
                        </Link>
                    </p>
                </div>

                <p className="mt-6 text-center text-sm text-purple-200">
                    © 2025 Spotnet Services | Powered by Spotnet MedOS
                </p>
            </div>
        </div>
    );
}
