import React from 'react';

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'privacy' | 'terms';
}

export default function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
    if (!isOpen) return null;

    const content = {
        privacy: {
            title: "Privacy Policy",
            text: (
                <div className="space-y-4 text-gray-600">
                    <p><strong>Last Updated: December 2025</strong></p>
                    <p>At Spotnet MedOS, we take your privacy seriously. This policy outlines how we handle your data.</p>

                    <h3 className="font-bold text-gray-800 text-lg">1. Data Collection</h3>
                    <p>We collect essential information required for hospital management, including patient records, doctor schedules, and billing details. All data is encrypted.</p>

                    <h3 className="font-bold text-gray-800 text-lg">2. Data Usage</h3>
                    <p>Your data is used solely for the purpose of providing and improving the Spotnet MedOS service. We do not sell your personal data to third parties.</p>

                    <h3 className="font-bold text-gray-800 text-lg">3. Data Security</h3>
                    <p>We implement industry-standard security measures (SSL, Encryption) to protect your data from unauthorized access.</p>

                    <h3 className="font-bold text-gray-800 text-lg">4. User Rights</h3>
                    <p>You have the right to access, modify, or delete your data at any time by contacting our support team.</p>
                </div>
            )
        },
        terms: {
            title: "Terms of Service",
            text: (
                <div className="space-y-4 text-gray-600">
                    <p><strong>Last Updated: December 2025</strong></p>
                    <p>By using Spotnet MedOS, you agree to the following terms.</p>

                    <h3 className="font-bold text-gray-800 text-lg">1. License</h3>
                    <p>Spotnet grants you a limited, non-exclusive, non-transferable license to use the software for your medical facility.</p>

                    <h3 className="font-bold text-gray-800 text-lg">2. Responsibilities</h3>
                    <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

                    <h3 className="font-bold text-gray-800 text-lg">3. Limitations</h3>
                    <p>The software is provided "as is". Spotnet is not liable for any medical errors or decisions made based on the software's data.</p>

                    <h3 className="font-bold text-gray-800 text-lg">4. Termination</h3>
                    <p>We reserve the right to terminate access if these terms are violated.</p>
                </div>
            )
        }
    };

    const { title, text } = content[type];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-fade-in-up">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {text}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                    >
                        Understood
                    </button>
                </div>
            </div>
        </div>
    );
}
