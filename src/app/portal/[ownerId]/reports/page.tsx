'use client';

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { useParams } from 'next/navigation';

export default function ReportHistory() {
    const params = useParams();
    const ownerId = params.ownerId as string;
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<any[]>([]);

    useEffect(() => {
        const storedPid = localStorage.getItem('portal_patient_id');
        if (!storedPid) return;

        const reportsRef = ref(database, `reports/${ownerId}`);
        const reportsQuery = query(reportsRef, orderByChild('patientId'), equalTo(storedPid));
        
        const unsub = onValue(reportsQuery, (snap) => {
            const list: any[] = [];
            snap.forEach(c => { list.push({ id: c.key, ...c.val() }) });
            list.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setReports(list);
            setLoading(false);
        });

        return () => unsub();
    }, [ownerId]);

    if (loading) return null;

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Diagnostic Reports</h1>
                    <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest italic">Secure results from our clinical laboratory</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl border border-indigo-100 shadow-sm text-[10px] font-black uppercase tracking-widest text-indigo-500">
                    Total: {reports.length} Reports
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {reports.map((report) => (
                    <div key={report.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden group">
                        <div className="p-8">
                            <div className="flex justify-between items-start mb-6">
                                <div className="h-14 w-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                    <i className="fas fa-microscope text-xl"></i>
                                </div>
                                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                    report.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {report.status || 'Verified'}
                                </span>
                            </div>

                            <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase mb-2">
                                {report.testName || (report.tests && report.tests.join(', ')) || 'Laboratory Investigation'}
                            </h3>
                            
                            <div className="flex flex-wrap items-center gap-4 mb-8">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <i className="far fa-calendar-alt"></i>
                                    {new Date(report.date || report.createdAt).toLocaleDateString()}
                                </span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <i className="far fa-id-badge"></i>
                                    RID-{report.reportId || report.id.slice(-6)}
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => window.open(`/print/report/${report.id}?ownerId=${ownerId}`, '_blank')}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <i className="fas fa-file-download"></i> Download Report
                                </button>
                            </div>
                        </div>

                        {/* AI Insight Snippet if exists */}
                        {report.aiAnalysis && report.aiAnalysis.riskLevel && (
                            <div className={`px-8 py-4 border-t ${
                                report.aiAnalysis.riskLevel === 'high' ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'
                            }`}>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                    <i className="fas fa-robot"></i> AI Summary Insight
                                </p>
                                <p className={`text-xs font-bold italic truncate ${
                                    report.aiAnalysis.riskLevel === 'high' ? 'text-red-700' : 'text-slate-600'
                                }`}>
                                    {report.aiAnalysis.riskLevel === 'high' ? 'Abnormal findings detected. Clinical review recommended.' : 'Results appear within baseline safety range.'}
                                </p>
                            </div>
                        )}
                    </div>
                ))}

                {reports.length === 0 && (
                    <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm px-8">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-slate-200 text-4xl transform rotate-12">
                            <i className="fas fa-vial"></i>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase mb-3">No Reports Available</h2>
                        <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto italic leading-relaxed">
                            Once your samples are processed and reports are validated by our clinicians, they will be accessible here instantly.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
