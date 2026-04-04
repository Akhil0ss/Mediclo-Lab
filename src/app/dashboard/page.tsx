'use client';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, push, onValue, get, query, orderByChild, limitToLast, remove, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { getArrivedReportsForVisit } from '@/lib/clinicLogic';
import { getDataOwnerId } from '@/lib/dataUtils';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const QuickReportModal = dynamic(() => import('@/components/QuickReportModal'), { ssr: false });
const QuickOPDModal = dynamic(() => import('@/components/QuickOPDModal'), { ssr: false });
const QuickPatientModal = dynamic(() => import('@/components/QuickPatientModal'), { ssr: false });
const QuickSampleModal = dynamic(() => import('@/components/QuickSampleModal'), { ssr: false });
const PatientHistoryModal = dynamic(() => import('@/components/PatientHistoryModal'), { ssr: false });
const RxModal = dynamic(() => import('@/components/RxModal'), { ssr: false });

export default function DashboardPage() {
    const router = useRouter();
    const { user, userProfile } = useAuth();
    const [stats, setStats] = useState({ todayPatients: 0, todayReports: 0, todaySamples: 0, pendingSamples: 0, opdWaiting: 0, opdCompleted: 0, opdReferred: 0, onlineAppts: 0 });
    const [pendingSamplesList, setPendingSamplesList] = useState([]);
    const [doctorQueue, setDoctorQueue] = useState<any[]>([]);
    const [doctorStats, setDoctorStats] = useState({ waiting: 0, completed: 0, referred: 0 });
    const [fullOPDQueue, setFullOPDQueue] = useState<any[]>([]);
    const [labReferrals, setLabReferrals] = useState<any[]>([]);
    const [completedRxList, setCompletedRxList] = useState<any[]>([]);
    const [showQuickReportModal, setShowQuickReportModal] = useState(false);
    const [showQuickOPDModal, setShowQuickOPDModal] = useState(false);
    const [showQuickPatientModal, setShowQuickPatientModal] = useState(false);
    const [historyPatient, setHistoryPatient] = useState<any>(null);
    const [historyTab, setHistoryTab] = useState<'visits' | 'samples' | 'reports' | 'ai'>('visits');
    const [showQuickSampleModal, setShowQuickSampleModal] = useState(false);
    const [allRecentReports, setAllRecentReports] = useState<any[]>([]);
    const [selectedVisitForLab, setSelectedVisitForLab] = useState<any>(null);
    const [selectedSample, setSelectedSample] = useState('');
    const [queueSearch, setQueueSearch] = useState('');
    const [rxSearch, setRxSearch] = useState('');
    const [activeRxVisit, setActiveRxVisit] = useState<any>(null);
    const [selectedRxDate, setSelectedRxDate] = useState(new Date().toISOString().split('T')[0]);

    // Doctor Specific State
    const [doctorActiveTab, setDoctorActiveTab] = useState<'dashboard' | 'ref_pats' | 'rx_mgmt'>('dashboard');
    const [queueSubTab, setQueueSubTab] = useState<'regular' | 'emergency'>('regular');

    // Date Keys
    const today = new Date().toISOString().split('T')[0];

    const dataOwnerId = useMemo(() => {
        if (!user) return '';
        return getDataOwnerId(userProfile, user.uid);
    }, [user, userProfile]);

    const isDoctor = userProfile?.role === 'doctor' || userProfile?.role === 'dr-staff';
    const isLab = userProfile?.role === 'lab';
    const isPharmacy = userProfile?.role === 'pharmacy';
    const isOwnerOrAdmin = userProfile?.role === 'owner' || userProfile?.role === 'receptionist' || userProfile?.role === 'admin';

    // Pharmacy Specific State
    const [pharmacyActiveTab, setPharmacyActiveTab] = useState<'pending' | 'dispensed'>('pending');
    const [pharmacyPendingQueue, setPharmacyPendingQueue] = useState<any[]>([]);
    const [pharmacyDispensedList, setPharmacyDispensedList] = useState<any[]>([]);
    const [pharmacyStats, setPharmacyStats] = useState({ pending: 0, dispensedToday: 0 });
    const [pharmacySearch, setPharmacySearch] = useState('');
    const [pharmacyDate, setPharmacyDate] = useState(today);
    const [pharmacyDoctor, setPharmacyDoctor] = useState('all');
    const [doctorsList, setDoctorsList] = useState<any[]>([]);
    const [patientsMap, setPatientsMap] = useState<Record<string, any>>({});

    // 🏥 FETCH PATIENTS MAP (Source of Truth)
    useEffect(() => {
        if (!dataOwnerId) return;
        const ptsRef = ref(database, `patients/${dataOwnerId}`);
        const unsub = onValue(ptsRef, (snap) => {
            if (snap.exists()) {
                setPatientsMap(snap.val());
            } else {
                setPatientsMap({});
            }
        });
        return () => unsub();
    }, [dataOwnerId]);

    const handleDeleteQueue = async (visitId: string) => {
        if (!dataOwnerId) return;
        if (!window.confirm("Are you sure you want to remove this patient from the queue?")) return;
        try {
            await remove(ref(database, `opd/${dataOwnerId}/${visitId}`));
        } catch (error) {
            console.error('Error deleting queue item:', error);
        }
    };

    const handleStartConsultation = async (visit: any) => {
        if (!dataOwnerId) return;
        console.log("Starting consultation for visit:", visit.id);
        try {
            if (visit.status === 'pending') {
                const visitRef = ref(database, `opd/${dataOwnerId}/${visit.id}`);
                await update(visitRef, {
                    status: 'in-consultation',
                    updatedAt: new Date().toISOString()
                });
            }
            setActiveRxVisit(visit);
            console.log("activeRxVisit set to:", visit.id);
        } catch (error) {
            console.error('Error starting consultation:', error);
        }
    };

    const handleDispense = async (visitId: string) => {
        if (!dataOwnerId) return;
        if (!window.confirm("Mark this prescription as dispensed?")) return;
        try {
            const visitRef = ref(database, `opd/${dataOwnerId}/${visitId}`);
            await update(visitRef, {
                pharmacyStatus: 'dispensed',
                dispensedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error dispensing RX:', error);
        }
    };

    useEffect(() => {
        if (!user || !dataOwnerId) return;

        // 1. Patients
        onValue(query(ref(database, 'patients/' + dataOwnerId), orderByChild('createdAt'), limitToLast(50)), (snap) => {
            let count = 0;
            snap.forEach(c => { if (c.val().createdAt?.includes(today)) count++; });
            setStats(p => ({ ...p, todayPatients: count }));
        });

        // 2. Samples (Lab specific)
        if (!isDoctor) {
            onValue(query(ref(database, 'samples/' + dataOwnerId), orderByChild('createdAt'), limitToLast(100)), (snap) => {
                const list: any = [];
                let tCount = 0;
                snap.forEach(c => {
                    const val = c.val();
                    if (val.date?.includes(today)) tCount++;
                    if (val.status === 'Pending' || val.status === 'Processing') {
                        list.push({ id: c.key, ...val });
                    }
                });
                setPendingSamplesList(list.reverse() as any);
                setStats(p => ({ ...p, todaySamples: tCount, pendingSamples: list.length }));
            });
        }

        // 3. Reports
        onValue(query(ref(database, 'reports/' + dataOwnerId), orderByChild('createdAt'), limitToLast(50)), (snap) => {
            let rCount = 0;
            const list: any[] = [];
            snap.forEach(c => { 
                const val = c.val();
                if (val.createdAt?.includes(today)) rCount++; 
                list.push({ id: c.key, ...val });
            });
            setAllRecentReports(list.reverse());
            setStats(p => ({ ...p, todayReports: rCount }));
        });

        // 4. OPD Queue (Universal Synchronization)
        onValue(query(ref(database, 'opd/' + dataOwnerId), orderByChild('visitDate')), (snap) => {
            const docList: any[] = [];
            const fullList: any[] = [];
            const referrals: any[] = [];
            const completedList: any[] = [];

            let globalWaiting = 0;
            let globalInConsult = 0;
            let globalCompleted = 0;
            let globalReferred = 0;

            let dWaiting = 0;
            let dInConsult = 0;
            let dCompleted = 0;
            let dReferred = 0;

            const userId = user?.uid;

            snap.forEach(c => {
                const val = c.val();
                const visit = { id: c.key, ...val };

                // 📊 Global Stats (Main Dash) - Only for TODAY
                if (val.visitDate === today) {
                    if (val.status === 'pending') globalWaiting++;
                    else if (val.status === 'in-consultation') globalInConsult++;
                    else if (val.status === 'completed') globalCompleted++;
                    else if (val.status === 'referred') globalReferred++;

                    // 🏢 Full List (Queue Display) - Only active patients for today
                    if (val.status === 'pending' || val.status === 'in-consultation' || val.status === 'referred') fullList.push(visit);

                    // 🧪 Lab Referrals (Only those on active hold for today)
                    if (val.status === 'referred') {
                        referrals.push(visit);
                    }

                    // 🩺 Doctor Specific (Strict) - Activity for today
                    if (isDoctor && (val.doctorId === userId || userProfile?.role === 'dr-staff')) {
                        if (val.status === 'pending' || val.status === 'in-consultation' || val.status === 'referred') {
                            if (val.status === 'pending') dWaiting++;
                            else if (val.status === 'in-consultation') dInConsult++;
                            else dReferred++;
                            docList.push(visit);
                        } else if (val.status === 'completed') {
                            dCompleted++;
                        }
                    }
                }

                // 📁 RX MANAGEMENT - Any date (Filtered by selectedRxDate)
                if (isDoctor && (val.doctorId === userId || userProfile?.role === 'dr-staff')) {
                    if (val.status === 'completed' && val.visitDate === selectedRxDate) {
                        completedList.push(visit);
                    }
                }
            });

            setDoctorQueue(docList.sort((a, b) => (parseInt(a.token) || 0) - (parseInt(b.token) || 0)));
            setCompletedRxList(completedList.sort((a, b) => (parseInt(b.token) || 0) - (parseInt(a.token) || 0)));
            setDoctorStats({ waiting: dWaiting, completed: dCompleted, referred: dReferred });
            setFullOPDQueue(fullList.sort((a, b) => (parseInt(a.token) || 0) - (parseInt(b.token) || 0)));
            setLabReferrals(referrals.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()));
            setStats(p => ({ ...p, opdWaiting: globalWaiting, opdInConsult: globalInConsult, opdCompleted: globalCompleted, opdReferred: globalReferred }));

            // 💊 PHARMACY SPECIFIC (Only if role is pharmacy or owner/admin)
            if (isPharmacy || isOwnerOrAdmin) {
                const pending: any[] = [];
                const dispensed: any[] = [];
                let dToday = 0;

                snap.forEach(c => {
                    const val = c.val();
                    const pProfile = patientsMap[val.patientId] || {};
                    const visit = {
                        id: c.key,
                        ...val,
                        // Override/Fallback with source of truth from patient profile
                        patientPhone: pProfile.mobile || val.patientPhone || val.mobile || '',
                        patientReadableId: pProfile.patientId || val.opdId || val.patientReadableId || '',
                        patientName: pProfile.name || val.patientName || ''
                    };

                    if (val.status === 'completed' && val.prescription) {
                        if (!val.pharmacyStatus || val.pharmacyStatus === 'pending') {
                            pending.push(visit);
                        } else if (val.pharmacyStatus === 'dispensed') {
                            dispensed.push(visit);
                            if (val.dispensedAt?.includes(today)) dToday++;
                        }
                    }
                });

                setPharmacyPendingQueue(pending.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()));
                setPharmacyDispensedList(dispensed.sort((a, b) => new Date(b.dispensedAt || b.updatedAt).getTime() - new Date(a.dispensedAt || a.updatedAt).getTime()));
                setPharmacyStats({ pending: pending.length, dispensedToday: dToday });
            }
        });

        // 👨‍⚕️ FETCH DOCTORS (For Filters)
        if (isPharmacy || isOwnerOrAdmin) {
            const staffRef = ref(database, `users/${dataOwnerId}/auth/staff`);
            onValue(staffRef, (snap) => {
                if (snap.exists()) {
                    const list: any[] = [];
                    snap.forEach(child => {
                        const val = child.val();
                        if (val.role === 'doctor') {
                            list.push({ id: child.key, name: val.name });
                        }
                    });
                    setDoctorsList(list);
                }
            });
        }

        // 5. Online Appointments
        if (isOwnerOrAdmin) {
            onValue(ref(database, 'appointments/' + dataOwnerId), (snap) => {
                let count = 0;
                snap.forEach(c => {
                    if (c.val().status === 'pending') count++;
                });
                setStats(p => ({ ...p, onlineAppts: count }));
            });
        }

    }, [user, dataOwnerId, today, isDoctor, userProfile, selectedRxDate, patientsMap, isOwnerOrAdmin]);

    if (!user) return null;

    if (isPharmacy) {
        const filteredDispensed = pharmacyDispensedList.filter(v => {
            const matchesSearch = v.patientName?.toLowerCase().includes(pharmacySearch.toLowerCase()) || v.token?.toString().includes(pharmacySearch);
            const matchesDate = !pharmacyDate || v.dispensedAt?.includes(pharmacyDate);
            const matchesDoctor = pharmacyDoctor === 'all' || v.doctorId === pharmacyDoctor;
            return matchesSearch && matchesDate && matchesDoctor;
        });

        return (
            <div className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-gray-50/50 min-h-screen">
                <div className="space-y-3">
                    {/* Compact Inline Header: Stats + Tabs */}
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
                        {/* Stats Group */}
                        <div className="flex gap-3 w-full lg:w-auto">
                            <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 transition-all flex-1 lg:flex-none">
                                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 text-xs">
                                    <i className="fas fa-prescription"></i>
                                </div>
                                <div className="whitespace-nowrap">
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Waiting</p>
                                    <h3 className="text-sm font-black text-gray-800">{pharmacyStats.pending}</h3>
                                </div>
                            </div>
                            <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 transition-all flex-1 lg:flex-none">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 text-xs">
                                    <i className="fas fa-check-circle"></i>
                                </div>
                                <div className="whitespace-nowrap">
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Dispensed</p>
                                    <h3 className="text-sm font-black text-gray-800">{pharmacyStats.dispensedToday}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Tabs Group */}
                        <div className="flex bg-gray-200/50 p-1 rounded-lg w-full lg:w-auto border border-gray-100">
                            <button
                                onClick={() => setPharmacyActiveTab('pending')}
                                className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all gap-1.5 flex items-center justify-center flex-1 lg:flex-none ${pharmacyActiveTab === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <i className="fas fa-clock"></i> Pending
                            </button>
                            <button
                                onClick={() => setPharmacyActiveTab('dispensed')}
                                className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all gap-1.5 flex items-center justify-center flex-1 lg:flex-none ${pharmacyActiveTab === 'dispensed' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <i className="fas fa-history"></i> Dispensed History
                            </button>
                        </div>
                    </div>

                    {/* Pharmacy Table Container */}
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                        {pharmacyActiveTab === 'dispensed' && (
                            <div className="p-2 border-b border-gray-50 bg-gray-50/30 flex flex-wrap items-center gap-2">
                                <div className="relative flex-1 min-w-[150px] lg:max-w-[200px]">
                                    <i className="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[9px]"></i>
                                    <input
                                        type="text"
                                        placeholder="Search Patient..."
                                        value={pharmacySearch}
                                        onChange={e => setPharmacySearch(e.target.value)}
                                        className="w-full bg-white border border-gray-200 pl-7 pr-3 py-1 rounded-lg text-[9px] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all uppercase"
                                    />
                                </div>
                                <select
                                    value={pharmacyDoctor}
                                    onChange={e => setPharmacyDoctor(e.target.value)}
                                    className="bg-white border border-gray-200 px-2 py-1 rounded-lg text-[9px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                >
                                    <option value="all">All Doctors</option>
                                    {doctorsList.map(doc => (
                                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                                    ))}
                                </select>
                                <input
                                    type="date"
                                    value={pharmacyDate}
                                    onChange={e => setPharmacyDate(e.target.value)}
                                    className="bg-white border border-gray-200 px-2 py-1 rounded-lg text-[9px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                />
                            </div>
                        )}

                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 w-12 text-center">Token</th>
                                        <th className="px-4 py-3">Patient ID</th>
                                        <th className="px-4 py-3">Patient</th>
                                        <th className="px-4 py-3">Phone</th>
                                        <th className="px-4 py-3">Doctor</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(pharmacyActiveTab === 'pending' ? pharmacyPendingQueue : filteredDispensed).length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                                                <div className="flex flex-col items-center gap-3 opacity-30">
                                                    <i className={`fas ${pharmacyActiveTab === 'pending' ? 'fa-prescription' : 'fa-history'} text-4xl`}></i>
                                                    <p className="text-[9px] font-black uppercase tracking-widest">{pharmacyActiveTab === 'pending' ? 'Queue Clear' : 'No Records'}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        (pharmacyActiveTab === 'pending' ? pharmacyPendingQueue : filteredDispensed).map((v) => (
                                            <tr key={v.id} className="hover:bg-gray-50 transition-colors group text-[11px]">
                                                <td className="px-4 py-2.5 text-center">
                                                    <div className={`inline-flex w-7 h-7 rounded-lg items-center justify-center font-black text-[9px] shadow-sm ${v.pharmacyStatus === 'dispensed' ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white animate-pulse'}`}>
                                                        {v.token}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 font-bold text-gray-600 whitespace-nowrap">
                                                    {v.patientReadableId || <span className="opacity-30 italic text-[9px]">N/A</span>}
                                                </td>
                                                <td className="px-4 py-2.5 font-black text-gray-900 uppercase tracking-tighter whitespace-nowrap">
                                                    {v.patientName}
                                                </td>
                                                <td className="px-4 py-2.5 font-bold text-gray-500 whitespace-nowrap">
                                                    <i className="fas fa-phone-alt text-[7px] mr-1.5 opacity-50"></i>{patientsMap[v.patientId]?.mobile || v.patientPhone || v.mobile || <span className="opacity-30 font-normal italic">N/A</span>}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">
                                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-black tracking-tighter uppercase whitespace-nowrap border border-blue-100">Dr. {v.doctorName}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setActiveRxVisit(v)}
                                                            className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors shrink-0"
                                                            title="View RX"
                                                        >
                                                            <i className="fas fa-eye text-[10px]"></i>
                                                        </button>
                                                        {pharmacyActiveTab === 'pending' ? (
                                                            <button
                                                                onClick={() => handleDispense(v.id)}
                                                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1"
                                                            >
                                                                <i className="fas fa-check text-[8px]"></i> DISPENSE
                                                            </button>
                                                        ) : (
                                                            <div className="flex flex-col items-end shrink-0">
                                                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">Delivered</span>
                                                                <span className="text-[8px] font-bold text-gray-400">{new Date(v.dispensedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <PatientHistoryModal
                    isOpen={!!historyPatient}
                    onClose={() => { setHistoryPatient(null); setHistoryTab('visits'); }}
                    patientId={historyPatient?.id || ''}
                    patientName={historyPatient?.name || ''}
                    ownerId={dataOwnerId}
                    role={userProfile?.role}
                    defaultTab={historyTab === 'samples' ? 'visits' : historyTab}
                    onViewRx={setActiveRxVisit}
                />

                <RxModal
                    isOpen={!!activeRxVisit}
                    onClose={() => setActiveRxVisit(null)}
                    visit={activeRxVisit}
                    ownerId={dataOwnerId}
                    doctorName={userProfile?.name?.split(' ')[0]}
                    labName={userProfile?.labName}
                    readOnly={!isDoctor}
                    isPharmacy={isPharmacy}
                    patientDisplayId={patientsMap[activeRxVisit?.patientId]?.patientId}
                />
            </div>
        );
    }

    if (isDoctor) {
        return (
            <div className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-gray-50/50 min-h-screen">
                <div className="space-y-4">
                    {/* Unified Doctor Clinical Header (Fixed & Inline) */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm sticky top-0 z-30">
                        {/* Clinical Tabs */}
                        <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto scrollbar-hide">
                            <button
                                onClick={() => setDoctorActiveTab('dashboard')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${doctorActiveTab === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <i className="fas fa-th-large"></i> Dashboard
                            </button>
                            <button
                                onClick={() => setDoctorActiveTab('ref_pats')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${doctorActiveTab === 'ref_pats' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <i className="fas fa-external-link-alt"></i> Ref Pats
                            </button>
                            <button
                                onClick={() => setDoctorActiveTab('rx_mgmt')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${doctorActiveTab === 'rx_mgmt' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <i className="fas fa-file-medical"></i> Rx Mgmt
                            </button>
                        </div>

                        {/* Inline Status Badges */}
                        <div className="flex items-center gap-2 px-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 min-w-fit justify-center">
                                <span className="text-[10px] font-black whitespace-nowrap">W:{doctorStats.waiting}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 min-w-fit justify-center">
                                <span className="text-[10px] font-black whitespace-nowrap">D:{doctorStats.completed}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 min-w-fit justify-center">
                                <span className="text-[10px] font-black whitespace-nowrap">H:{doctorStats.referred}</span>
                            </div>
                        </div>
                    </div>

                    {doctorActiveTab === 'dashboard' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Patient List Section */}
                            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
                                <div className="p-4 md:p-6 border-b border-gray-100 bg-gray-50/30">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        {/* Sub-tab Switcher */}
                                        <div className="flex items-center bg-gray-200/50 p-1 rounded-xl w-full md:w-auto relative">
                                            <button
                                                onClick={() => setQueueSubTab('regular')}
                                                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${queueSubTab === 'regular' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                Regular
                                            </button>
                                            <button
                                                onClick={() => setQueueSubTab('emergency')}
                                                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${queueSubTab === 'emergency' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-red-600'}`}
                                            >
                                                Emergency
                                                {doctorQueue.some(v => v.isEmergency && (v.status === 'pending' || v.status === 'in-consultation')) && (
                                                    <span className="relative flex h-2.5 w-2.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-sm border border-white"></span>
                                                    </span>
                                                )}
                                            </button>
                                        </div>

                                        {/* Search Filter Inline */}
                                        <div className="relative w-full md:w-64">
                                            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]"></i>
                                            <input
                                                type="text"
                                                placeholder="Search Queue..."
                                                value={queueSearch}
                                                onChange={(e) => setQueueSearch(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Mobile Queue Cards (Visible on Small Screens) */}
                                <div className="lg:hidden divide-y divide-gray-100">
                                    {doctorQueue
                                        .filter(v =>
                                            (queueSubTab === 'emergency' ? v.isEmergency === true : !v.isEmergency) &&
                                            (v.status !== 'referred') &&
                                            (v.patientName.toLowerCase().includes(queueSearch.toLowerCase()) || v.token.toString().includes(queueSearch))
                                        ).length === 0 ? (
                                        <div className="p-12 text-center text-gray-400 italic text-xs uppercase tracking-widest">No patients in queue</div>
                                    ) : (
                                        doctorQueue
                                            .filter(v =>
                                                (queueSubTab === 'emergency' ? v.isEmergency === true : !v.isEmergency) &&
                                                (v.status !== 'referred') &&
                                                (v.patientName.toLowerCase().includes(queueSearch.toLowerCase()) || v.token.toString().includes(queueSearch))
                                            ).map((v) => (
                                                <div key={v.id} className="p-3 bg-white">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center text-[11px] font-black shadow-md shrink-0">
                                                                {v.token}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="text-[13px] font-black text-gray-900 truncate uppercase tracking-tight">{v.patientName}</h4>
                                                                    <span className="text-[8px] font-black bg-gray-50 text-gray-400 px-1 py-0.5 rounded tracking-tighter shrink-0">{v.patientAge}{v.patientGender[0]}</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {!Object.values(v.vitals || {}).some(val => val) ? (
                                                                        <span className="text-[7px] font-black text-gray-500 uppercase tracking-tighter italic px-1 py-0.5 bg-gray-100 border border-gray-200 rounded">N/A</span>
                                                                    ) : (
                                                                        <>
                                                                            {v.vitals?.bp && <span className="text-[7px] font-black text-red-600 uppercase border border-red-100 px-1 py-0.5 rounded leading-none">{v.vitals.bp}</span>}
                                                                            {v.vitals?.pulse && <span className="text-[7px] font-black text-blue-600 uppercase border border-blue-100 px-1 py-0.5 rounded leading-none">{v.vitals.pulse}</span>}
                                                                            {v.vitals?.spo2 && <span className="text-[7px] font-black text-cyan-600 uppercase border border-cyan-100 px-1 py-0.5 rounded leading-none">{v.vitals.spo2}%</span>}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                onClick={() => { setHistoryTab('visits'); setHistoryPatient({ id: v.patientId, name: v.patientName }); }}
                                                                className="w-8 h-8 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center text-[10px] border border-gray-100"
                                                            >
                                                                <i className="fas fa-history"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => handleStartConsultation(v)}
                                                                className="px-4 py-2 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg"
                                                            >
                                                                RX
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                            )
                                    )
                                    }
                                </div>

                                <div className="hidden lg:block overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-6 py-3 w-20">Token</th>
                                                <th className="px-6 py-3">Patient Profile</th>
                                                <th className="px-6 py-3">Current Vitals</th>
                                                <th className="px-6 py-3 text-right">Clinical Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 bg-white">
                                            {doctorQueue
                                                .filter(v =>
                                                    (queueSubTab === 'emergency' ? v.isEmergency === true : !v.isEmergency) &&
                                                    (v.status !== 'referred') &&
                                                    (v.patientName.toLowerCase().includes(queueSearch.toLowerCase()) || v.token.toString().includes(queueSearch))
                                                ).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-24 text-center">
                                                        <div className="flex flex-col items-center gap-4">
                                                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                                                                <i className="fas fa-user-md text-4xl"></i>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black text-gray-900 uppercase tracking-widest">No Patients Found</p>
                                                                <p className="text-xs text-gray-400 mt-1 italic">Queue is clear for this category.</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                doctorQueue
                                                    .filter(v =>
                                                        (queueSubTab === 'emergency' ? v.isEmergency === true : !v.isEmergency) &&
                                                        (v.status !== 'referred') &&
                                                        (v.patientName.toLowerCase().includes(queueSearch.toLowerCase()) || v.token.toString().includes(queueSearch))
                                                    )
                                                    .map((v) => (
                                                        <tr key={v.id} className="group hover:bg-blue-50/10 transition-all border-b border-gray-50 last:border-0 text-[13px]">
                                                            <td className="px-4 py-2">
                                                                <div className="w-8 h-8 bg-white border-2 border-blue-600 text-blue-600 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm">
                                                                    {v.token}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className="font-black text-gray-900 group-hover:text-blue-700 transition-colors uppercase tracking-tight truncate">{v.patientName}</span>
                                                                    <span className="text-[8px] font-black bg-gray-50 text-gray-400 px-1 py-0.5 rounded tracking-tighter shrink-0">{v.patientAge}Y/{v.patientGender[0]}</span>
                                                                    {v.isEmergency && <span className="bg-red-600 text-white text-[7px] font-black px-1 py-0.5 rounded uppercase tracking-widest animate-pulse shrink-0">ER</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {!Object.values(v.vitals || {}).some(val => val) ? (
                                                                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter italic px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded">Vitals Pending (N/A)</span>
                                                                    ) : (
                                                                        <>
                                                                            {v.vitals?.bp && (
                                                                                <div className={`px-1.5 py-0.5 rounded border text-[8px] font-black ${(() => {
                                                                                        try {
                                                                                            const sys = parseInt(v.vitals.bp.split('/')[0]);
                                                                                            return sys >= 140 ? 'bg-red-600 text-white border-red-700' : 'bg-red-50 text-red-600 border-red-100';
                                                                                        } catch (e) { return 'bg-red-50 text-red-600 border-red-100'; }
                                                                                    })()
                                                                                    }`}>
                                                                                    {v.vitals.bp}
                                                                                </div>
                                                                            )}
                                                                            {v.vitals?.pulse && <div className="px-1.5 py-0.5 bg-gray-50 border border-gray-100 rounded text-[8px] font-black text-gray-600">P:{v.vitals.pulse}</div>}
                                                                            {v.vitals?.spo2 && <div className={`px-1.5 py-0.5 rounded border text-[8px] font-black ${parseInt(v.vitals.spo2) < 95 ? 'bg-rose-600 text-white border-rose-700' : 'bg-cyan-50 text-cyan-600 border-cyan-100'}`}>O2:{v.vitals.spo2}%</div>}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button onClick={() => { setHistoryTab('ai'); setHistoryPatient({ id: v.patientId, name: v.patientName }); }} className="w-7 h-7 bg-purple-50 text-purple-400 hover:bg-purple-600 hover:text-white rounded flex items-center justify-center transition-all border border-purple-100" title="AI"><i className="fas fa-brain text-[9px]"></i></button>
                                                                    <button onClick={() => { setHistoryTab('visits'); setHistoryPatient({ id: v.patientId, name: v.patientName }); }} className="w-7 h-7 bg-gray-50 text-gray-400 hover:bg-blue-600 hover:text-white rounded flex items-center justify-center transition-all border border-gray-100" title="History"><i className="fas fa-history text-[9px]"></i></button>
                                                                    <button
                                                                        onClick={() => handleStartConsultation(v)}
                                                                        className={`px-3 py-1.5 rounded text-[9px] font-black shadow-md transition-all active:scale-95 flex items-center gap-1.5 uppercase tracking-widest ${v.status === 'in-consultation' ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'
                                                                            }`}
                                                                    >
                                                                        <i className={`fas ${v.status === 'in-consultation' ? 'fa-play' : 'fa-plus'}`}></i>
                                                                        {v.status === 'in-consultation' ? 'RESUME' : 'RX'}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {doctorActiveTab === 'ref_pats' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
                                <div className="p-4 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
                                    <h3 className="text-[10px] font-black text-gray-700 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <i className="fas fa-external-link-alt text-indigo-500"></i> Lab Referral Queue
                                    </h3>
                                    <span className="text-[8px] font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded shadow-sm uppercase tracking-widest">Active Holds: {labReferrals.length}</span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                            <tr>
                                                <th className="px-6 py-4 w-20">Token</th>
                                                <th className="px-6 py-4">Patient Profile</th>
                                                <th className="px-6 py-4">Clinical Referrals</th>
                                                <th className="px-6 py-4 w-40 text-right">Resume Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {labReferrals.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                                            <i className="fas fa-inbox text-4xl"></i>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Queue Clear</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                labReferrals.map(v => (
                                                    <tr key={v.id} className="group hover:bg-indigo-50/10 transition-all border-b border-gray-50 last:border-0 text-[13px]">
                                                        <td className="px-4 py-2">
                                                            <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black shadow-sm text-[11px]">
                                                                {v.token}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="font-black text-gray-900 uppercase tracking-tight truncate">{v.patientName}</span>
                                                                <span className="text-[8px] font-black bg-gray-50 text-gray-400 px-1 py-0.5 rounded tracking-tighter shrink-0">{v.patientAge}Y/{v.patientGender[0]}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <div className="flex flex-wrap gap-1">
                                                                {v.prescription?.referredTests?.map((t: string, i: number) => (
                                                                    <span key={i} className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 text-[8px] font-black uppercase tracking-tighter">
                                                                        {t}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 text-right">
                                                            <button
                                                                onClick={() => handleStartConsultation(v)}
                                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-widest rounded shadow-md transition-all active:scale-95 flex items-center gap-2 ml-auto"
                                                            >
                                                                <i className="fas fa-sign-in-alt"></i> RESUME
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {doctorActiveTab === 'rx_mgmt' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
                                <div className="p-3 border-b border-gray-50 bg-gray-50/30 flex flex-col md:flex-row justify-between items-center gap-3">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-[10px] font-black text-gray-700 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <i className="fas fa-file-medical text-purple-600"></i> Clinical Records
                                        </h3>
                                        <div className="h-4 w-[1px] bg-gray-200 hidden md:block"></div>
                                        <span className="text-[8px] font-black bg-purple-100 text-purple-700 px-2 py-1 rounded shadow-sm uppercase tracking-widest whitespace-nowrap">Found: {completedRxList.filter(v => v.patientName.toLowerCase().includes(rxSearch.toLowerCase()) || v.token.toString().includes(rxSearch)).length}</span>
                                    </div>

                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                        <div className="relative flex-1 md:w-64">
                                            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]"></i>
                                            <input
                                                type="text"
                                                placeholder="Search Name / Token / Rx-ID..."
                                                value={rxSearch}
                                                onChange={e => setRxSearch(e.target.value)}
                                                className="w-full bg-white border border-gray-200 pl-8 pr-4 py-1.5 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-purple-500 transition-all uppercase"
                                            />
                                        </div>
                                        <input
                                            type="date"
                                            value={selectedRxDate}
                                            onChange={e => setSelectedRxDate(e.target.value)}
                                            className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                            <tr>
                                                <th className="px-6 py-3 w-20">Token</th>
                                                <th className="px-6 py-3">Patient Profile</th>
                                                <th className="px-6 py-3">Prescription Details</th>
                                                <th className="px-6 py-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {completedRxList.filter(v =>
                                                v.patientName.toLowerCase().includes(rxSearch.toLowerCase()) ||
                                                v.token.toString().includes(rxSearch) ||
                                                (v.rxId && v.rxId.toLowerCase().includes(rxSearch.toLowerCase()))
                                            ).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-16 text-center">
                                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                                            <i className="fas fa-search-minus text-4xl"></i>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">No Records Match Your Filter</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                completedRxList
                                                    .filter(v =>
                                                        v.patientName.toLowerCase().includes(rxSearch.toLowerCase()) ||
                                                        v.token.toString().includes(rxSearch) ||
                                                        (v.rxId && v.rxId.toLowerCase().includes(rxSearch.toLowerCase()))
                                                    )
                                                    .map(v => (
                                                        <tr key={v.id} className="group hover:bg-purple-50/10 transition-all border-b border-gray-50 last:border-0 text-[13px]">
                                                            <td className="px-4 py-2">
                                                                <div className="w-8 h-8 bg-purple-600 text-white rounded-lg flex items-center justify-center font-black shadow-sm text-[11px]">
                                                                    {v.token}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className="font-black text-gray-900 uppercase tracking-tight truncate">{v.patientName}</span>
                                                                    <span className="text-[8px] font-black bg-gray-50 text-gray-400 px-1 py-0.5 rounded tracking-tighter shrink-0">{v.patientAge}Y/{v.patientGender[0]}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-tight">{v.rxId || 'N/A'}</span>
                                                                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-0.5">{v.updatedAt ? new Date(v.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Completed'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                <div className="flex justify-end gap-2 items-center">
                                                                    <button
                                                                        onClick={() => window.open(`/print/opd/${v.id}`, '_blank')}
                                                                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100 shadow-sm"
                                                                        title="Direct Print Prescription"
                                                                    >
                                                                        <i className="fas fa-print text-[10px]"></i>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setActiveRxVisit(v)}
                                                                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-600 text-purple-600 hover:text-white text-[9px] font-black uppercase tracking-widest rounded border border-purple-100 transition-all active:scale-95 flex items-center gap-2"
                                                                    >
                                                                        <i className="fas fa-eye"></i> View Rx
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    <PatientHistoryModal
                        isOpen={!!historyPatient}
                        onClose={() => { setHistoryPatient(null); setHistoryTab('visits'); }}
                        patientId={historyPatient?.id || ''}
                        patientName={historyPatient?.name || ''}
                        ownerId={dataOwnerId}
                        role={userProfile?.role}
                        defaultTab={historyTab === 'samples' ? 'visits' : historyTab}
                        onViewRx={setActiveRxVisit}
                    />

                    {/* AI Rx Modal for Doctors */}
                    <RxModal
                        isOpen={!!activeRxVisit}
                        onClose={() => setActiveRxVisit(null)}
                        visit={activeRxVisit}
                        ownerId={dataOwnerId}
                        doctorName={userProfile?.name?.split(' ')[0]}
                        labName={userProfile?.labName}
                        readOnly={!isDoctor}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between gap-4 mb-6 bg-white p-3 rounded-full border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide whitespace-nowrap sticky top-0 z-40 backdrop-blur-md bg-white/90">
                <div className="flex items-center gap-4 shrink-0 px-2">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-xl font-bold text-gray-800 tracking-tight leading-none">{isOwnerOrAdmin ? 'Clinic Dashboard' : 'Lab Dashboard'}</h1>
                            <p className="text-gray-500 text-[10px] leading-none mt-1">Welcome back, {userProfile?.name}</p>
                        </div>

                        {/* Online Appts Pill - Moved directly after heading text */}
                        {isOwnerOrAdmin && stats.onlineAppts > 0 && (
                            <div 
                                onClick={() => (window as any).dispatchEvent(new CustomEvent('openOnlineAppts'))}
                                className="bg-indigo-600 text-white px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg shadow-indigo-100 cursor-pointer animate-in zoom-in duration-300 active:scale-95 shrink-0 ml-2"
                            >
                                <i className="fas fa-calendar-check text-[9px]"></i>
                                <span className="text-[9px] font-black uppercase tracking-widest">{stats.onlineAppts} Appts</span>
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="h-6 w-[1px] bg-gray-100 mx-1"></div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-2">
                        {isOwnerOrAdmin && (
                            <button
                                onClick={() => setShowQuickPatientModal(true)}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0">
                                <i className="fas fa-user-plus text-[8px]"></i> Add Patient
                            </button>
                        )}
                        {(isOwnerOrAdmin || isLab) && (
                            <button
                                onClick={() => setShowQuickSampleModal(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0">
                                <i className="fas fa-vial text-[8px]"></i> Add Sample
                            </button>
                        )}
                        {isOwnerOrAdmin && (
                            <button
                                onClick={() => setShowQuickOPDModal(true)}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0">
                                <i className="fas fa-stethoscope text-[8px]"></i> Create OPD
                            </button>
                        )}
                        {(isLab || isOwnerOrAdmin) && (
                            <button onClick={() => { setSelectedSample(''); setShowQuickReportModal(true); }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0">
                                <i className="fas fa-plus-circle text-[8px]"></i> Create Report
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Restored Stats Grid */}
            <div className={`grid gap-4 mb-8 ${isLab ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'}`}>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-xl shadow-sm border border-amber-100 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div><p className="text-[10px] font-black text-amber-700 uppercase tracking-tighter whitespace-nowrap">Pending</p><p className="text-2xl font-black text-amber-900 leading-none mt-1">{stats.pendingSamples}</p></div>
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white shadow-lg"><i className="fas fa-hourglass-half text-sm"></i></div>
                </div>
                <div className="bg-gradient-to-br from-sky-50 to-blue-50 p-4 rounded-xl shadow-sm border border-sky-100 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div><p className="text-[10px] font-black text-sky-700 uppercase tracking-tighter whitespace-nowrap">Vials</p><p className="text-2xl font-black text-sky-900 leading-none mt-1">{stats.todaySamples}</p></div>
                    <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-blue-500 rounded-full flex items-center justify-center text-white shadow-lg"><i className="fas fa-vial text-sm"></i></div>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-xl shadow-sm border border-emerald-100 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div><p className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter whitespace-nowrap">Reports</p><p className="text-2xl font-black text-emerald-900 leading-none mt-1">{stats.todayReports}</p></div>
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white shadow-lg"><i className="fas fa-file-medical-alt text-sm"></i></div>
                </div>
                
                {!isLab && (
                    <>
                        <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-xl shadow-sm border border-purple-100 flex items-center justify-between hover:shadow-md transition-shadow">
                            <div><p className="text-[10px] font-black text-purple-700 uppercase tracking-tighter whitespace-nowrap">Patients</p><p className="text-2xl font-black text-purple-900 leading-none mt-1">{stats.todayPatients}</p></div>
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-violet-500 rounded-full flex items-center justify-center text-white shadow-lg"><i className="fas fa-user-plus text-sm"></i></div>
                        </div>
                        <div className="bg-gradient-to-br from-rose-50 to-red-50 p-4 rounded-xl shadow-sm border border-rose-100 flex items-center justify-between hover:shadow-md transition-shadow">
                            <div><p className="text-[10px] font-black text-rose-700 uppercase tracking-tighter whitespace-nowrap">OPD Wait</p><p className="text-2xl font-black text-rose-900 leading-none mt-1">{stats.opdWaiting}</p></div>
                            <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-red-500 rounded-full flex items-center justify-center text-white shadow-lg"><i className="fas fa-clock text-sm"></i></div>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-xl shadow-sm border border-indigo-100 flex items-center justify-between hover:shadow-md transition-shadow">
                            <div><p className="text-[10px] font-black text-indigo-700 uppercase tracking-tighter whitespace-nowrap">OPD Done</p><p className="text-2xl font-black text-indigo-900 leading-none mt-1">{stats.opdCompleted}</p></div>
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-blue-500 rounded-full flex items-center justify-center text-white shadow-lg"><i className="fas fa-check-double text-sm"></i></div>
                        </div>
                    </>
                )}
            </div>


            <div className={`grid grid-cols-1 ${isLab ? '' : 'lg:grid-cols-2'} gap-6`}>
                {/* 1. Laboratory Samples Queue */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest flex items-center gap-2">
                            <i className="fas fa-flask text-indigo-500"></i> Lab Samples Queue
                        </h3>
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">TODAY</span>
                    </div>
                    <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase">
                                <tr>
                                    <th className="px-3 py-2 whitespace-nowrap">ID</th>
                                    <th className="px-3 py-2 whitespace-nowrap">Patient</th>
                                    <th className="px-3 py-2 whitespace-nowrap">Type / Vial</th>
                                    <th className="px-3 py-2 text-right whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {pendingSamplesList.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-gray-400 italic text-sm">No samples pending today.</td></tr>
                                ) : (
                                    pendingSamplesList.map(s => (
                                        <tr key={s.id} className="hover:bg-blue-50/30 transition group">
                                            <td className="px-3 py-2 font-mono font-bold text-indigo-600 text-[10px] whitespace-nowrap">{s.sampleNumber}</td>
                                            <td className="px-3 py-2 font-bold text-gray-800 text-xs truncate max-w-[100px] md:max-w-[140px]" title={s.patientName}>{s.patientName}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded-[4px] text-[8px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">{s.sampleType}</span>
                                                    {s.containerType && <span className="text-[8px] text-indigo-400 font-bold opacity-60 whitespace-nowrap">/ {s.containerType}</span>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                {userProfile?.role === 'lab' ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setHistoryPatient({ id: s.patientId, name: s.patientName });
                                                                setHistoryTab('reports');
                                                            }}
                                                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                            title="View Patient History"
                                                        >
                                                            <i className="fas fa-eye text-[10px]"></i>
                                                        </button>
                                                        <button onClick={() => { setSelectedSample(s.id); setShowQuickReportModal(true); }}
                                                            className="text-[9px] bg-indigo-600 dark:bg-indigo-500 hover:scale-105 active:scale-95 text-white px-3 py-1.5 rounded-lg font-black transition-all uppercase tracking-widest shadow-md shadow-indigo-100">
                                                            Prepare Result
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded border border-amber-100 animate-pulse">
                                                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0"></div>
                                                        <span className="text-[8px] text-amber-700 font-black uppercase tracking-widest">In Queue</span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. Clinic OPD Queue (Real-time Sync) - Hidden for Lab */}
                {!isLab && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest flex items-center gap-2">
                                <i className="fas fa-stethoscope text-blue-500"></i> LIVE OPD Arrivals
                            </h3>
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">LIVE QUEUE</span>
                        </div>
                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase">
                                    <tr>
                                        <th className="px-3 py-2 whitespace-nowrap">Token</th>
                                        <th className="px-3 py-2 whitespace-nowrap">Patient</th>
                                        <th className="px-3 py-2 whitespace-nowrap">Assigned Dr</th>
                                        <th className="px-3 py-2 text-right whitespace-nowrap">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {fullOPDQueue.length === 0 ? (
                                        <tr><td colSpan={4} className="p-12 text-center text-gray-400 italic text-sm">No clinical arrivals for today.</td></tr>
                                    ) : (
                                        fullOPDQueue.map(v => {
                                            const arrivedReports = getArrivedReportsForVisit(v, allRecentReports);
                                            const hasReports = arrivedReports.length > 0;
                                            
                                            return (
                                            <tr key={v.id} className={`hover:bg-blue-50/30 transition ${v.isEmergency && v.status === 'pending' ? 'bg-red-50/50 border-l-4 border-red-500' : ''}`}>
                                                <td className="px-3 py-2 flex items-center gap-1.5">
                                                    <span className={`text-sm font-black ${v.isEmergency && v.status === 'pending' ? 'text-red-700 animate-pulse' : 'text-blue-600'}`}>#{v.token}</span>
                                                    {v.isEmergency && v.status === 'pending' && <i className="fas fa-circle text-[6px] text-red-600 animate-ping"></i>}
                                                    {hasReports && (v.status === 'referred' || v.status === 'pending') && (
                                                        <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-[7px] font-black animate-bounce shadow-sm flex items-center gap-0.5">
                                                            REPORT <i className="fas fa-check text-[6px]"></i>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 font-bold text-gray-800 text-xs truncate max-w-[100px] md:max-w-[140px]" title={v.patientName}>{v.patientName}</td>
                                                <td className="px-3 py-2 text-[10px] font-semibold text-gray-500 whitespace-nowrap">Dr. {v.doctorName?.split(' ')[0]}</td>
                                                <td className="px-3 py-2 text-right">
                                                    {userProfile?.role === 'doctor' ? (
                                                        <div className="flex items-center gap-1.5 justify-end">
                                                            <button
                                                                onClick={() => {
                                                                    setHistoryPatient({ id: v.patientId, name: v.patientName });
                                                                    setHistoryTab('ai');
                                                                }}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 shadow-sm"
                                                                title="AI Clinical Insight"
                                                            >
                                                                <i className="fas fa-brain text-[10px]"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => handleStartConsultation(v)}
                                                                className={`text-[9px] px-2 py-1.5 rounded font-black transition uppercase cursor-pointer whitespace-nowrap ${v.status === 'in-consultation'
                                                                        ? 'bg-indigo-600 text-white'
                                                                        : v.status === 'referred'
                                                                            ? 'bg-orange-600 text-white shadow-lg shadow-orange-100'
                                                                            : (v.isEmergency && v.status === 'pending' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-green-600 text-white hover:bg-green-700 shadow-sm')
                                                                    }`}
                                                            >
                                                                {v.status === 'in-consultation' ? 'RESUME' : (v.status === 'referred' ? 'LAB RE-CONSULT' : (v.isEmergency && v.status === 'pending' ? 'URGENT' : 'START'))}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 justify-end">
                                                            <div className={`text-[9px] px-2 py-1.5 rounded font-black uppercase whitespace-nowrap select-none flex items-center gap-1.5 ${v.status === 'in-consultation'
                                                                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-200'
                                                                    : v.status === 'referred'
                                                                        ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                                                        : v.status === 'completed'
                                                                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-100'
                                                                            : (v.status === 'pending'
                                                                                ? (v.isEmergency ? 'bg-red-600 text-white shadow-lg shadow-red-200 animate-pulse' : 'bg-slate-100 text-slate-600 border border-slate-200')
                                                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100')
                                                                }`}>
                                                                {v.status === 'in-consultation' && (
                                                                    <span className="relative flex h-1.5 w-1.5">
                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75"></span>
                                                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white shadow-sm"></span>
                                                                    </span>
                                                                )}
                                                                {v.status === 'pending' ? (v.isEmergency ? 'URGENT' : 'WAITING') : (v.status === 'in-consultation' ? 'IN CONSULT' : (v.status === 'referred' ? 'SENT TO LAB' : 'CONSULTED'))}
                                                            </div>
                                                            {v.status === 'completed' && (
                                                                <button
                                                                    onClick={() => setActiveRxVisit(v)}
                                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200 shadow-sm"
                                                                    title="View Prescription"
                                                                >
                                                                    <i className="fas fa-eye text-[10px]"></i>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteQueue(v.id)}
                                                                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                                title="Remove Queue Entry"
                                                            >
                                                                <i className="fas fa-times text-[10px]"></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {showQuickReportModal && (
                <QuickReportModal onClose={() => setShowQuickReportModal(false)} ownerId={dataOwnerId} initialSampleId={selectedSample} />
            )}
            {showQuickOPDModal && (
                <QuickOPDModal isOpen={showQuickOPDModal} onClose={() => setShowQuickOPDModal(false)} ownerId={dataOwnerId} />
            )}
            {showQuickPatientModal && (
                <QuickPatientModal isOpen={showQuickPatientModal} onClose={() => setShowQuickPatientModal(false)} ownerId={dataOwnerId} />
            )}
            {showQuickSampleModal && (
                <QuickSampleModal 
                    isOpen={showQuickSampleModal} 
                    onClose={() => {
                        setShowQuickSampleModal(false);
                        setSelectedVisitForLab(null);
                    }} 
                    ownerId={dataOwnerId} 
                    labName={userProfile?.labName} 
                    initialVisit={selectedVisitForLab}
                />
            )}

            {historyPatient && (
                <PatientHistoryModal
                    isOpen={!!historyPatient}
                    onClose={() => { setHistoryPatient(null); setHistoryTab('visits'); }}
                    patientId={historyPatient.id}
                    patientName={historyPatient.name}
                    ownerId={dataOwnerId}
                    role={userProfile?.role}
                    defaultTab={historyTab === 'samples' ? 'visits' : historyTab}
                    onViewRx={setActiveRxVisit}
                />
            )}

            {/* AI Rx Modal */}
            <RxModal
                isOpen={!!activeRxVisit}
                onClose={() => setActiveRxVisit(null)}
                visit={activeRxVisit}
                ownerId={dataOwnerId}
                doctorName={userProfile?.name?.split(' ')[0]}
                labName={userProfile?.labName}
                readOnly={!isDoctor}
                isPharmacy={isPharmacy}
                patientDisplayId={patientsMap[activeRxVisit?.patientId]?.patientId}
            />
        </div>
    );
}
