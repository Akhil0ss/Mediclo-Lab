'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, database, googleProvider } from '@/lib/firebase';
import Link from 'next/link';
import LegalModal from '@/components/LegalModals';

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'privacy' | 'terms' }>({
        isOpen: false,
        type: 'privacy'
    });
    const router = useRouter();

    const initializeUser = async (userId: string, userName: string) => {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);

        await set(ref(database, `users/${userId}/subscription`), {
            premium: false,
            trialStartDate: new Date().toISOString(),
            trialEndDate: trialEndDate.toISOString(),
            createdAt: new Date().toISOString()
        });

        await set(ref(database, `users/${userId}/branding`), {
            labName: 'My Medical Center',
            tagline: 'Quality Healthcare Services',
            address: '',
            contact: '',
            email: email,
            website: '',
            director: userName,
            footerNotes: 'This is a computer-generated report.',
            pdfTheme: 'blue',
            createdAt: new Date().toISOString()
        });
    };

    const handleEmailRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!agreed) {
            setError('Please accept the Privacy Policy and Terms of Service to continue.');
            setLoading(false);
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            await initializeUser(userCredential.user.uid, name);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleRegister = async () => {
        setLoading(true);
        setError('');

        if (!agreed) {
            setError('Please accept the Privacy Policy and Terms of Service to continue.');
            setLoading(false);
            return;
        }

        try {
            const result = await signInWithPopup(auth, googleProvider);
            await initializeUser(result.user.uid, result.user.displayName || 'User');
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Google registration failed');
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
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">Spotnet MedOS</h1>
                    <p className="text-purple-200">Start your 7-day free trial</p>
                </div>

                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Create Account</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm animate-pulse">
                            <i className="fas fa-exclamation-circle mr-2"></i>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleEmailRegister} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                                placeholder="Dr. John Doe"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                                placeholder="your@email.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                                placeholder="••••••••"
                            />
                            <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
                        </div>

                        {/* Terms and Privacy Checkbox */}
                        <div className="flex items-start gap-3 mt-4 mb-4">
                            <div className="flex items-center h-5">
                                <input
                                    id="terms"
                                    type="checkbox"
                                    checked={agreed}
                                    onChange={(e) => setAgreed(e.target.checked)}
                                    className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-purple-300 cursor-pointer"
                                />
                            </div>
                            <label htmlFor="terms" className="text-sm text-gray-600">
                                I agree to the{' '}
                                <button type="button" onClick={() => setLegalModal({ isOpen: true, type: 'terms' })} className="font-medium text-purple-600 hover:underline">
                                    Terms of Service
                                </button>
                                {' '}and{' '}
                                <button type="button" onClick={() => setLegalModal({ isOpen: true, type: 'privacy' })} className="font-medium text-purple-600 hover:underline">
                                    Privacy Policy
                                </button>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition shadow-lg ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or continue with</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGoogleRegister}
                        disabled={loading}
                        className="w-full mb-4 flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 hover:border-gray-400 transition disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Sign up with Google
                    </button>

                    <p className="mt-6 text-center text-sm text-gray-600">
                        Already have an account?{' '}
                        <Link href="/login" className="text-purple-600 font-semibold hover:text-purple-700">
                            Sign in
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
