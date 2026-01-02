'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { createUserAccounts, validatePassword, type UserCredentials } from '@/lib/auth';
import { generateUsername } from '@/lib/userUtils';

export default function SetupProfilePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState<'form' | 'credentials'>('form');
    const [loading, setLoading] = useState(false);
    const [generatedCredentials, setGeneratedCredentials] = useState<UserCredentials[]>([]);

    const [formData, setFormData] = useState({
        labName: '',
        password: '',
        confirmPassword: ''
    });

    const [errors, setErrors] = useState<string[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setErrors([]);

        // Validate lab name
        if (!formData.labName.trim()) {
            setErrors(['Lab name is required']);
            return;
        }

        // Validate password
        if (formData.password !== formData.confirmPassword) {
            setErrors(['Passwords do not match']);
            return;
        }

        const passwordValidation = validatePassword(formData.password);
        if (!passwordValidation.valid) {
            setErrors(passwordValidation.errors);
            return;
        }

        setLoading(true);

        try {
            // Create user accounts
            const credentials = await createUserAccounts(
                user.uid,
                formData.labName,
                formData.password
            );

            setGeneratedCredentials(credentials);
            setStep('credentials');
        } catch (error) {
            console.error('Setup error:', error);
            setErrors(['Failed to create user accounts. Please try again.']);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCredentials = () => {
        const text = generatedCredentials
            .map(c => `${c.role.toUpperCase()}:\nUsername: ${c.username}\nPassword: ${c.password}`)
            .join('\n\n');

        navigator.clipboard.writeText(text);
        alert('All credentials copied to clipboard!');
    };

    const handleComplete = () => {
        router.push('/dashboard');
    };

    if (step === 'credentials') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-check text-4xl text-green-600"></i>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Setup Complete!</h1>
                        <p className="text-gray-600">Your user accounts have been created successfully.</p>
                    </div>

                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-red-800 font-semibold text-sm">
                            <i className="fas fa-exclamation-triangle mr-2"></i>
                            IMPORTANT: Save these credentials securely! They will only be shown once.
                        </p>
                    </div>

                    <div className="space-y-4 mb-6">
                        {generatedCredentials.map((cred, index) => (
                            <div key={index} className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4">
                                <h3 className="font-bold text-purple-800 mb-3 uppercase">
                                    {cred.role === 'receptionist' ? '👤 Receptionist (Your Account)' :
                                        cred.role === 'lab' ? '🔬 Lab User' :
                                            '💊 Pharmacy User'}
                                </h3>
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600">Username:</label>
                                        <div className="bg-white px-3 py-2 rounded border border-purple-300 font-mono text-sm font-bold text-purple-700">
                                            {cred.username}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600">Password:</label>
                                        <div className="bg-white px-3 py-2 rounded border border-purple-300 font-mono text-sm font-bold text-purple-700">
                                            {cred.password}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-blue-800">
                            <i className="fas fa-info-circle mr-2"></i>
                            <strong>Next Steps:</strong> Share the Lab and Pharmacy credentials with your staff.
                            All users can change their passwords after first login from Settings.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleCopyCredentials}
                            className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700"
                        >
                            <i className="fas fa-copy mr-2"></i>Copy All Credentials
                        </button>
                        <button
                            onClick={handleComplete}
                            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
                        >
                            <i className="fas fa-arrow-right mr-2"></i>Go to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-user-cog text-3xl text-purple-600"></i>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Setup Your Profile</h1>
                    <p className="text-gray-600">Complete your lab setup to get started</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Lab Name */}
                    <div>
                        <label className="block text-sm font-semibold mb-2 text-gray-700">
                            <i className="fas fa-hospital text-purple-600 mr-2"></i>Lab Name *
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., Spotnet MedOS"
                            value={formData.labName}
                            onChange={(e) => setFormData({ ...formData, labName: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            required
                        />
                        {formData.labName && (
                            <p className="text-xs text-gray-500 mt-1">
                                Your username will be: <span className="font-mono font-bold text-purple-600">
                                    {generateUsername(formData.labName, 'receptionist')}
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-semibold mb-2 text-gray-700">
                            <i className="fas fa-lock text-purple-600 mr-2"></i>Create Password *
                        </label>
                        <input
                            type="password"
                            placeholder="Min 12 characters with uppercase, numbers, symbols"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-semibold mb-2 text-gray-700">
                            <i className="fas fa-lock text-purple-600 mr-2"></i>Confirm Password *
                        </label>
                        <input
                            type="password"
                            placeholder="Re-enter your password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Errors */}
                    {errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            {errors.map((error, index) => (
                                <p key={index} className="text-sm text-red-700">
                                    <i className="fas fa-exclamation-circle mr-2"></i>{error}
                                </p>
                            ))}
                        </div>
                    )}

                    {/* Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-800">
                            <i className="fas fa-info-circle mr-2"></i>
                            This will create 3 user accounts: Receptionist (you), Lab User, and Pharmacy User.
                            You'll receive all credentials after setup.
                        </p>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>Creating Accounts...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-check-circle mr-2"></i>Complete Setup
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
