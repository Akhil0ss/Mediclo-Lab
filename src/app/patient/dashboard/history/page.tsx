'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import Link from 'next/link';

export default function PatientHistory() {
    const router = useRouter();
    const [visits, setVisits] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const mobile = localStorage.getItem('patient_mobile');
        const patientId = localStorage.getItem('patient_id');
        const ownerId = localStorage.getItem('patient_owner_id');

        if (!mobile || !patientId || !ownerId) {
            router.push('/patient');
            return;
        }

        // Fetch OPD visits
        const opdRef = ref(database, `opd/${ownerId}`);
        onValue(opdRef, (snapshot) => {
            if (snapshot.exists()) {
                const allVisits: any[] = [];
                const data = snapshot.val();

                for (const visitId in data) {
                    const visit = data[visitId];
                    if (visit.patientId === patientId) {
                        allVisits.push({
                            id: visitId,
                            type: 'OPD',
                            ...visit
                        });
                    }
                }

                allVisits.sort((a, b) =>
                    new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
                );

                setVisits(allVisits);
            }
            setLoading(false);
        });

        // Fetch Lab Reports
        const reportsRef = ref(database, `reports/${ownerId}`);
        onValue(reportsRef, (snapshot) => {
            if (snapshot.exists()) {
                const allReports: any[] = [];
                const data = snapshot.val();

                for (const reportId in data) {
                    const report = data[reportId];
                    if (report.patientId === patientId) {
                        allReports.push({
                            id: reportId,
                            type: 'LAB',
                            ...report
                        });
                    }
                }

                allReports.sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );

                setReports(allReports);
            }
        });
    }, [router]);

    // Combine and sort all activities
    const allActivities = [...visits, ...reports].sort((a, b) => {
        const dateA = new Date(a.visitDate || a.createdAt).getTime();
        const dateB = new Date(b.visitDate || b.createdAt).getTime();
        return dateB - dateA;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
                <div className="max-w-6xl mx-auto">
                    <Link href="/patient/dashboard" className="text-white hover:text-blue-100 mb-2 inline-block">
                        <i className="fas fa-arrow-left mr-2"></i> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold">Visit History</h1>
                    <p className="text-blue-100 mt-1">Complete timeline of your medical visits</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-600 text-sm">Total Visits</p>
                                <p className="text-3xl font-bold text-blue-600">{allActivities.length}</p>
                            </div>
                            <i className="fas fa-calendar-check text-4xl text-blue-200"></i>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-600 text-sm">OPD Consultations</p>
                                <p className="text-3xl font-bold text-green-600">{visits.length}</p>
                            </div>
                            <i className="fas fa-stethoscope text-4xl text-green-200"></i>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-600 text-sm">Lab Reports</p>
                                <p className="text-3xl font-bold text-purple-600">{reports.length}</p>
                            </div>
                            <i className="fas fa-file-medical text-4xl text-purple-200"></i>
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                {allActivities.length === 0 ? (
                    <div className="bg-white rounded-xl shadow p-12 text-center">
                        <i className="fas fa-history text-6xl text-gray-300 mb-4"></i>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Visit History</h3>
                        <p className="text-gray-600">Your medical visit history will appear here</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-6">
                            <i className="fas fa-history text-blue-600 mr-2"></i>
                            Timeline
                        </h2>

                        <div className="space-y-4">
                            {allActivities.map((activity, index) => (
                                <div key={activity.id} className="relative pl-8 pb-8 border-l-2 border-gray-200 last:border-0 last:pb-0">
                                    {/* Timeline dot */}
                                    <div className={`absolute left-0 -ml-2 w-4 h-4 rounded-full ${activity.type === 'OPD' ? 'bg-green-500' : 'bg-purple-500'
                                        }`}></div>

                                    {/* Activity card */}
                                    <div className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${activity.type === 'OPD'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-purple-100 text-purple-800'
                                                    }`}>
                                                    {activity.type === 'OPD' ? '🩺 OPD Visit' : '🧪 Lab Report'}
                                                </span>
                                                <p className="text-sm text-gray-600 mt-2">
                                                    {new Date(activity.visitDate || activity.createdAt).toLocaleDateString('en-IN', {
                                                        weekday: 'long',
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                            </div>
                                        </div>

                                        {activity.type === 'OPD' ? (
                                            <div className="mt-3">
                                                <h4 className="font-bold text-gray-800 mb-2">
                                                    Dr. {activity.doctorName || activity.consultingDoctor}
                                                </h4>
                                                {activity.diagnosis && (
                                                    <p className="text-sm text-gray-700 mb-2">
                                                        <strong>Diagnosis:</strong> {activity.diagnosis}
                                                    </p>
                                                )}
                                                {activity.complaints && (
                                                    <p className="text-sm text-gray-600 mb-2">
                                                        <strong>Complaints:</strong> {activity.complaints}
                                                    </p>
                                                )}
                                                {activity.medicines && activity.medicines.length > 0 && (
                                                    <p className="text-sm text-gray-600">
                                                        <strong>Medicines:</strong> {activity.medicines.length} prescribed
                                                    </p>
                                                )}
                                                <a
                                                    href={`/print/opd/${activity.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-block mt-3 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                                                >
                                                    <i className="fas fa-prescription mr-2"></i>
                                                    View Prescription
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="mt-3">
                                                <h4 className="font-bold text-gray-800 mb-2">
                                                    {activity.testName}
                                                </h4>
                                                <p className="text-sm text-gray-600 mb-2">
                                                    <strong>Report ID:</strong> {activity.reportId}
                                                </p>
                                                <p className="text-sm text-gray-600 mb-2">
                                                    <strong>Status:</strong> <span className={`font-semibold ${activity.status === 'completed' ? 'text-green-600' : 'text-orange-600'
                                                        }`}>
                                                        {activity.status === 'completed' ? 'Completed' : 'Pending'}
                                                    </span>
                                                </p>
                                                {activity.status === 'completed' && (
                                                    <a
                                                        href={`/print/report/${activity.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-block mt-3 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                                                    >
                                                        <i className="fas fa-download mr-2"></i>
                                                        Download Report
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
