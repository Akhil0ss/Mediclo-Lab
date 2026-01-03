'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { completeProfileSetup } from '@/lib/auth';

export default function SetupProfilePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        labName: '',
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

        setLoading(true);

        try {
            // Complete profile setup (Lab Name & Branding)
            await completeProfileSetup(
                user.uid,
                formData.labName
            );

            // Redirect to dashboard immediately
            router.push('/dashboard');
        } catch (error) {
            console.error('Setup error:', error);
            setErrors(['Failed to update profile. Please try again.']);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-flask text-3xl text-purple-600"></i>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Setup Your Lab</h1>
                    <p className="text-gray-600">Enter your lab details to get started</p>
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
                        <p className="text-xs text-gray-500 mt-1">
                            This will be displayed on your reports and dashboard.
                        </p>
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

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>Setting up...
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
