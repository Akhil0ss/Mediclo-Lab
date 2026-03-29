'use client';

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { useParams } from 'next/navigation';

export default function PatientPortal() {
    const params = useParams();
    const ownerId = params.ownerId as string;
    const patientId = params.patientId as string;

    const [loading, setLoading] = useState(false);
    const [verified, setVerified] = useState(false);
    const [mobileInput, setMobileInput] = useState('');
    const [error, setError] = useState('');
    const [patientData, setPatientData] = useState<any>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [labBranding, setLabBranding] = useState<any>(null);

    // Fetch Lab Branding & Basic Validation
    useEffect(() => {
        if (!ownerId) return;
        const fetchBranding = async () => {
            const snap = await get(ref(database, `branding/${ownerId}`));
            if (snap.exists()) {
                setLabBranding(snap.val());
            }
        };
        fetchBranding();
    }, [ownerId]);

    const fetchReports = async (pid: string) => {
        try {
            const reportsRef = ref(database, `reports/${ownerId}`);
            const q = query(reportsRef, orderByChild('patientId'), equalTo(pid));
            const snapshot = await get(q);

            const data: any[] = [];
            snapshot.forEach(child => {
                data.push({ id: child.key, ...child.val() });
            });
            // Sort by newest first
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setReports(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Fetch Patient Data
            const patientRef = ref(database, `patients/${ownerId}/${patientId}`);
            const patientSnap = await get(patientRef);

            if (!patientSnap.exists()) {
                setError('Patient record not found.');
                setLoading(false);
                return;
            }

            const patient = patientSnap.val();
            // Clean numbers for comparison
            const inputClean = mobileInput.replace(/\D/g, '').slice(-10);
            const dbClean = (patient.mobile || '').replace(/\D/g, '').slice(-10);

            if (inputClean === dbClean) {
                setVerified(true);
                setPatientData(patient);
                fetchReports(patientId);
            } else {
                setError('Mobile number does not match our records.');
            }

        } catch (err) {
            console.error(err);
            setError('Verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (verified) {
        return (
            <div className="min-h-screen bg-gray-50 font-sans">
                {/* Header */}
                <header className="bg-white shadow-sm border-b sticky top-0 z-10">
                    <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
                        <div>
                            <h1 className="font-bold text-xl text-blue-900">
                                {labBranding?.labName || 'Patient Portal'}
                            </h1>
                            <p className="text-xs text-gray-500">Welcome, {patientData?.name}</p>
                        </div>
                        <button
                            onClick={() => setVerified(false)}
                            className="text-sm text-red-600 hover:text-red-800"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                <main className="max-w-3xl mx-auto px-4 py-8">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <i className="fas fa-file-medical-alt text-blue-600"></i>
                        Your Reports
                    </h2>

                    {reports.length === 0 ? (
                        <div className="bg-white p-8 rounded-xl shadow-sm text-center border border-gray-100">
                            <div className="text-gray-300 text-5xl mb-3">
                                <i className="fas fa-microscope"></i>
                            </div>
                            <p className="text-gray-500">No reports available yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {reports.map((report) => (
                                <div key={report.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-gray-800 text-sm">
                                                    {report.tests?.join(', ') || 'Lab Test'}
                                                </span>
                                                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                                                    {report.reportId}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                <i className="far fa-calendar-alt mr-1"></i>
                                                {new Date(report.createdAt).toLocaleDateString('en-IN', {
                                                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => window.open(`/print/report/${report.id}?ownerId=${ownerId}`, '_blank')}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1"
                                        >
                                            <i className="fas fa-download"></i> View Report
                                        </button>
                                    </div>

                                    {/* Quick Summary if available */}
                                    {report.aiAnalysis && report.aiAnalysis.riskLevel && (
                                        <div className={`mt-3 p-2 rounded-lg text-xs border ${report.aiAnalysis.riskLevel === 'high' ? 'bg-red-50 border-red-100 text-red-700' :
                                                report.aiAnalysis.riskLevel === 'medium' ? 'bg-orange-50 border-orange-100 text-orange-700' :
                                                    'bg-green-50 border-green-100 text-green-700'
                                            }`}>
                                            <span className="font-bold uppercase mr-1">Summary:</span>
                                            {report.aiAnalysis.riskLevel === 'high' ? 'Attention Required' :
                                                report.aiAnalysis.riskLevel === 'medium' ? 'Moderate Findings' : 'Normal Results'}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center">
                    <h1 className="text-2xl font-bold text-white mb-2">
                        {labBranding?.labName || 'Patient Portal'}
                    </h1>
                    <p className="text-blue-100 text-sm">Secure Report Access</p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleVerify}>
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Verify Mobile Number
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-400">
                                    <i className="fas fa-phone-alt"></i>
                                </span>
                                <input
                                    type="tel"
                                    value={mobileInput}
                                    onChange={(e) => setMobileInput(e.target.value)}
                                    placeholder="Enter your registered mobile"
                                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    required
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                Please enter the mobile number provided during sample collection.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                <i className="fas fa-exclamation-circle"></i>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i> Verifying...
                                </>
                            ) : (
                                <>
                                    Access Reports <i className="fas fa-arrow-right"></i>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            <p className="mt-8 text-center text-xs text-gray-400">
                Powered by Mediclo Lab System &copy; {new Date().getFullYear()}
            </p>
        </div>
    );
}
