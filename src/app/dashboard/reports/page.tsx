'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ref, onValue, remove } from 'firebase/database';
import { database } from '@/lib/firebase';

export default function AllReportsPage() {
    const { user, userProfile } = useAuth();
    const { showToast } = useToast();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [reports, setReports] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [filteredReports, setFilteredReports] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedTestsRow, setExpandedTestsRow] = useState<string | null>(null);
    const itemsPerPage = 10;

    useEffect(() => {
        if (!user || !userProfile) return;

        const dataSourceId = userProfile.ownerId || user.uid;
        const reportsRef = ref(database, `reports/${dataSourceId}`);
        const unsubscribe = onValue(reportsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setReports(data);
            setFilteredReports(data);
        });

        return () => unsubscribe();
    }, [userProfile]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredReports(reports);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredReports(
                reports.filter(r =>
                    r.patientName?.toLowerCase().includes(query) ||
                    r.patientMobile?.toLowerCase().includes(query) ||
                    r.id?.toLowerCase().includes(query) ||
                    r.reportId?.toLowerCase().includes(query) ||
                    r.tests?.some((t: string) => t.toLowerCase().includes(query))
                )
            );
        }
        setCurrentPage(1);
    }, [searchQuery, reports]);

    const handleFilterByDate = () => {
        if (!fromDate || !toDate) {
            showToast('Please select both dates', 'warning');
            return;
        }

        const filtered = reports.filter(r => {
            const reportDate = new Date(r.createdAt).toISOString().split('T')[0];
            return reportDate >= fromDate && reportDate <= toDate;
        });

        setFilteredReports(filtered);
        setCurrentPage(1);
    };

    const handleExportCSV = () => {
        if (reports.length === 0) {
            showToast('No reports to export', 'warning');
            return;
        }

        const csv = [
            ['Report ID', 'Patient Name', 'Age', 'Gender', 'Tests', 'Report Date', 'Created Date'],
            ...reports.map(r => [
                r.reportId || r.id.substring(0, 12),
                r.patientName,
                r.patientAge,
                r.patientGender,
                r.tests?.join('; ') || '',
                new Date(r.reportDate || r.createdAt).toLocaleDateString('en-IN'),
                new Date(r.createdAt).toLocaleString('en-IN')
            ])
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reports_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('Reports exported to CSV!', 'success');
    };

    const handleDownloadPDF = (reportId: string) => {
        const dataSourceId = userProfile?.ownerId || user?.uid || '';
        window.open(`/print/report/${reportId}?ownerId=${dataSourceId}`, '_blank');
    };

    const handleDeleteReport = async (reportId: string) => {
        if (!user || !userProfile) return;
        if (!confirm('Delete this report?')) return;

        const dataSourceId = userProfile.ownerId || user.uid;
        await remove(ref(database, `reports/${dataSourceId}/${reportId}`));
        showToast('Report deleted!', 'success');
    };

    // Helper function to format report ID
    const formatReportId = (report: any) => {
        const repId = report.reportId || report.id;
        const parts = (repId || '').split('-');
        // Check if valid format: 3 parts, middle is 6 digits (YYYYMM)
        if (parts.length === 3 && /^\d{6}$/.test(parts[1])) {
            return repId;
        }
        // Invalid format: regenerate with extracted sequence
        const prefix = (userProfile?.labName || 'LAB').replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase().padEnd(4, 'X');
        const d = new Date(report.createdAt);
        const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
        // Extract numbers from old ID (e.g., TEST-00007 → 0007)
        const nums = (repId || '').replace(/\D/g, '');
        const seq = nums.length >= 4 ? nums.slice(-4) : String(d.getTime()).slice(-4);
        return `${prefix}-${ym}-${seq}`;
    };

    // Pagination
    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedReports = filteredReports.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div>
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                    <h2 className="text-xl font-bold text-gray-800">All Reports</h2>
                    <div className="flex gap-2 flex-wrap">
                        <input
                            type="text"
                            placeholder="Search reports..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="px-4 py-2 border rounded-lg"
                        />
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="px-3 py-2 border rounded-lg"
                        />
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="px-3 py-2 border rounded-lg"
                        />
                        <button
                            onClick={handleFilterByDate}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-lg"
                        >
                            <i className="fas fa-filter mr-2"></i>Filter
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-4 py-2 rounded-lg hover:shadow-lg"
                        >
                            <i className="fas fa-download mr-2"></i>Export CSV
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-full">
                        <thead className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Report ID</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Patient Name</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Mobile</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Tests</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedReports.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        <i className="fas fa-file-medical text-4xl mb-2 opacity-20"></i>
                                        <p>No reports found</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedReports.map(report => (
                                    <tr key={report.id} className="border-b hover:bg-gray-50 transition">
                                        <td className="px-4 py-3 text-sm font-mono text-purple-600">
                                            {formatReportId(report)}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                                            {report.patientName}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-600">
                                            {report.patientMobile || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {(() => {
                                                const tests = report.tests || (report.testName ? [report.testName] : []);
                                                if (tests.length === 0) return <span className="text-gray-400">N/A</span>;

                                                const firstTest = tests[0];
                                                const remainingCount = tests.length - 1;
                                                const isExpanded = expandedTestsRow === report.id;

                                                return (
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-100 whitespace-nowrap">
                                                                {firstTest}
                                                            </span>
                                                            {remainingCount > 0 && (
                                                                <button
                                                                    onClick={() => setExpandedTestsRow(isExpanded ? null : report.id)}
                                                                    className="inline-block bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs font-bold border border-purple-200 hover:bg-purple-100 transition-colors whitespace-nowrap"
                                                                >
                                                                    {isExpanded ? '− Less' : `+${remainingCount} more`}
                                                                </button>
                                                            )}
                                                        </div>
                                                        {isExpanded && remainingCount > 0 && (
                                                            <div className="mt-1 p-2 bg-gray-50 rounded border border-gray-200 flex flex-wrap gap-1">
                                                                {tests.slice(1).map((test: string, idx: number) => (
                                                                    <span key={idx} className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-100">
                                                                        {test}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div>{new Date(report.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                                            <div className="text-xs text-gray-500">{new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm flex items-center">
                                            <button
                                                onClick={() => handleDownloadPDF(report.id)}
                                                className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2 mr-2"
                                                title="View Report PDF"
                                            >
                                                <i className="fas fa-file-pdf"></i>
                                                <span className="font-bold text-xs">PDF</span>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteReport(report.id)}
                                                className="text-gray-400 hover:text-red-600 transition-colors ml-2"
                                                title="Delete"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination mt-4">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                        >
                            <i className="fas fa-chevron-left"></i> Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                className={currentPage === page ? 'active' : ''}
                                onClick={() => setCurrentPage(page)}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(currentPage + 1)}
                        >
                            Next <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
