'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import LegalModal from '@/components/LegalModals';

export default function LoginPage() {
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // Only for signup
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreed, setAgreed] = useState(true); // Auto-accepted
    const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'privacy' | 'terms' }>({
        isOpen: false,
        type: 'privacy'
    });
    const router = useRouter();

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');

        if (!agreed) {
            setError('Please accept the Privacy Policy and Terms of Service to continue.');
            setLoading(false);
            return;
        }

        try {
            await signInWithPopup(auth, googleProvider);
            localStorage.setItem('authMethod', 'google');
            // AuthContext will automatically redirect to /setup-profile if profile is missing
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Google login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!agreed) {
            setError('Please accept the Privacy Policy and Terms of Service to continue.');
            setLoading(false);
            return;
        }

        try {
            if (isSignup) {
                // Sign Up
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Update Display Name
                if (name) {
                    await updateProfile(userCredential.user, {
                        displayName: name
                    });
                }
                localStorage.setItem('authMethod', 'email');
                router.push('/dashboard');
            } else {
                // Sign In
                await signInWithEmailAndPassword(auth, email, password);
                localStorage.setItem('authMethod', 'email');
                router.push('/dashboard');
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Email is already in use. Please sign in instead.');
            } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password should be at least 6 characters.');
            } else {
                setError(err.message || 'Authentication failed');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex w-full bg-white overflow-hidden">
            <LegalModal
                isOpen={legalModal.isOpen}
                type={legalModal.type}
                onClose={() => setLegalModal({ ...legalModal, isOpen: false })}
            />

            {/* Left Side - Hero / Branding (Windows Style) */}
            <div className="flex w-1/2 bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 relative overflow-hidden items-center justify-center text-white p-12">
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

                <div className="relative z-10 max-w-lg">
                    <div className="mb-10 flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-xl border border-white/20">
                            <i className="fas fa-flask text-3xl text-white"></i>
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold leading-tight">Spotnet MedOS</h1>
                            <p className="text-lg text-purple-200 font-light mt-1">
                                Laboratory Management System
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <i className="fas fa-chart-line text-blue-300"></i>
                            </div>
                            <div>
                                <h3 className="font-semibold">Lab Analytics</h3>
                                <p className="text-sm text-gray-300">Real-time insights and reports</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                <i className="fas fa-shield-halved text-green-300"></i>
                            </div>
                            <div>
                                <h3 className="font-semibold">Secure Data</h3>
                                <p className="text-sm text-gray-300">Enterprise-grade security</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                <i className="fas fa-file-medical text-orange-300"></i>
                            </div>
                            <div>
                                <h3 className="font-semibold">Smart Reporting</h3>
                                <p className="text-sm text-gray-300">Automated PDF generation</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 text-sm text-purple-300/60 font-mono">
                        v2.5.0-Release • PC Version
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-1/2 flex flex-col justify-center items-center p-16 bg-white overflow-y-auto">
                <div className="w-full max-w-md">




                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-sm flex items-center">
                            <i className="fas fa-exclamation-circle mr-3 text-lg"></i>
                            {error}
                        </div>
                    )}

                    {/* Google Login - Primary */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 py-3.5 px-4 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition transform active:scale-[0.99] duration-150 shadow-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span className="text-base">{isSignup ? 'Sign up with Google' : 'Sign in with Google'}</span>
                    </button>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500 font-medium">or continue with email</span>
                        </div>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailAuth} className="space-y-5">
                        {isSignup && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <i className="fas fa-user-tag text-gray-400"></i>
                                    </div>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm transition duration-150 ease-in-out"
                                        placeholder="Enter your name"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i className="fas fa-envelope text-gray-400"></i>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm transition duration-150 ease-in-out"
                                    placeholder="Enter your email"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i className="fas fa-lock text-gray-400"></i>
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm transition duration-150 ease-in-out"
                                    placeholder="Create a password"
                                />
                            </div>
                            {!isSignup && (
                                <div className="flex justify-end mt-1">
                                    <a href="#" className="text-xs font-medium text-purple-600 hover:text-purple-500">Forgot password?</a>
                                </div>
                            )}
                        </div>

                        <div className="flex items-start gap-3 mt-4">
                            <div className="flex items-center h-5">
                                <input
                                    id="terms"
                                    type="checkbox"
                                    checked={agreed}
                                    onChange={(e) => setAgreed(e.target.checked)}
                                    className="w-4 h-4 border-gray-300 rounded text-purple-600 focus:ring-purple-500 bg-gray-50 cursor-pointer"
                                />
                            </div>
                            <label htmlFor="terms" className="text-sm text-gray-600">
                                I agree to the <button type="button" onClick={() => setLegalModal({ isOpen: true, type: 'terms' })} className="font-semibold text-purple-600 hover:underline">Terms</button> and <button type="button" onClick={() => setLegalModal({ isOpen: true, type: 'privacy' })} className="font-semibold text-purple-600 hover:underline">Privacy Policy</button>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !agreed}
                            className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition transform active:scale-[0.99] duration-150"
                        >
                            {loading ? (
                                <>
                                    <i className="fas fa-circle-notch fa-spin mr-2"></i> Processing...
                                </>
                            ) : (
                                <>
                                    {isSignup ? 'Create Account' : 'Sign In'} <i className="fas fa-arrow-right ml-2 opacity-80"></i>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-gray-600">
                            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                            <button
                                onClick={() => setIsSignup(!isSignup)}
                                className="font-bold text-purple-600 hover:text-purple-800 transition"
                            >
                                {isSignup ? 'Sign In' : 'Sign Up'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
