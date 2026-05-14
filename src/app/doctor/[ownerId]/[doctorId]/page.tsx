'use client';

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { useParams } from 'next/navigation';

export default function DoctorPortal() {
    const params = useParams();
    const ownerId = params.ownerId as string;
    const doctorId = params.doctorId as string;

    const [loading, setLoading] = useState(false);
    const [verified, setVerified] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [error, setError] = useState('');
    const [doctorData, setDoctorData] = useState<any>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [labBranding, setLabBranding] = useState<any>(null);
    const [stats, setStats] = useState({ total: 0, critical: 0 });

    // Fetch Lab Branding
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

    const fetchReports = async (docId: string) => {
        try {
            const reportsRef = ref(database, `reports/${ownerId}`);
            // Query reports where refDoctorId matches
            const q = query(reportsRef, orderByChild('refDoctorId'), equalTo(docId));
            const snapshot = await get(q);

            const data: any[] = [];
            let criticalCount = 0;

            snapshot.forEach(child => {
                const r = child.val();
                data.push({ id: child.key, ...r });
                if (r.aiAnalysis?.riskLevel === 'high' || r.aiAnalysis?.riskLevel === 'critical') {
                    criticalCount++;
                }
            });

            // Sort by newest first
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setReports(data);
            setStats({ total: data.length, critical: criticalCount });

        } catch (err) {
            console.error(err);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Check Internal Doctors
            let docRef = ref(database, `doctors/${ownerId}/${doctorId}`);
            let docSnap = await get(docRef);

            // If not found, check External Doctors
            if (!docSnap.exists()) {
                docRef = ref(database, `externalDoctors/${ownerId}/${doctorId}`);
                docSnap = await get(docRef); // Fixed: was using docRef from scope? Yes.
            }

            if (!docSnap.exists()) {
                setError('Doctor record not found.');
                setLoading(false);
                return;
            }

            const doctor = docSnap.val();
            // Simple verification: Match Mobile Number as "Access Code" for now
            // In production, this should be a password or OTP
            const dbClean = (doctor.mobile || '').replace(/\D/g, '').slice(-10);
            const inputClean = accessCode.replace(/\D/g, '').slice(-10);

            if (inputClean === dbClean) {
                setVerified(true);
                setDoctorData(doctor);
                fetchReports(doctorId);
            } else {
                setError('Invalid Access Code (Mobile Number).');
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
                    <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <i className="fas fa-user-md text-blue-600 text-xl"></i>
                            </div>
                            <div>
                                <h1 className="font-bold text-xl text-gray-900">
                                    Dr. {doctorData?.name}
                                </h1>
                                <p className="text-xs text-gray-500">{labBranding?.labName || 'Lab Portal'}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setVerified(false)}
                            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                <main className="max-w-5xl mx-auto px-4 py-8">
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                            <p className="text-xs text-blue-500 font-bold uppercase">Total Patients</p>
                            <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                            <p className="text-xs text-red-500 font-bold uppercase">Critical Cases</p>
                            <p className="text-2xl font-bold text-red-900">{stats.critical}</p>
                        </div>
                    </div>

                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <i className="fas fa-list-alt text-gray-400"></i>
                        Referral Reports
                    </h2>

                    {reports.length === 0 ? (
                        <div className="bg-white p-12 rounded-xl shadow-sm text-center border border-gray-100">
                            <p className="text-gray-400">No reports found for your referral ID.</p>
                        </div>
                    ) : (
                        <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Patient</th>
                                        <th className="px-4 py-3">Tests</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reports.map((report) => (
                                        <tr key={report.id} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {new Date(report.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-gray-800 text-sm">{report.patientName}</div>
                                                <div className="text-xs text-gray-400">{report.patientAge} / {report.patientGender}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {report.tests?.slice(0, 2).join(', ')}
                                                {report.tests?.length > 2 && <span className="text-xs text-gray-400 ml-1">+{report.tests.length - 2} more</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {report.aiAnalysis?.riskLevel === 'high' || report.aiAnalysis?.riskLevel === 'critical' ? (
                                                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded textxs font-bold text-[10px] uppercase">
                                                        <i className="fas fa-exclamation-circle"></i> Critical
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded textxs font-bold text-[10px] uppercase">
                                                        <i className="fas fa-check-circle"></i> Normal
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => window.open(`/print/report/${report.id}?ownerId=${ownerId}`, '_blank')}
                                                    className="text-blue-600 hover:text-blue-800 font-bold text-xs"
                                                >
                                                    View PDF
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-slate-800 p-8 text-center pt-12">
                    <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                        <i className="fas fa-user-md text-white text-2xl"></i>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Doctor Portal
                    </h1>
                    <p className="text-slate-400 text-sm">Access your patient reports securely.</p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleVerify}>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                Registered Mobile Number
                            </label>
                            <input
                                type="password"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                placeholder="Enter mobile number"
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                                required
                            />
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
                            {loading ? <i className="fas fa-spinner fa-spin"></i> : 'Login to Dashboard'}
                        </button>
                    </form>
                </div>
            </div>
            <div className="mt-8 text-slate-600 text-xs">
                &copy; {new Date().getFullYear()} Mediclo Lab Systems
            </div>
        </div>
    );
}
