'use client';

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { useParams } from 'next/navigation';

export default function PrescriptionHistory() {
    const params = useParams();
    const ownerId = params.ownerId as string;
    const [loading, setLoading] = useState(true);
    const [prescriptions, setPrescriptions] = useState<any[]>([]);

    useEffect(() => {
        const storedPid = localStorage.getItem('portal_patient_id');
        if (!storedPid) return;

        const opdRef = ref(database, `opd/${ownerId}`);
        const unsub = onValue(opdRef, (snap) => {
            const list: any[] = [];
            snap.forEach(c => {
                const visit = c.val();
                if (visit.patientId === storedPid && visit.prescription) {
                    list.push({ id: c.key, ...visit });
                }
            });
            list.sort((a,b) => new Date(b.visitDate || b.createdAt).getTime() - new Date(a.visitDate || a.createdAt).getTime());
            setPrescriptions(list);
            setLoading(false);
        });

        return () => unsub();
    }, [ownerId]);

    if (loading) return null;

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Prescription History</h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">All your medical consultations & advice</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Total: {prescriptions.length} Records
                </div>
            </div>

            <div className="grid gap-4">
                {prescriptions.map((rx) => (
                    <div key={rx.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group">
                        <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex items-center gap-6">
                                <div className="h-16 w-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 transform group-hover:rotate-12">
                                    <i className="fas fa-file-medical text-2xl"></i>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase mb-1">
                                        Rx #{rx.prescription.rxId || rx.id.slice(-8)}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase tracking-widest">
                                            {new Date(rx.visitDate || rx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Dr. {rx.doctorName || 'Medical Officer'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <button 
                                    onClick={() => window.open(`/print/opd/${rx.id}?ownerId=${ownerId}`, '_blank')}
                                    className="flex-1 md:flex-none bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-blue-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <i className="fas fa-file-pdf"></i> View & Print
                                </button>
                            </div>
                        </div>

                        {/* Quick Summary Section */}
                        {(rx.prescription.diagnosis || (rx.prescription.medicines && rx.prescription.medicines.length > 0)) && (
                            <div className="px-8 pb-8 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {rx.prescription.diagnosis && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Diagnosis / Complaints</p>
                                        <p className="text-xs font-bold text-slate-700 italic">"{rx.prescription.diagnosis}"</p>
                                    </div>
                                )}
                                {rx.prescription.medicines && rx.prescription.medicines.length > 0 && (
                                    <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-50">
                                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Prescribed Meds</p>
                                        <p className="text-xs font-bold text-blue-700">
                                            {rx.prescription.medicines.slice(0, 2).map((m: any) => m.name).join(', ')}
                                            {rx.prescription.medicines.length > 2 && ` + ${rx.prescription.medicines.length - 2} more`}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {prescriptions.length === 0 && (
                    <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm px-8">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200 text-4xl">
                            <i className="fas fa-prescription"></i>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 uppercase mb-2">No Records Yet</h2>
                        <p className="text-slate-400 text-sm font-medium max-w-xs mx-auto italic">
                            When you consult with our doctors, your digital prescriptions will appear here automatically.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
