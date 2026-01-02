'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';

export default function PrintReportPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const reportId = params?.id as string;
    const ownerId = searchParams.get('ownerId');

    useEffect(() => {
        if (!reportId || !ownerId) {
            setError('Missing report ID or Owner ID');
            setLoading(false);
            return;
        }

        const fetchReport = async () => {
            try {
                const reportRef = ref(database, `reports/${ownerId}/${reportId}`);
                const snapshot = await get(reportRef);

                if (snapshot.exists()) {
                    const reportData = snapshot.val();

                    // Calculate threat levels BEFORE setting state
                    if (reportData.testDetails) {
                        reportData.testDetails.forEach((test: any) => {
                            if (test.subtests) {
                                test.subtests.forEach((subtest: any) => {
                                    if (!subtest.threatLevel && subtest.value && subtest.ranges) {
                                        const numValue = parseFloat(subtest.value);
                                        if (!isNaN(numValue)) {
                                            const min = parseFloat(subtest.ranges.min);
                                            const max = parseFloat(subtest.ranges.max);
                                            if (numValue < min * 0.7 || numValue > max * 1.3) {
                                                subtest.threatLevel = 'critical';
                                            } else if (numValue < min || numValue > max) {
                                                subtest.threatLevel = 'warning';
                                            } else {
                                                subtest.threatLevel = 'normal';
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    }

                    setReport(reportData);
                } else {
                    setError(`Report not found at path: reports/${ownerId}/${reportId}`);
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load report');
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [reportId, ownerId]);

    useEffect(() => {
        if (report && !loading) {
            const timer = setTimeout(() => {
                window.print();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [report, loading]);

    if (loading) return <div className="p-8 text-center">Loading Report...</div>;
    if (error) return (
        <div className="p-8 text-center">
            <div className="text-red-600 font-bold mb-2">{error}</div>
            <div className="text-sm text-gray-600">
                <p>Report ID: {reportId || 'Not provided'}</p>
                <p>Owner ID: {ownerId || 'Not provided'}</p>
            </div>
        </div>
    );
    if (!report) return null;

    // Theme Configuration
    const themes: any = {
        blue: { primary: '#667eea', secondary: '#764ba2', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6366f1 100%)' },
        green: { primary: '#10b981', secondary: '#059669', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)' },
        purple: { primary: '#8b5cf6', secondary: '#7c3aed', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)' },
        teal: { primary: '#14b8a6', secondary: '#0d9488', gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)' },
        grey: { primary: '#475569', secondary: '#334155', gradient: 'linear-gradient(135deg, #475569 0%, #334155 50%, #1e293b 100%)' }
    };

    const themeName = report.pdfTheme || 'blue';
    const theme = themes[themeName] || themes.blue;

    const labName = report.labBranding?.labName || 'Spotnet MedOS';
    const isPremium = true;
    const sampleId = report.sampleId || `SMP-${new Date(report.createdAt).getTime().toString().slice(-8)}`;

    const labPrefix = ((report.labBranding?.labName || 'SPOT') + '').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
    const patientIdNum = report.patientId ? (report.patientId + '').substring(0, 6).toUpperCase() : 'UNKNOWN';
    const generatedPatientId = `${labPrefix}-${patientIdNum}`;

    const testsDoneList = (report.tests || []).join(', ') || (report.testDetails || []).map((t: any) => t.testName).join(', ');

    // Collect critical findings
    const criticalFindings: any[] = [];
    if (report.testDetails) {
        report.testDetails.forEach((test: any) => {
            if (test.subtests) {
                test.subtests.forEach((subtest: any) => {
                    if (subtest.threatLevel === 'critical' && subtest.value) {
                        criticalFindings.push({
                            test: test.testName,
                            parameter: subtest.name,
                            value: subtest.value,
                            unit: subtest.unit
                        });
                    }
                });
            }
        });
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 print:p-0 print:bg-white">
            <style jsx global>{`
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @page { margin: 8mm; size: A4; }
                
                body { 
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.4;
                    color: #1e293b;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                @media print {
                    body { padding: 0; background: white; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg print:shadow-none print:rounded-none">
                {/* HEADER */}
                <div className="relative" style={{ background: theme.gradient }}>
                    <div className="px-5 py-4 text-white flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            {report.labBranding?.logo && isPremium && (
                                <img src={report.labBranding.logo} className="w-12 h-12 bg-white rounded p-1" alt="Logo" />
                            )}
                            <div>
                                <h1 className="text-lg font-bold">{report.labBranding?.labName || 'Spotnet MedOS'}</h1>
                                <p className="text-xs opacity-90">{report.labBranding?.tagline || 'Professional Healthcare Services'}</p>
                                {report.labBranding?.address && <p className="text-xs opacity-90">📍 {report.labBranding.address}</p>}
                            </div>
                        </div>
                        <div className="text-right text-xs">
                            {report.labBranding?.contact && <p>📞 {report.labBranding.contact}</p>}
                            {report.labBranding?.email && <p>✉️ {report.labBranding.email}</p>}
                            {report.labBranding?.website && <p>🌐 {report.labBranding.website}</p>}
                            {isPremium && (
                                <div className="flex gap-1 justify-end mt-1">
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-[8px] font-bold">NABL</span>
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-[8px] font-bold">ISO 9001</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500"></div>
                </div>

                {/* META BAR */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-700 text-white px-5 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded p-0.5">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(reportId || '')}`} alt="QR" className="w-full h-full" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold tracking-wide">ID: {reportId}</h2>
                            <p className="text-[9px] opacity-80">AUTHORISED LABORATORY REPORT</p>
                        </div>
                    </div>
                    <div className="text-right text-[9px]">
                        <p><span className="text-yellow-400 font-bold">Date:</span> {new Date(report.reportDate || report.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        <p><span className="text-yellow-400 font-bold">Time:</span> {new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>

                {/* PATIENT INFO */}
                <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-cyan-50" style={{ borderBottom: `2px solid ${theme.primary}` }}>
                    <div className="grid grid-cols-4 gap-2">
                        <div className="bg-white p-2 rounded shadow-sm" style={{ borderLeft: `3px solid ${theme.primary}` }}>
                            <label className="block text-[8px] font-bold uppercase tracking-wide mb-0.5" style={{ color: theme.primary }}>Patient Name</label>
                            <span className="text-[11px] font-semibold text-gray-900">{report.patientName}</span>
                        </div>
                        <div className="bg-white p-2 rounded shadow-sm" style={{ borderLeft: `3px solid ${theme.primary}` }}>
                            <label className="block text-[8px] font-bold uppercase tracking-wide mb-0.5" style={{ color: theme.primary }}>Sample ID</label>
                            <span className="text-[11px] font-semibold text-gray-900">{sampleId}</span>
                        </div>
                        <div className="bg-white p-2 rounded shadow-sm" style={{ borderLeft: `3px solid ${theme.primary}` }}>
                            <label className="block text-[8px] font-bold uppercase tracking-wide mb-0.5" style={{ color: theme.primary }}>Patient ID</label>
                            <span className="text-[11px] font-semibold text-gray-900">{generatedPatientId}</span>
                        </div>
                        <div className="bg-white p-2 rounded shadow-sm" style={{ borderLeft: `3px solid ${theme.primary}` }}>
                            <label className="block text-[8px] font-bold uppercase tracking-wide mb-0.5" style={{ color: theme.primary }}>Age / Gender</label>
                            <span className="text-[11px] font-semibold text-gray-900">{report.patientAge} Y / {report.patientGender}</span>
                        </div>
                        {report.patientMobile && (
                            <div className="bg-white p-2 rounded shadow-sm" style={{ borderLeft: `3px solid ${theme.primary}` }}>
                                <label className="block text-[8px] font-bold uppercase tracking-wide mb-0.5" style={{ color: theme.primary }}>Mobile</label>
                                <span className="text-[11px] font-semibold text-gray-900">{report.patientMobile}</span>
                            </div>
                        )}
                        {report.patientRefDoctor && (
                            <div className="bg-white p-2 rounded shadow-sm" style={{ borderLeft: `3px solid ${theme.primary}` }}>
                                <label className="block text-[8px] font-bold uppercase tracking-wide mb-0.5" style={{ color: theme.primary }}>Ref. Doctor</label>
                                <span className="text-[11px] font-semibold text-gray-900">{report.patientRefDoctor}</span>
                            </div>
                        )}
                        <div className="col-span-2 bg-white p-2 rounded shadow-sm" style={{ borderLeft: `3px solid ${theme.primary}` }}>
                            <label className="block text-[8px] font-bold uppercase tracking-wide mb-0.5" style={{ color: theme.primary }}>Tests Done</label>
                            <span className="text-[11px] font-semibold text-gray-900">{testsDoneList}</span>
                        </div>
                    </div>
                </div>

                {/* SAMPLE BAR */}
                {(report.sampleCollectionTime || report.fastingStatus || report.sampleType) && (
                    <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 flex gap-5 text-[10px]">
                        {report.sampleCollectionTime && (
                            <div className="flex items-center gap-2">
                                <span className="text-gray-600 font-semibold">🕐 Collection Time:</span>
                                <span className="bg-white px-2 py-0.5 rounded border border-gray-200 font-bold">{report.sampleCollectionTime}</span>
                            </div>
                        )}
                        {report.fastingStatus && (
                            <div className="flex items-center gap-2">
                                <span className="text-gray-600 font-semibold">🍽️ Fasting:</span>
                                <span className="bg-white px-2 py-0.5 rounded border border-gray-200 font-bold">{report.fastingStatus}</span>
                            </div>
                        )}
                        {report.sampleType && (
                            <div className="flex items-center gap-2">
                                <span className="text-gray-600 font-semibold">🧪 Sample Type:</span>
                                <span className="bg-white px-2 py-0.5 rounded border border-gray-200 font-bold">{report.sampleType}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* CONTENT */}
                <div className="p-5">
                    {/* Legend */}
                    <div className="flex justify-center gap-6 text-[10px] font-bold bg-gray-50 border rounded p-2 mb-4">
                        <span className="text-green-600">● NORMAL</span>
                        <span className="text-amber-500">▲ BORDERLINE</span>
                        <span className="text-red-600">✖ ABNORMAL</span>
                    </div>

                    {/* Critical Findings */}
                    {criticalFindings.length > 0 && (
                        <div className="mb-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-400 rounded-lg p-3">
                            <h4 className="text-red-700 font-bold text-[11px] mb-2">⚠️ CRITICAL FINDINGS - IMMEDIATE ATTENTION REQUIRED</h4>
                            {criticalFindings.map((finding, idx) => (
                                <div key={idx} className="bg-white p-2 rounded border-l-2 border-red-500 mb-1 text-[10px] text-red-900">
                                    <strong>{finding.test}:</strong> {finding.parameter} = <strong className="text-red-700">{finding.value}</strong> {finding.unit}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Test Results */}
                    <div className="space-y-4">
                        {report.testDetails?.map((test: any, idx: number) => (
                            <div key={idx} className="rounded-lg overflow-hidden shadow-sm border border-gray-100">
                                <div className="text-white px-3 py-2 flex justify-between items-center" style={{ background: theme.gradient }}>
                                    <h3 className="text-xs font-bold uppercase">{test.testName}</h3>
                                    <span className="text-[9px] opacity-80">{test.category || 'Pathology'}</span>
                                </div>
                                <table className="w-full text-[10px]">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="text-left py-2 px-3 text-gray-600 font-bold uppercase">Parameter</th>
                                            <th className="text-left py-2 px-3 text-gray-600 font-bold uppercase">Result</th>
                                            <th className="text-left py-2 px-3 text-gray-600 font-bold uppercase">Unit</th>
                                            <th className="text-left py-2 px-3 text-gray-600 font-bold uppercase">Ref. Range</th>
                                            <th className="text-center py-2 px-3 text-gray-600 font-bold uppercase w-10">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {test.subtests?.map((sub: any, i: number) => {
                                            const isCritical = sub.threatLevel === 'critical';
                                            const isWarning = sub.threatLevel === 'warning';
                                            const textColor = isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-800';
                                            const bgColor = isCritical ? 'bg-red-50' : isWarning ? 'bg-amber-50' : 'bg-white';
                                            const icon = isCritical ? '✖' : isWarning ? '▲' : '●';
                                            const iconColor = isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-green-500';

                                            return (
                                                <tr key={i} className={bgColor}>
                                                    <td className="py-2 px-3 font-medium text-gray-700">{sub.name}</td>
                                                    <td className={`py-2 px-3 font-bold ${textColor}`}>{sub.value || '-'}</td>
                                                    <td className="py-2 px-3 text-gray-500">{sub.unit || '-'}</td>
                                                    <td className="py-2 px-3 text-gray-500">{sub.ranges ? `${sub.ranges.min} - ${sub.ranges.max}` : '-'}</td>
                                                    <td className={`py-2 px-3 text-center font-bold ${iconColor} text-sm`}>{icon}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>

                    {/* Notes */}
                    <div className="mt-4 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-400 rounded-lg p-3">
                        <h4 className="text-amber-800 font-bold text-[10px] mb-1">📋 CLINICAL NOTES & IMPRESSION</h4>
                        <p className="text-[9px] text-amber-900 leading-relaxed">
                            {report.labBranding?.footerNotes || 'This report should be correlated clinically. Results are based on the sample provided and testing methodology employed. Abnormal values are highlighted for your reference. For any queries, please consult your physician or contact the laboratory.'}
                        </p>
                    </div>

                    {/* Disclaimer */}
                    <div className="mt-3 p-2 bg-gray-50 border border-dashed border-gray-400 rounded text-[8px] text-gray-600">
                        <strong>DISCLAIMER:</strong> Laboratory results should be interpreted in conjunction with clinical history and examination. Values marked as abnormal may vary based on individual conditions. This is a computer-generated report valid only with authorized signature.
                    </div>
                </div>

                {/* Signature */}
                <div className="px-5 py-3 flex justify-between items-end border-t border-gray-200">
                    <div className="text-center p-3 bg-gray-50 border border-dashed border-gray-300 rounded min-w-[160px]">
                        <p className="text-[8px] text-gray-600">🔐 Digital Signature</p>
                        <div className="font-mono text-[7px] text-gray-400 my-1">SHA256: {(reportId || '').replace(/-/g, '').substring(0, 24)}...</div>
                        <p className="text-[8px] text-green-600 font-bold">Electronically Verified</p>
                    </div>
                    <div className="text-center min-w-[180px]">
                        <div className="h-10 border-b-2 border-gray-800 mb-2"></div>
                        <strong className="block text-[11px] text-gray-900">{report.labBranding?.director || 'Dr. Authorized Pathologist'}</strong>
                        <span className="text-[9px] font-semibold" style={{ color: theme.primary }}>Chief Pathologist / Microbiologist</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-white px-5 py-3 flex justify-between text-[9px]" style={{ background: theme.gradient }}>
                    <div>
                        <p className="font-bold text-[10px]">{labName}</p>
                        {report.labBranding?.address && <p className="opacity-90">{report.labBranding.address}</p>}
                        {report.labBranding?.contact && <p className="opacity-90">📞 {report.labBranding.contact}</p>}
                        <div className="font-mono text-[10px] bg-white/20 px-2 py-0.5 rounded mt-1 inline-block">|{(reportId || '').replace(/-/g, '').substring(0, 12)}|</div>
                    </div>
                    <div className="text-right opacity-90">
                        <p>Generated: {new Date(report.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        <p>Report Version: 1.0</p>
                        <p>Computer Generated Report</p>
                    </div>
                </div>
            </div>

            {/* Print Button */}
            <button
                onClick={() => window.print()}
                className="no-print fixed bottom-6 right-6 text-white px-6 py-3 rounded-full shadow-2xl font-bold hover:scale-105 transition"
                style={{ background: theme.gradient }}
            >
                🖨️ Print Report
            </button>
        </div>
    );
}
