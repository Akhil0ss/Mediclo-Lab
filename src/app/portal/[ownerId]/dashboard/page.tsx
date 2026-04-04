'use client';

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue, query, orderByChild, equalTo, limitToLast, get, update, remove } from 'firebase/database';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PatientDashboard() {
    const params = useParams();
    const router = useRouter();
    const ownerId = params.ownerId as string;
    const [patientId, setPatientId] = useState('');
    const [patientData, setPatientData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [stats, setStats] = useState({ rxCount: 0, reportCount: 0, pendingAppointments: 0 });
    const [allRecords, setAllRecords] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'rx' | 'report'>('all');

    useEffect(() => {
        const storedPid = localStorage.getItem('portal_patient_id');
        const storedUid = localStorage.getItem('portal_patient_uid');
        if (!storedPid) {
            setLoading(false);
            return;
        }
        setPatientId(storedPid);

        // 1. Fetch Patient Details using UID
        if (storedUid) {
            get(ref(database, `patients/${ownerId}/${storedUid}`)).then(snap => {
                if (snap.exists()) setPatientData(snap.val());
            });
        }

        // 2. Fetch Centralized Record Index
        const indexRef = ref(database, `patient_records/${ownerId}/${storedPid}`);
        const unsubIndex = onValue(indexRef, async (snap) => {
            if (!snap.exists()) {
                setAllRecords([]);
                setLoading(false);
                return;
            }

            const indexData = snap.val();
            const fetchPromises: Promise<any>[] = [];

            // Fetch VISITS (Rx)
            if (indexData.visits) {
                Object.keys(indexData.visits).forEach(visitKey => {
                    const p = get(ref(database, `opd/${ownerId}/${visitKey}`)).then(vSnap => {
                        if (vSnap.exists()) {
                            const v = vSnap.val();
                            if (v.prescription) {
                                return {
                                    id: visitKey,
                                    type: 'rx',
                                    date: v.visitDate || v.createdAt,
                                    title: `Prescription #${v.rxId || v.opdId || visitKey.slice(-6)}`,
                                    status: v.status || 'Verified',
                                    ...v
                                };
                            }
                        }
                        return null;
                    });
                    fetchPromises.push(p);
                });
            }

            // Fetch REPORTS
            if (indexData.reports) {
                Object.keys(indexData.reports).forEach(reportKey => {
                    const p = get(ref(database, `reports/${ownerId}/${reportKey}`)).then(rSnap => {
                        if (rSnap.exists()) {
                            const r = rSnap.val();
                            return {
                                id: reportKey,
                                type: 'report',
                                date: r.reportDate || r.date || r.createdAt,
                                title: r.testName || 'Lab Report',
                                status: r.status || 'Completed',
                                ...r
                            };
                        }
                        return null;
                    });
                    fetchPromises.push(p);
                });
            }

            // Fetch APPOINTMENTS
            if (indexData.appointments) {
                const appts: any[] = [];
                Object.keys(indexData.appointments).forEach(apptKey => {
                    const data = indexData.appointments[apptKey];
                    // Hide void and cancelled appointments from the portal
                    if (data.status !== 'void' && data.status !== 'cancelled') {
                        appts.push({ id: apptKey, ...data });
                    }
                });
                setAppointments(appts.sort((a,b) => {
                    const dateA = new Date(a.date || 0).getTime();
                    const dateB = new Date(b.date || 0).getTime();
                    return dateB - dateA;
                }));
            }

            const results = await Promise.all(fetchPromises);
            const validRecords = results.filter(Boolean);
            
            setAllRecords(validRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            
            // Update Stats
            setStats({
                rxCount: validRecords.filter(r => r.type === 'rx').length,
                reportCount: validRecords.filter(r => r.type === 'report').length,
                pendingAppointments: indexData.appointments ? Object.values(indexData.appointments).filter((a: any) => a.status === 'pending').length : 0
            });
            
            setLoading(false);
        });

        return () => {
            unsubIndex();
        };
    }, [ownerId]);
    
    const handleCancelAppointment = async (appt: any) => {
        if (!window.confirm("Are you sure you want to cancel this appointment request?")) return;
        try {
            const updates: any = {};
            // 1. Update main appointment node
            updates[`appointments/${ownerId}/${appt.id}/status`] = 'cancelled';
            updates[`appointments/${ownerId}/${appt.id}/cancelledAt`] = new Date().toISOString();
            updates[`appointments/${ownerId}/${appt.id}/cancelledBy`] = 'patient';

            // 2. Update patient records index
            updates[`patient_records/${ownerId}/${patientId}/appointments/${appt.id}/status`] = 'cancelled';

            // 3. Mark linked OPD visit as cancelled (if any)
            if (appt.opdVisitId) {
                updates[`opd/${ownerId}/${appt.opdVisitId}/status`] = 'cancelled';
            }

            await update(ref(database), updates);
            alert("Appointment cancelled successfully.");
        } catch (error) {
            console.error("Cancel error:", error);
            alert("Failed to cancel appointment.");
        }
    };

    const handleDeleteHistory = async (apptId: string) => {
        if (!window.confirm("Remove this record from your history?")) return;
        try {
            await remove(ref(database, `patient_records/${ownerId}/${patientId}/appointments/${apptId}`));
        } catch (error) {
            console.error("Delete error:", error);
            alert("Failed to remove record.");
        }
    };

    // Filtered data based on active tab
    const filteredRecords = allRecords.filter(r => activeTab === 'all' || r.type === activeTab);

    // Group records by Date
    const groupedRecords: { [key: string]: any[] } = {};
    filteredRecords.forEach(r => {
        const dateKey = new Date(r.date).toLocaleDateString('en-IN', { 
            day: '2-digit', month: 'short', year: 'numeric' 
        });
        if (!groupedRecords[dateKey]) groupedRecords[dateKey] = [];
        groupedRecords[dateKey].push(r);
    });

    if (loading && !patientData) return null;

    return (
        <div className="space-y-8 pb-12 overflow-x-hidden">
            {/* Hero / Welcome */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 lg:p-12 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-[40%] h-full bg-blue-600/10 skew-x-[-20deg] translate-x-[20%]"></div>
                <div className="relative z-10">
                    <span className="bg-blue-600 text-[10px] font-black tracking-[0.2em] uppercase px-3 py-2 rounded-lg mb-6 inline-block text-white shadow-xl shadow-blue-600/30">
                        Patient Health Dashboard
                    </span>
                    <h1 className="text-3xl lg:text-5xl font-black text-white mb-2 tracking-tighter">
                        Good Day, <span className="text-blue-500 italic lowercase">@{patientData?.name?.split(' ')[0] || 'Member'}</span>
                    </h1>
                    <p className="text-slate-400 text-sm max-w-md font-medium leading-relaxed">
                        Access your medical history, prescriptions, and reports securely.
                    </p>
                </div>
            </div>

            {/* Appointments Section */}
            {appointments.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <i className="fas fa-calendar-check text-blue-600"></i> Scheduled Appointments
                        </h2>
                        <span className="text-[10px] font-bold text-slate-400">{appointments.length} Total</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {appointments.map((appt) => (
                            <div key={appt.id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all group overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Appointment On</p>
                                        <h4 className="font-black text-slate-900 uppercase tracking-tighter">
                                            {(() => {
                                                const d = new Date(appt.date);
                                                if (isNaN(d.getTime())) return appt.date || 'Today';
                                                return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                                            })()} • {appt.time}
                                        </h4>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg self-end mb-2 ${
                                            appt.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                                            appt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                                            'bg-rose-100 text-rose-700'
                                        }`}>
                                            {appt.status}
                                        </span>
                                        {appt.token && appt.status === 'confirmed' && (
                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-1.5 animate-pulse">
                                                <i className="fas fa-ticket-alt"></i> Token #{appt.token}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 pt-3 border-t border-slate-50">
                                    <div className="h-8 w-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                                        <i className="fas fa-user-md text-xs"></i>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Consultant</p>
                                        <p className="text-[10px] font-black text-slate-900 uppercase">Dr. {appt.doctor}</p>
                                    </div>
                                    <div className="ml-auto flex gap-2">
                                        {appt.status === 'rejected' ? (
                                            <button 
                                                onClick={() => handleDeleteHistory(appt.id)}
                                                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all"
                                                title="Delete"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleCancelAppointment(appt)}
                                                className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 text-[8px] font-black uppercase tracking-widest border border-slate-100 transition-all flex items-center gap-1.5"
                                            >
                                                <i className="fas fa-times"></i> Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm sticky top-24 z-40">
                <div className="px-4">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <i className="fas fa-history text-blue-600"></i> Medical History
                    </h2>
                </div>

                <Link href={`/portal/${ownerId}/book`} className="w-full md:w-auto bg-slate-900 hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 no-underline flex items-center justify-center gap-3">
                    <i className="fas fa-plus-circle"></i> New Appointment
                </Link>
            </div>

            {/* Grouped Content Table */}
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {Object.keys(groupedRecords).length > 0 ? (
                    Object.keys(groupedRecords).map((dateKey) => (
                        <div key={dateKey} className="space-y-4">
                            <div className="flex items-center gap-4 px-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full whitespace-nowrap">
                                    {dateKey}
                                </span>
                                <div className="h-[1px] w-full bg-slate-100"></div>
                            </div>

                            <div className="grid gap-3">
                                {groupedRecords[dateKey].map((record) => (
                                    <div 
                                        key={record.id} 
                                        className="bg-white rounded-3xl border border-slate-100 p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 group hover:shadow-2xl hover:border-blue-100 transition-all duration-300"
                                    >
                                        <div className="flex items-center gap-5 w-full md:w-auto">
                                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500 transform group-hover:rotate-12 ${
                                                record.type === 'rx' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
                                            }`}>
                                                <i className={`fas ${record.type === 'rx' ? 'fa-capsules' : 'fa-flask-vial'} text-lg`}></i>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                                        record.type === 'rx' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                                                    }`}>
                                                        {record.type === 'rx' ? 'Prescription' : 'Report'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                        #{record.id.slice(-6).toUpperCase()}
                                                    </span>
                                                </div>
                                                <h4 className="font-black text-slate-900 tracking-tight uppercase truncate max-w-[200px] md:max-w-md">
                                                    {record.title}
                                                </h4>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-6 border-t md:border-0 pt-4 md:pt-0 mt-2 md:mt-0">
                                            <div className="text-left md:text-right">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</p>
                                                <p className={`text-[10px] font-black uppercase ${
                                                    record.status?.toLowerCase() === 'completed' || record.status?.toLowerCase() === 'confirmed' ? 'text-green-600' : 'text-amber-600'
                                                }`}>
                                                    {record.status || 'Verified'}
                                                </p>
                                            </div>
                                            
                                            <button 
                                                onClick={() => window.open(record.type === 'rx' ? `/print/opd/${record.id}?ownerId=${ownerId}` : `/print/report/${record.id}?ownerId=${ownerId}`, '_blank')}
                                                className="bg-slate-900 hover:bg-blue-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-900/10 transition-all active:scale-90"
                                            >
                                                <i className={`fas ${record.type === 'rx' ? 'fa-file-pdf' : 'fa-download'} text-sm`}></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white rounded-[3rem] p-12 lg:p-24 text-center border border-slate-100 shadow-sm">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200 text-4xl mx-auto mb-8 transform rotate-12">
                            <i className="fas fa-folder-open"></i>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase mb-3">No Records Found</h2>
                        <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto italic">
                            Your medical history will appear here once your reports are generated or prescriptions are issued.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
