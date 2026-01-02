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
    const [loading, setLoading] = useState(true);
    const [showQuickReportModal, setShowQuickReportModal] = useState(false);

    useEffect(() => {
        if (userProfile && userProfile.role !== 'lab' && userProfile.role !== 'receptionist') {
            router.push('/dashboard');
        }
    }, [userProfile, router]);

    useEffect(() => {
        if (!user || !userProfile) return;

        // Use ownerId if available (for staff), otherwise user.uid
        const dataSourceId = userProfile.ownerId || user.uid;
        const samplesRef = ref(database, `samples/${dataSourceId}`);
        const unsubscribe = onValue(samplesRef, (snapshot) => {
            if (snapshot.exists()) {
                const samplesData = snapshot.val();
                const pending: any[] = [];

                for (const sampleId in samplesData) {
                    const sample = samplesData[sampleId];
                    // Show samples that don't have a report yet AND have status not equal to 'Completed' OR 'Report Generated'
                    // Sometimes status might be updated but reportGenerated flag missing or vice versa
                    if (!sample.reportId && sample.status !== 'Completed') {
                        pending.push({
                            id: sampleId,
                            ...sample
                        });
                    }
                }

                // Sort by created date (newest first)
                pending.sort((a, b) =>
                    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                );

                setPendingSamples(pending);
            } else {
                setPendingSamples([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, userProfile]);

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">
                <i className="fas fa-flask text-purple-600 mr-3"></i>
                Lab Dashboard
            </h1>

            {/* Quick Report Button */}
            <div className="mb-6">
                <button
                    onClick={() => setShowQuickReportModal(true)}
                    className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:shadow-xl transition transform hover:scale-105 flex items-center gap-2"
                >
                    <i className="fas fa-flask text-lg"></i>
                    <span>Quick Report</span>
                </button>
            </div>

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
                                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                                <span>
                                                    <i className="fas fa-hashtag mr-1"></i>
                                                    Sample: <strong>{sample.sampleId}</strong>
                                                </span>
                                                <span>
                                                    <i className="fas fa-flask mr-1"></i>
                                                    Tests: <strong>{sample.tests?.length || 0}</strong>
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

                                    {/* Quick Action Button */}
                                    <button
                                        onClick={() => router.push(`/dashboard/reports/create?sampleId=${sample.id}`)}
                                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-bold transition shadow-lg"
                                    >
                                        <i className="fas fa-file-medical mr-2"></i>
                                        Generate Report
                                    </button>
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
