'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import Link from 'next/link';

export default function PatientReports() {
    const router = useRouter();
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const mobile = localStorage.getItem('patient_mobile');
        if (!mobile) {
            router.push('/patient');
            return;
        }

        // Fetch patient portal data
        const portalRef = ref(database, `patient_portal/${mobile}`);
        onValue(portalRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();

                if (data.hasLabRecords && data.linkedLab) {
                    fetchReports(data.linkedLab, data.linkedPatientId);
                } else {
                    setLoading(false);
                }
            }
        });
    }, [router]);

    const fetchReports = (labId: string, patientId: string) => {
        const reportsRef = ref(database, `reports/${labId}`);
        onValue(reportsRef, (snapshot) => {
            if (snapshot.exists()) {
                const allReports = snapshot.val();
                const patientReports: any[] = [];

                for (const reportId in allReports) {
                    if (allReports[reportId].patientId === patientId) {
                        patientReports.push({
                            id: reportId,
                            ...allReports[reportId]
                        });
                    }
                }

                // Sort by date (newest first)
                patientReports.sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );

                setReports(patientReports);
            }
            setLoading(false);
        });
    };

    const filteredReports = reports.filter(report =>
        report.testName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.reportId?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <i className="fas fa-spinner fa-spin text-4xl text-green-600"></i>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 shadow-lg">
                <div className="max-w-6xl mx-auto">
                    <Link href="/patient/dashboard" className="text-white hover:text-green-100 mb-2 inline-block">
                        <i className="fas fa-arrow-left mr-2"></i> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold">My Lab Reports</h1>
                    <p className="text-green-100 mt-1">View and download all your medical reports</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-6">
                {/* Search Bar */}
                <div className="bg-white rounded-xl shadow p-4 mb-6">
                    <input
                        type="text"
                        placeholder="Search reports by test name or report ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                    />
                </div>

                {/* Reports Grid */}
                {filteredReports.length === 0 ? (
                    <div className="bg-white rounded-xl shadow p-12 text-center">
                        <i className="fas fa-file-medical text-6xl text-gray-300 mb-4"></i>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Reports Found</h3>
                        <p className="text-gray-600">
                            {searchQuery
                                ? 'No reports match your search. Try a different keyword.'
                                : 'You don\'t have any lab reports yet. Visit a clinic to get tests done.'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {filteredReports.map((report) => (
                            <div
                                key={report.id}
                                className="bg-white rounded-xl shadow hover:shadow-lg transition p-6"
                            >
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <i className="fas fa-file-medical text-green-600 text-xl"></i>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-gray-800 mb-1">
                                                    {report.testName}
                                                </h3>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                                                    <span>
                                                        <i className="fas fa-hashtag mr-1"></i>
                                                        {report.reportId}
                                                    </span>
                                                    <span>
                                                        <i className="fas fa-calendar mr-1"></i>
                                                        {new Date(report.createdAt).toLocaleDateString('en-IN', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </span>
                                                    {report.referringDoctor && (
                                                        <span>
                                                            <i className="fas fa-user-md mr-1"></i>
                                                            {report.referringDoctor}
                                                        </span>
                                                    )}
                                                </div>
                                                {report.sampleId && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Sample: {report.sampleId}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <a
                                            href={`/print/report/${report.id}?patient=true`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
                                        >
                                            <i className="fas fa-eye"></i>
                                            View
                                        </a>
                                        <a
                                            href={`/print/report/${report.id}?patient=true`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
                                        >
                                            <i className="fas fa-download"></i>
                                            Download
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Info Box */}
                {reports.length > 0 && (
                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            <i className="fas fa-info-circle mr-2"></i>
                            <strong>Note:</strong> Reports are generated instantly as PDFs when you click View/Download.
                            All your medical data is stored securely and accessible anytime.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
