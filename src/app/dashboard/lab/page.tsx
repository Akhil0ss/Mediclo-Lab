'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import QuickReportModal from '@/components/QuickReportModal';

export default function LabDashboard() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const [pendingSamples, setPendingSamples] = useState<any[]>([]);
    const [clinicalReferrals, setClinicalReferrals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showQuickReportModal, setShowQuickReportModal] = useState(false);
    const [expandedTestsRow, setExpandedTestsRow] = useState<string | null>(null);

    useEffect(() => {
        const allowedRoles = ['lab', 'owner'];
        if (userProfile && !allowedRoles.includes(userProfile.role)) {
            router.push('/dashboard');
        }
    }, [userProfile, router]);

    useEffect(() => {
        if (!user || !userProfile) return;

        // Use ownerId if available (for staff), otherwise user.uid
        const dataSourceId = userProfile.ownerId || user.uid;
        const samplesRef = ref(database, `samples/${dataSourceId}`);
        const unsubscribe = onValue(samplesRef, (snapshot) => {
            // ... (Existing samples logic)
            if (snapshot.exists()) {
                const samplesData = snapshot.val();
                const pending: any[] = [];
                for (const sampleId in samplesData) {
                    const sample = samplesData[sampleId];
                    if (!sample.reportId && sample.status !== 'Completed') {
                        pending.push({ id: sampleId, ...sample });
                    }
                }
                pending.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                setPendingSamples(pending);
            } else {
                setPendingSamples([]);
            }
        });

        // Clinical Referrals (via OPD node)
        const opdRef = ref(database, `opd/${dataSourceId}`);
        const unsubOpd = onValue(opdRef, (snapshot) => {
            const today = new Date().toISOString().split('T')[0];
            const referrals: any[] = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const val = child.val();
                    if (val.visitDate === today && val.status === 'referred' && val.prescription?.referredTests?.length > 0) {
                        referrals.push({ id: child.key, ...val });
                    }
                });
            }
            setClinicalReferrals(referrals.sort((a,b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()));
            setLoading(false);
        });

        return () => {
            unsubscribe();
            unsubOpd();
        };
    }, [user, userProfile]);

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">
                <i className="fas fa-flask text-purple-600 mr-3"></i>
                Lab Dashboard
            </h1>

            {(userProfile?.role === 'lab' || userProfile?.role === 'owner') && (
                <div className="mb-6">
                    <button
                        onClick={() => setShowQuickReportModal(true)}
                        className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:shadow-xl transition transform hover:scale-105 flex items-center gap-2"
                    >
                        <i className="fas fa-flask text-lg"></i>
                        <span>Quick Report</span>
                    </button>
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <button
                    onClick={() => router.push('/dashboard/patients')}
                    className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition"
                >
                    <i className="fas fa-users text-4xl text-purple-600 mb-3"></i>
                    <h3 className="font-bold text-lg">Patients</h3>
                    <p className="text-sm text-gray-600">View patient records</p>
                </button>

                <button
                    onClick={() => router.push('/dashboard/samples')}
                    className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition"
                >
                    <i className="fas fa-vial text-4xl text-blue-600 mb-3"></i>
                    <h3 className="font-bold text-lg">Samples</h3>
                    <p className="text-sm text-gray-600">Track lab samples</p>
                </button>

                <button
                    onClick={() => router.push('/dashboard/templates')}
                    className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition"
                >
                    <i className="fas fa-file-medical text-4xl text-green-600 mb-3"></i>
                    <h3 className="font-bold text-lg">Templates</h3>
                    <p className="text-sm text-gray-600">Test templates</p>
                </button>

                <button
                    onClick={() => router.push('/dashboard/reports')}
                    className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition"
                >
                    <i className="fas fa-file-alt text-4xl text-orange-600 mb-3"></i>
                    <h3 className="font-bold text-lg">Reports</h3>
                    <p className="text-sm text-gray-600">View all reports</p>
                </button>
            </div>

            {/* Clinical Referrals Monitor (Real-time sync with Doctor) */}
            {clinicalReferrals.length > 0 && (
                <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl backdrop-blur-md">
                                    <i className="fas fa-bullhorn animate-bounce"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">In-Clinic Referrals</h3>
                                    <p className="text-orange-100 text-xs opacity-80">Doctors are currently referring these patients to lab.</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 transition-all">
                                {clinicalReferrals.map((r, i) => (
                                    <div key={r.id} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-4 py-3 flex items-center gap-4 group transition-all">
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-orange-600 font-black shadow-lg">
                                            {r.patientName.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-black text-sm">{r.patientName}</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {r.prescription?.referredTests?.map((t: string, ti: number) => (
                                                    <span key={ti} className="text-[8px] font-black bg-orange-600/50 text-white px-1.5 py-0.5 rounded border border-orange-400/30 uppercase tracking-tighter">
                                                        {t}
                                                    </span>
                                                )) || <span className="text-[8px] opacity-60">No specific tests listed</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => router.push('/dashboard/samples?action=add')} className="px-6 py-2 bg-white text-orange-600 rounded-xl font-bold text-sm hover:bg-orange-50 transition-all shadow-lg active:scale-95">
                                REGISTER SAMPLES
                            </button>
                        </div>
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <i className="fas fa-flask text-8xl -rotate-12"></i>
                        </div>
                    </div>
                </div>
            )}

            {/* Pending Samples - Quick Report Flow */}
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">
                            <i className="fas fa-clipboard-list text-blue-600 mr-3"></i>
                            Pending Reports
                        </h2>
                        <p className="text-gray-600 mt-1">Samples waiting for report generation</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-600">Pending Samples</p>
                        <p className="text-3xl font-bold text-blue-600">{pendingSamples.length}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
                        <p className="text-gray-600">Loading samples...</p>
                    </div>
                ) : pendingSamples.length === 0 ? (
                    <div className="text-center py-12">
                        <i className="fas fa-check-circle text-6xl text-green-300 mb-4"></i>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">All Caught Up!</h3>
                        <p className="text-gray-600">No pending samples. All reports have been generated.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendingSamples.map((sample) => (
                            <div
                                key={sample.id}
                                className="border border-gray-300 rounded-lg p-4 hover:shadow-md transition bg-gradient-to-r from-white to-blue-50"
                            >
                                <div className="flex items-center justify-between">
                                    {/* Sample Info */}
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="bg-blue-100 p-3 rounded-lg">
                                            <i className="fas fa-vial text-blue-600 text-xl"></i>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg">
                                                {sample.patientName}
                                            </h3>
                                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1 flex-wrap">
                                                <span>
                                                    <i className="fas fa-hashtag mr-1"></i>
                                                    Sample: <strong>{sample.sampleId}</strong>
                                                </span>
                                                <span>
                                                    <i className="fas fa-flask mr-1"></i>
                                                    Tests: {(() => {
                                                        const tests = sample.tests || [];
                                                        if (tests.length === 0) return <strong>0</strong>;

                                                        const firstTest = tests[0];
                                                        const remainingCount = tests.length - 1;
                                                        const isExpanded = expandedTestsRow === sample.id;

                                                        return (
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-100">
                                                                    {firstTest}
                                                                </span>
                                                                {remainingCount > 0 && (
                                                                    <button
                                                                        onClick={() => setExpandedTestsRow(isExpanded ? null : sample.id)}
                                                                        className="inline-block bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-xs font-bold border border-purple-200 hover:bg-purple-100 transition-colors"
                                                                    >
                                                                        {isExpanded ? '−' : `+${remainingCount}`}
                                                                    </button>
                                                                )}
                                                                {isExpanded && remainingCount > 0 && (
                                                                    <span className="inline-flex flex-wrap gap-1 ml-1">
                                                                        {tests.slice(1).map((test: string, idx: number) => (
                                                                            <span key={idx} className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-100">
                                                                                {test}
                                                                            </span>
                                                                        ))}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        );
                                                    })()}
                                                </span>
                                                <span>
                                                    <i className="fas fa-calendar mr-1"></i>
                                                    {new Date(sample.createdAt).toLocaleDateString('en-IN')}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${sample.priority === 'Emergency' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    sample.priority === 'Urgent' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                        'bg-gray-50 text-gray-600 border-gray-200'
                                                    }`}>
                                                    {sample.priority === 'Emergency' ? '🚨 ' : sample.priority === 'Urgent' ? '⚡ ' : ''}
                                                    {sample.priority || 'Routine'}
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                    {sample.sampleType} {sample.containerType ? `(${sample.containerType})` : ''}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action - Restricted to Lab Staff */}
                                    {userProfile?.role === 'lab' ? (
                                        <button
                                            onClick={() => router.push(`/dashboard/reports/create?sampleId=${sample.id}`)}
                                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-bold transition shadow-lg shrink-0"
                                        >
                                            <i className="fas fa-file-medical mr-2"></i>
                                            Generate Report
                                        </button>
                                    ) : (
                                        <div className="inline-flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg border border-amber-100 animate-pulse shrink-0">
                                            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                            <span className="text-xs text-amber-700 font-bold uppercase tracking-wider">In Process</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Report Modal */}
            {showQuickReportModal && (
                <QuickReportModal
                    onClose={() => setShowQuickReportModal(false)}
                    ownerId={userProfile?.ownerId || user?.uid || ''}
                />
            )}
        </div>
    );
}
