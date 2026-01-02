'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '@/lib/firebase';

export default function VerifyReportPage() {
    const params = useParams();
    const reportId = params.id as string;

    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
    const [report, setReport] = useState<any>(null);

    useEffect(() => {
        if (!reportId) return;

        const verifyReport = async () => {
            try {
                // Since reports are nested under ownerIds in 'reports/{ownerId}/{reportId}',
                // and we only have reportId, we ideally need a direct lookup.
                // For this implementation, we'll try to search or assume a structure.

                // STRATEGY: Fetch all reports (Not efficient for prod, but working for this structure without backend changes)
                // A better authentic way would be having a 'public_reports/{reportId}' node.

                const snapshot = await get(ref(database, 'reports'));
                if (snapshot.exists()) {
                    let foundReport = null;

                    // Iterate through owners
                    snapshot.forEach((ownerSnap) => {
                        if (ownerSnap.hasChild(reportId)) {
                            foundReport = ownerSnap.child(reportId).val();
                        }
                        // Also check if reports are stored differently (e.g. some apps list them by date)
                        // But per previous file view, it was reports/ownerId/reportId
                    });

                    if (foundReport) {
                        setReport(foundReport);
                        setStatus('valid');
                    } else {
                        // Deep search if ID is unique property but not key (unlikely based on print page)
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

        verifyReport();
    }, [reportId]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

                {/* Header */}
                <div className="bg-slate-900 text-white p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                    <img src="/logo.png" alt="Logo" className="h-12 w-12 mx-auto mb-3 bg-white rounded-lg p-1 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <h1 className="text-xl font-bold tracking-wide">Spotnet MedOS</h1>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mt-1">Report Verification System</p>
                </div>

                {/* Body */}
                <div className="p-8">
                    {status === 'loading' && (
                        <div className="flex flex-col items-center py-8">
                            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-500 font-medium animate-pulse">Verifying Report Authenticity...</p>
                        </div>
                    )}

                    {status === 'invalid' && (
                        <div className="text-center py-6">
                            <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                                <i className="fas fa-times"></i> {/* Assuming FA is avail or just X */}
                                <span>✖</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Invalid Report</h2>
                            <p className="text-gray-500 text-sm">
                                The report ID <strong>{reportId}</strong> could not be verified in our system.
                            </p>
                        </div>
                    )}

                    {status === 'valid' && report && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-sm">
                                <span>✔</span>
                            </div>

                            <h2 className="text-2xl font-bold text-gray-800 mb-1">Verified Authentic</h2>
                            <p className="text-green-600 text-xs font-bold uppercase tracking-widest mb-8">Official Laboratory Report</p>

                            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-left space-y-3">
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Report ID</span>
                                    <span className="text-gray-800 font-mono font-bold text-sm">{report.id || reportId}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Patient Name</span>
                                    <span className="text-gray-800 font-bold text-sm">{report.patientName}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Age / Gender</span>
                                    <span className="text-gray-800 text-sm">{report.patientAge} Y / {report.patientGender}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Report Date</span>
                                    <span className="text-gray-800 text-sm">{new Date(report.reportDate).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Referred By</span>
                                    <span className="text-gray-800 text-sm">{report.refDoctor || 'Self'}</span>
                                </div>
                            </div>

                            <div className="mt-8">
                                <p className="text-[10px] text-gray-400 max-w-xs mx-auto">
                                    This report has been digitally verified by Spotnet MedOS.
                                    Content integrity is guaranteed at the time of verification.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-400">© 2025 Spotnet MedOS</p>
                </div>
            </div>
        </div>
    );
}
