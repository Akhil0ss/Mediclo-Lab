'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';

export default function VerifyPrescriptionPage() {
    const params = useParams();
    const rxId = params.rxId as string;

    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
    const [prescription, setPrescription] = useState<any>(null);
    const [branding, setBranding] = useState<any>(null);

    useEffect(() => {
        if (!rxId) return;

        const verifyPrescription = async () => {
            try {
                // Search through all owners' OPD records to find this prescription
                const usersSnapshot = await get(ref(database, 'users'));

                if (usersSnapshot.exists()) {
                    let foundRx = null;
                    let foundOwnerId = null;

                    // Iterate through owners
                    for (const uid in usersSnapshot.val()) {
                        // Try direct key lookup first
                        const keySnap = await get(ref(database, `opd/${uid}/${rxId}`));
                        if (keySnap.exists()) {
                            foundRx = { id: rxId, ...keySnap.val() };
                            foundOwnerId = uid;
                            break;
                        }

                        // Search by rxId field
                        const opdSnap = await get(ref(database, `opd/${uid}`));
                        if (opdSnap.exists()) {
                            opdSnap.forEach((child) => {
                                const data = child.val();
                                if (String(data.rxId).trim().toLowerCase() === String(rxId).trim().toLowerCase()) {
                                    foundRx = { id: child.key, ...data };
                                    foundOwnerId = uid;
                                }
                            });
                            if (foundRx) break;
                        }
                    }

                    if (foundRx && foundOwnerId) {
                        setPrescription(foundRx);

                        // Fetch branding
                        const brandingSnap = await get(ref(database, `branding/${foundOwnerId}`));
                        if (brandingSnap.exists()) {
                            setBranding(brandingSnap.val());
                        }

                        setStatus('valid');
                    } else {
                        setStatus('invalid');
                    }
                } else {
                    setStatus('invalid');
                }
            } catch (error) {
                console.error("Verification failed", error);
                setStatus('invalid');
            }
        };

        verifyPrescription();
    }, [rxId]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500"></div>
                    {branding?.logoUrl ? (
                        <img src={branding.logoUrl} alt="Logo" className="h-12 w-12 mx-auto mb-3 bg-white rounded-lg p-1 object-contain" />
                    ) : (
                        <div className="h-12 w-12 mx-auto mb-3 bg-white/20 rounded-lg flex items-center justify-center text-2xl">💊</div>
                    )}
                    <h1 className="text-xl font-bold tracking-wide">{branding?.labName || 'Spotnet MedOS'}</h1>
                    <p className="text-indigo-200 text-xs uppercase tracking-wider mt-1">Prescription Verification</p>
                </div>

                {/* Body */}
                <div className="p-8">
                    {status === 'loading' && (
                        <div className="flex flex-col items-center py-8">
                            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-500 font-medium animate-pulse">Verifying Prescription...</p>
                        </div>
                    )}

                    {status === 'invalid' && (
                        <div className="text-center py-6">
                            <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                                <span>✖</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Invalid Prescription</h2>
                            <p className="text-gray-500 text-sm">
                                Prescription ID <strong className="font-mono">{rxId}</strong> could not be verified.
                            </p>
                        </div>
                    )}

                    {status === 'valid' && prescription && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-sm">
                                <span>✔</span>
                            </div>

                            <h2 className="text-2xl font-bold text-gray-800 mb-1">Verified Authentic</h2>
                            <p className="text-green-600 text-xs font-bold uppercase tracking-widest mb-8">Official OPD Prescription</p>

                            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-left space-y-3">
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Rx ID</span>
                                    <span className="text-gray-800 font-mono font-bold text-sm">{prescription.rxId || rxId}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Patient Name</span>
                                    <span className="text-gray-800 font-bold text-sm">{prescription.patientName}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Age / Gender</span>
                                    <span className="text-gray-800 text-sm">{prescription.patientAge} Y / {prescription.patientGender}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Visit Date</span>
                                    <span className="text-gray-800 text-sm">{new Date(prescription.visitDate).toLocaleDateString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Doctor</span>
                                    <span className="text-gray-800 text-sm">{prescription.doctorName || prescription.consultingDoctor || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Diagnosis</span>
                                    <span className="text-gray-800 text-sm text-right max-w-[180px] truncate">{prescription.diagnosis || '-'}</span>
                                </div>
                            </div>

                            <div className="mt-6">
                                <a
                                    href={`/print/opd/${rxId}`}
                                    className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    View Full Prescription
                                </a>
                            </div>

                            <div className="mt-6">
                                <p className="text-[10px] text-gray-400 max-w-xs mx-auto">
                                    This prescription has been digitally verified by {branding?.labName || 'Spotnet MedOS'}.
                                    Authenticity is confirmed at the time of verification.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-400">© 2025 {branding?.labName || 'Spotnet MedOS'}</p>
                </div>
            </div>
        </div>
    );
}
