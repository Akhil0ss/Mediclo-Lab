'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue, set } from 'firebase/database';
import { database } from '@/lib/firebase';

export default function PatientPortal() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [mobile, setMobile] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showCredentials, setShowCredentials] = useState(false);
    const [credentials, setCredentials] = useState({ username: '', password: '' });

    // Ensure clean state on mount (sign out any previous sessions)
    // use dynamic import inside useEffect to avoid import issues
    useEffect(() => {
        const cleanupAuth = async () => {
            try {
                const { signOut } = await import('firebase/auth');
                const { auth } = await import('@/lib/firebase');
                if (auth.currentUser) {
                    await signOut(auth);
                }
            } catch (e) {
                console.log('Valid cleanup check');
            }
        };
        cleanupAuth();
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (mobile.length !== 10) {
            setError('Please enter a valid 10-digit mobile number');
            setLoading(false);
            return;
        }

        try {
            // Sign in anonymously first to ensure DB write permissions
            const { signInAnonymously } = await import('firebase/auth');
            const { auth } = await import('@/lib/firebase');
            await signInAnonymously(auth);

            // Check if patient portal account already exists
            const portalRef = ref(database, `patient_portal/${mobile}`);

            // Use get() instead of onValue for one-time check
            const { get } = await import('firebase/database');
            const snapshot = await get(portalRef);

            if (snapshot.exists()) {
                setError('This mobile number is already registered. Please login.');
                setLoading(false);
            } else {
                // Create new patient portal account
                const { generatePatientUsername } = await import('@/lib/userUtils');
                const cleanMobile = mobile.replace(/\D/g, '');
                // Username: spot@mobile (default brand for self-register is spot), Password: mobile
                const username = generatePatientUsername(cleanMobile, 'spot');
                const password = cleanMobile;

                await set(portalRef, {
                    name: name,
                    mobile: mobile,
                    username: username,
                    password: password,
                    createdAt: new Date().toISOString(),
                    hasLabRecords: false
                });

                // Show credentials to user
                setCredentials({ username, password });
                setShowCredentials(true);
                setLoading(false);
            }

        } catch (err) {
            console.error("Registration error:", err);
            setError('Registration failed. Please check your connection or contact support.');
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Step 1: Validate patient credentials via API
            const response = await fetch('/api/auth/patient-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password }),
            });

            if (!response.ok) {
                setError('Invalid credentials. Please check your username and password.');
                setLoading(false);
                return;
            }

            const data = await response.json();

            if (!data.success || !data.patient) {
                setError('Invalid credentials. Please check your username and password.');
                setLoading(false);
                return;
            }

            const patient = data.patient;

            // Step 2: Sign in anonymously to Firebase
            const { signInAnonymously } = await import('firebase/auth');
            const { auth } = await import('@/lib/firebase');
            const { ref, set, get, remove } = await import('firebase/database');
            const { generateDeviceFingerprint, getDeviceName } = await import('@/lib/deviceFingerprint');

            const authResult = await signInAnonymously(auth);
            const anonymousUID = authResult.user.uid;
            const deviceId = generateDeviceFingerprint();
            const deviceName = getDeviceName();

            // Step 3: Check for existing patient sessions (single-device security)
            const sessionsRef = ref(database, 'patientSessions');
            const sessionsSnapshot = await get(sessionsRef);

            if (sessionsSnapshot.exists()) {
                const sessions = sessionsSnapshot.val();
                // Remove any existing session for this patient
                for (const sessionId in sessions) {
                    if (sessions[sessionId].mobile === patient.mobile) {
                        await remove(ref(database, `patientSessions/${sessionId}`));
                        console.log(`Removed previous patient session for ${patient.mobile}`);
                    }
                }
            }

            // Step 4: Create new patient session
            await set(ref(database, `patientSessions/${anonymousUID}`), {
                mobile: patient.mobile,
                name: patient.name,
                patientId: patient.patientId,
                ownerId: patient.ownerId,
                deviceId: deviceId,
                deviceName: deviceName,
                loginAt: new Date().toISOString(),
                lastActive: new Date().toISOString()
            });

            // Step 5: Store session info in localStorage
            localStorage.setItem('patient_session_id', anonymousUID);
            localStorage.setItem('patient_mobile', patient.mobile);
            localStorage.setItem('patient_name', patient.name);
            localStorage.setItem('patient_id', patient.patientId);
            localStorage.setItem('patient_owner_id', patient.ownerId);

            // Step 6: Redirect to dashboard
            router.push('/patient/dashboard');

        } catch (err) {
            console.error('Login error:', err);
            setError('Login failed. Please try again.');
            setLoading(false);
        }
    };

    const checkPatientInLabs = async (mobile: string) => {
        // Check if this mobile number exists in any lab's patient records
        const usersRef = ref(database, 'users');

        onValue(usersRef, (snapshot) => {
            const users = snapshot.val();
            let foundPatient = false;
            let labId = '';
            let patientId = '';

            // Search through all labs
            for (const uid in users) {
                const patientsRef = ref(database, `patients/${uid}`);

                onValue(patientsRef, (patSnapshot) => {
                    const patients = patSnapshot.val();
                    if (patients) {
                        for (const pid in patients) {
                            if (patients[pid].mobile === mobile) {
                                foundPatient = true;
                                labId = uid;
                                patientId = pid;

                                // Update patient portal with link
                                const portalRef = ref(database, `patient_portal/${mobile}`);
                                set(portalRef, {
                                    ...snapshot.val(),
                                    hasLabRecords: true,
                                    linkedLab: labId,
                                    linkedPatientId: patientId
                                });
                                break;
                            }
                        }
                    }
                }, { onlyOnce: true });

                if (foundPatient) break;
            }
        }, { onlyOnce: true });
    };

    const proceedToDashboard = () => {
        localStorage.setItem('patient_mobile', mobile);
        localStorage.setItem('patient_name', name);
        router.push('/patient/dashboard');
    };

    if (showCredentials) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-check text-white text-3xl"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Registration Successful!</h2>
                        <p className="text-gray-600 mt-2">Save these credentials to login</p>
                    </div>

                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-6">
                        <div className="mb-4">
                            <label className="text-sm font-semibold text-gray-600 block mb-1">Username</label>
                            <div className="bg-white p-3 rounded border border-green-300 font-mono text-lg">
                                {credentials.username}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-600 block mb-1">Password</label>
                            <div className="bg-white p-3 rounded border border-green-300 font-mono text-lg">
                                {credentials.password}
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-yellow-800 flex items-start gap-2">
                            <i className="fas fa-exclamation-triangle mt-0.5"></i>
                            <span>Please save these credentials. You'll need them to login and view your reports.</span>
                        </p>
                    </div>

                    <button
                        onClick={proceedToDashboard}
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition"
                    >
                        Continue to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-blue-600 p-8 text-white text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-user-injured text-3xl"></i>
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Patient Portal</h1>
                    <p className="text-green-100">View Reports & Book Appointments</p>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setIsLogin(true)}
                        className={`flex-1 py-4 font-semibold transition ${isLogin
                            ? 'bg-white text-green-600 border-b-2 border-green-600'
                            : 'bg-gray-50 text-gray-600'
                            }`}
                    >
                        Login
                    </button>
                    <button
                        onClick={() => setIsLogin(false)}
                        className={`flex-1 py-4 font-semibold transition ${!isLogin
                            ? 'bg-white text-green-600 border-b-2 border-green-600'
                            : 'bg-gray-50 text-gray-600'
                            }`}
                    >
                        Register
                    </button>
                </div>

                {/* Form */}
                <div className="p-8">
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <form onSubmit={isLogin ? handleLogin : handleRegister}>
                        {isLogin ? (
                            <>
                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Username / Mobile
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter username or mobile"
                                        required
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                                    />
                                </div>

                                <div className="mb-6">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                        required
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        💡 Use the username (e.g. spot@987...) provided during registration.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Enter your full name"
                                        required
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                                    />
                                </div>

                                <div className="mb-6">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Mobile Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="Enter 10-digit mobile number"
                                        required
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        💡 Your mobile number will be your login password
                                    </p>
                                </div>
                            </>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-lg font-bold hover:from-green-700 hover:to-blue-700 transition disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin mr-2"></i>
                                    {isLogin ? 'Logging in...' : 'Creating Account...'}
                                </>
                            ) : (
                                <>
                                    {isLogin ? 'Login' : 'Create Account'}
                                </>
                            )}
                        </button>
                    </form>

                    {/* Info Box */}
                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            <i className="fas fa-info-circle mr-2"></i>
                            {isLogin
                                ? 'Use your mobile number to login and access your medical reports.'
                                : 'After registration, you can view lab reports and book appointments with doctors.'
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
