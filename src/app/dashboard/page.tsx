'use client';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, onValue, query, limitToLast, orderByChild } from 'firebase/database';
import { database } from '@/lib/firebase';
import { getDataOwnerId } from '@/lib/dataUtils';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const QuickReportModal = dynamic(() => import('@/components/QuickReportModal'), { ssr: false });
const QuickOPDModal = dynamic(() => import('@/components/QuickOPDModal'), { ssr: false });
const QuickPatientModal = dynamic(() => import('@/components/QuickPatientModal'), { ssr: false });
const QuickSampleModal = dynamic(() => import('@/components/QuickSampleModal'), { ssr: false });

export default function DashboardPage() {
    const router = useRouter();
    const { user, userProfile } = useAuth();
    const [stats, setStats] = useState({ todayPatients: 0, todayReports: 0, todaySamples: 0, pendingSamples: 0, opdWaiting: 0, opdCompleted: 0 });
    const [pendingSamplesList, setPendingSamplesList] = useState([]);
    const [doctorQueue, setDoctorQueue] = useState<any[]>([]);
    const [fullOPDQueue, setFullOPDQueue] = useState<any[]>([]);
    const [labReferrals, setLabReferrals] = useState<any[]>([]);
    const [showQuickReportModal, setShowQuickReportModal] = useState(false);
    const [showQuickOPDModal, setShowQuickOPDModal] = useState(false);
    const [showQuickPatientModal, setShowQuickPatientModal] = useState(false);
    const [showQuickSampleModal, setShowQuickSampleModal] = useState(false);
    const [selectedSample, setSelectedSample] = useState('');
    const [queueSearch, setQueueSearch] = useState('');

    // Date Keys
    const today = new Date().toISOString().split('T')[0];

    const dataOwnerId = useMemo(() => {
        if (!user) return '';
        return getDataOwnerId(userProfile, user.uid);
    }, [user, userProfile]);

    const isDoctor = userProfile?.role === 'doctor';
    const isOwnerOrAdmin = userProfile?.role === 'owner' || userProfile?.role === 'receptionist' || userProfile?.role === 'admin';

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
        onValue(query(ref(database, 'reports/' + dataOwnerId), orderByChild('createdAt'), limitToLast(100)), (snap) => {
            let rCount = 0;
            snap.forEach(c => { if (c.val().createdAt?.includes(today)) rCount++; });
            setStats(p => ({ ...p, todayReports: rCount }));
        });

        // 4. OPD Queue (Universal Synchronization)
        onValue(query(ref(database, 'opd/' + dataOwnerId), orderByChild('visitDate')), (snap) => {
            const docList: any[] = [];
            const fullList: any[] = [];
            const referrals: any[] = [];
            let waiting = 0;
            let completed = 0;
            
            const doctorId = user?.uid;

            snap.forEach(c => {
                const val = c.val();
                if (val.visitDate === today) {
                    const visit = { id: c.key, ...val };
                    
                    // Track stats for everyone
                    if (val.status === 'pending') waiting++;
                    else if (val.status === 'completed') completed++;

                    // Full queue for Admins/Staff
                    if (val.status === 'pending') fullList.push(visit);

                    // Referrals for Lab (Patients who have tests suggested today)
                    if (val.status === 'completed' && val.prescription?.referredTests?.length > 0) {
                        referrals.push(visit);
                    }

                    // Filtered queue for Doctor
                    if (isDoctor && val.doctorId === doctorId && val.status === 'pending') {
                        docList.push(visit);
                    }
                }
            });

            // Sort by Token Ascending (Que-wise)
            const sortByToken = (a: any, b: any) => (parseInt(a.token) || 0) - (parseInt(b.token) || 0);
            
            setDoctorQueue(docList.sort(sortByToken));
            setFullOPDQueue(fullList.sort(sortByToken));
            setLabReferrals(referrals.sort((a,b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()));
            setStats(p => ({ ...p, opdWaiting: waiting, opdCompleted: completed }));
        });

    }, [user, dataOwnerId, today, isDoctor, userProfile]);

    if (!user) return null;

    if (isDoctor) {
        return (
            <div className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-gray-50/50 min-h-screen">
                {/* 1. Header: Compact Greeting */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-blue-200 border-2 border-white">
                            <i className="fas fa-user-md text-2xl"></i>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mb-0.5">DR WORKSPACE</p>
                            <h1 className="text-xl font-black text-gray-900">Dr. {userProfile?.name}</h1>
                            <p className="text-gray-400 text-[10px] font-bold flex items-center gap-2">
                                <i className="fas fa-clock text-blue-400"></i> {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Compact Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="relative group overflow-hidden bg-white p-5 rounded-3xl shadow-lg shadow-blue-500/5 border border-white hover:border-blue-100 transition-all">
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Queue Waiting</p>
                                <p className="text-3xl font-black text-gray-900 leading-none">{stats.opdWaiting}</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-blue-200">
                                <i className="fas fa-clock"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div className="relative group overflow-hidden bg-white p-5 rounded-3xl shadow-lg shadow-green-500/5 border border-white hover:border-green-100 transition-all">
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mb-1">Rx Consulted</p>
                                <p className="text-3xl font-black text-gray-900 leading-none">{stats.opdCompleted}</p>
                            </div>
                            <div className="w-12 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-green-200">
                                <i className="fas fa-check-double"></i>
                            </div>
                        </div>
                    </div>

                    <div className="relative group overflow-hidden bg-white p-5 rounded-3xl shadow-lg shadow-indigo-500/5 border border-white hover:border-indigo-100 transition-all">
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Clinic Total</p>
                                <p className="text-3xl font-black text-gray-900 leading-none">{stats.opdWaiting + stats.opdCompleted}</p>
                            </div>
                            <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-200">
                                <i className="fas fa-users"></i>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. The Que-Monitor: High Impact Patient List */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden relative">
                            <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/30">
                                <div className="flex items-center gap-3 text-nowrap">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                    <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest">
                                        Rx Management Queue
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="relative flex-1 md:w-60">
                                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]"></i>
                                        <input 
                                            type="text" 
                                            placeholder="Find in queue..." 
                                            value={queueSearch}
                                            onChange={(e) => setQueueSearch(e.target.value)}
                                            className="w-full pl-8 pr-4 py-1.5 bg-white border border-gray-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        />
                                    </div>
                                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></span>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-6 py-3">Token</th>
                                            <th className="px-6 py-3">Patient Profile</th>
                                            <th className="px-6 py-3">Live Vitals</th>
                                            <th className="px-6 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {doctorQueue.filter(v => v.patientName.toLowerCase().includes(queueSearch.toLowerCase())).length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-20 text-center">
                                                    <div className="flex flex-col items-center opacity-20 group">
                                                        <i className="fas fa-search text-5xl mb-3 text-gray-300"></i>
                                                        <p className="text-xl font-black text-gray-400 italic">No matches.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            doctorQueue
                                                .filter(v => v.patientName.toLowerCase().includes(queueSearch.toLowerCase()))
                                                .map((v, idx) => (
                                                <tr key={v.id} className="group hover:bg-blue-50/40 transition-all">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center text-sm font-black shadow-sm">
                                                                #{v.token}
                                                            </div>
                                                            <span className="text-xs font-black text-gray-300">Q-{idx + 1}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-black text-gray-800">{v.patientName}</span>
                                                                {v.status === 'referred' && (
                                                                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[8px] font-black uppercase tracking-tighter flex items-center gap-1 border border-orange-200">
                                                                        <i className="fas fa-vial animate-pulse"></i> 🧪 RE-LAB
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">ID: {v.id.slice(-4).toUpperCase()}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex gap-1.5 flex-wrap">
                                                            {v.vitals?.bp && (
                                                                <div className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[9px] font-black border border-red-100 flex items-center gap-1 shadow-sm">
                                                                    <i className="fas fa-heartbeat"></i> {v.vitals.bp}
                                                                </div>
                                                            )}
                                                            {v.vitals?.pulse && (
                                                                <div className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[9px] font-black border border-blue-100 flex items-center gap-1 shadow-sm">
                                                                    <i className="fas fa-wave-square"></i> {v.vitals.pulse}
                                                                </div>
                                                            )}
                                                            {v.vitals?.spo2 && (
                                                                <div className="px-2 py-0.5 bg-cyan-50 text-cyan-600 rounded-md text-[9px] font-black border border-cyan-100 flex items-center gap-1 shadow-sm">
                                                                    <i className="fas fa-lungs"></i> {v.vitals.spo2}%
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={() => router.push(`/dashboard/opd?visitId=${v.id}`)}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md transition-all active:scale-95 flex items-center gap-2 ml-auto uppercase tracking-tighter"
                                                        >
                                                            <i className="fas fa-file-medical"></i> Start Rx
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

                    <div className="lg:col-span-1 space-y-6">
                         {/* Next Patient Highlight Card (Compact) */}
                         {doctorQueue.length > 0 && (
                             <div className="bg-gradient-to-br from-blue-700 to-indigo-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                                 <p className="text-[8px] font-black text-blue-200 uppercase tracking-[0.3em] mb-4">UP NEXT</p>
                                 <div className="flex items-center gap-4 mb-4">
                                     <span className="text-4xl font-black">{doctorQueue[0].token}</span>
                                      <div className="flex flex-col">
                                          <div className="flex items-center gap-2">
                                              <h4 className="text-lg font-black leading-tight">{doctorQueue[0].patientName}</h4>
                                              {doctorQueue[0].status === 'referred' && (
                                                  <span className="bg-white/20 text-white text-[8px] font-black px-2 py-0.5 rounded-full border border-white/30 backdrop-blur-sm">🧪 LAB REFERRED</span>
                                              )}
                                          </div>
                                          <p className="text-[9px] text-blue-200/60 font-bold italic tracking-tight">
                                              {doctorQueue[0].status === 'referred' ? 'Waiting for lab report...' : 'Vitals checked, ready for visit.'}
                                          </p>
                                      </div>
                                 </div>
                                 <button onClick={() => router.push(`/dashboard/opd?visitId=${doctorQueue[0].id}`)} className="w-full bg-white text-blue-900 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                                     <i className="fas fa-paper-plane"></i> CALL PATIENT
                                 </button>
                             </div>
                         )}

                         {/* Quick Links (Compact) */}
                         <div className="bg-white rounded-[1.5rem] p-6 shadow-md border border-gray-100">
                             <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Quick Links</h4>
                             <div className="space-y-3">
                                 <button onClick={() => router.push('/dashboard/opd')} className="w-full group flex items-center justify-between p-3 rounded-xl hover:bg-blue-50 transition-all">
                                     <div className="flex items-center gap-3">
                                         <i className="fas fa-folder-open text-blue-600 text-sm"></i>
                                         <span className="text-xs font-bold text-gray-700">Patient History</span>
                                     </div>
                                     <i className="fas fa-chevron-right text-[8px] text-gray-300"></i>
                                 </button>
                                 <button onClick={() => router.push('/dashboard/patients')} className="w-full group flex items-center justify-between p-3 rounded-xl hover:bg-indigo-50 transition-all">
                                     <div className="flex items-center gap-3">
                                         <i className="fas fa-search-plus text-indigo-600 text-sm"></i>
                                         <span className="text-xs font-bold text-gray-700">Records Lookup</span>
                                     </div>
                                     <i className="fas fa-chevron-right text-[8px] text-gray-300"></i>
                                 </button>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{isOwnerOrAdmin ? 'Clinic Dashboard' : 'Lab Dashboard'}</h1>
                    <p className="text-gray-500 text-sm">Welcome back, {userProfile?.name}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowQuickPatientModal(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md transition flex items-center gap-2 text-sm">
                        <i className="fas fa-user-plus"></i> Quick Add Patient
                    </button>
                    <button
                        onClick={() => setShowQuickSampleModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md transition flex items-center gap-2 text-sm">
                        <i className="fas fa-vial"></i> Quick Sample
                    </button>
                    <button
                        onClick={() => setShowQuickOPDModal(true)}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md transition flex items-center gap-2 text-sm">
                        <i className="fas fa-stethoscope"></i> Quick OPD
                    </button>
                    {(userProfile?.role === 'lab' || userProfile?.role === 'owner') && (
                        <button onClick={() => { setSelectedSample(''); setShowQuickReportModal(true); }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md transition flex items-center gap-2 text-sm">
                            <i className="fas fa-plus-circle"></i> Quick Report
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-xl shadow-sm border border-amber-100 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div><p className="text-xs font-bold text-amber-700 uppercase">Pending Samples</p><p className="text-3xl font-bold text-amber-900">{stats.pendingSamples}</p></div>
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white shadow-lg"><i className="fas fa-hourglass-half text-xl"></i></div>
                </div>
                <div className="bg-gradient-to-br from-sky-50 to-blue-50 p-4 rounded-xl shadow-sm border border-sky-100 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div><p className="text-xs font-bold text-sky-700 uppercase">Collected Today</p><p className="text-3xl font-bold text-sky-900">{stats.todaySamples}</p></div>
                    <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-blue-500 rounded-full flex items-center justify-center text-white shadow-lg"><i className="fas fa-vial text-xl"></i></div>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-xl shadow-sm border border-emerald-100 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div><p className="text-xs font-bold text-emerald-700 uppercase">Reports Generated</p><p className="text-3xl font-bold text-emerald-900">{stats.todayReports}</p></div>
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white shadow-lg"><i className="fas fa-file-medical-alt text-xl"></i></div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-xl shadow-sm border border-purple-100 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div><p className="text-xs font-bold text-purple-700 uppercase">New Patients</p><p className="text-3xl font-bold text-purple-900">{stats.todayPatients}</p></div>
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-violet-500 rounded-full flex items-center justify-center text-white shadow-lg"><i className="fas fa-user-plus text-xl"></i></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                                                    <button onClick={() => { setSelectedSample(s.id); setShowQuickReportModal(true); }}
                                                        className="text-[9px] bg-indigo-600 dark:bg-indigo-500 hover:scale-105 active:scale-95 text-white px-3 py-1.5 rounded-lg font-black transition-all uppercase tracking-widest shadow-md shadow-indigo-100">
                                                        Prepare Result
                                                    </button>
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

                {/* 2. Clinic OPD Queue (Real-time Sync) */}
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
                                    fullOPDQueue.map(v => (
                                        <tr key={v.id} className={`hover:bg-blue-50/30 transition ${v.isEmergency && v.status === 'pending' ? 'bg-red-50/50 border-l-4 border-red-500' : ''}`}>
                                            <td className="px-3 py-2 flex items-center gap-1.5">
                                                <span className={`text-sm font-black ${v.isEmergency && v.status === 'pending' ? 'text-red-700 animate-pulse' : 'text-blue-600'}`}>#{v.token}</span>
                                                {v.isEmergency && v.status === 'pending' && <i className="fas fa-circle text-[6px] text-red-600 animate-ping"></i>}
                                            </td>
                                            <td className="px-3 py-2 font-bold text-gray-800 text-xs truncate max-w-[100px] md:max-w-[140px]" title={v.patientName}>{v.patientName}</td>
                                            <td className="px-3 py-2 text-[10px] font-semibold text-gray-500 whitespace-nowrap">Dr. {v.doctorName?.split(' ')[0]}</td>
                                            <td className="px-3 py-2 text-right">
                                                <button 
                                                    onClick={() => router.push(`/dashboard/opd?visitId=${v.id}`)}
                                                    className={`text-[9px] px-2 py-1.5 rounded font-black transition uppercase cursor-pointer whitespace-nowrap ${
                                                        v.isEmergency && v.status === 'pending'
                                                        ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200'
                                                        : userProfile?.role === 'doctor' 
                                                        ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm' 
                                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                    }`}
                                                >
                                                    {v.isEmergency && v.status === 'pending' ? 'URGENT CONSULT' : userProfile?.role === 'doctor' ? 'CONSULT NOW' : (v.status === 'pending' ? 'WAITING' : 'COMPLETED')}
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
                <QuickSampleModal isOpen={showQuickSampleModal} onClose={() => setShowQuickSampleModal(false)} ownerId={dataOwnerId} labName={userProfile?.labName} />
            )}
        </div>
    );
}
