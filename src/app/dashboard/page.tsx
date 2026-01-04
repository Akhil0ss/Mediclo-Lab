'use client';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, onValue, query, limitToLast, orderByChild } from 'firebase/database';
import { database } from '@/lib/firebase';
import { getDataOwnerId } from '@/lib/dataUtils';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const QuickReportModal = dynamic(() => import('@/components/QuickReportModal'), { ssr: false });

export default function DashboardPage() {
    const router = useRouter();
    const { user, userProfile } = useAuth();
    const [stats, setStats] = useState({ todayPatients: 0, todayReports: 0, todaySamples: 0, pendingSamples: 0 });
    const [pendingSamplesList, setPendingSamplesList] = useState([]);
    const [showQuickReportModal, setShowQuickReportModal] = useState(false);
    const [selectedSample, setSelectedSample] = useState('');

    // Date Keys
    const today = new Date().toISOString().split('T')[0];

    const dataOwnerId = useMemo(() => {
        if (!user) return '';
        return getDataOwnerId(userProfile, user.uid);
    }, [user, userProfile]);

    useEffect(() => {
        if (!user || !dataOwnerId) return;

        // 1. Patients
        onValue(query(ref(database, 'patients/' + dataOwnerId), orderByChild('createdAt'), limitToLast(50)), (snap) => {
            let count = 0;
            snap.forEach(c => { if (c.val().createdAt?.includes(today)) count++; });
            setStats(p => ({ ...p, todayPatients: count }));
        });

        // 2. Samples
        onValue(query(ref(database, 'samples/' + dataOwnerId), orderByChild('createdAt'), limitToLast(100)), (snap) => {
            const list = [];
            let tCount = 0;
            snap.forEach(c => {
                const val = c.val();
                if (val.date?.includes(today)) tCount++;
                // Show samples with Pending or Processing status (even if they have reportId)
                if (val.status === 'Pending' || val.status === 'Processing') {
                    list.push({ id: c.key, ...val });
                }
            });
            setPendingSamplesList(list.reverse()); // Reverse to show newest first
            setStats(p => ({ ...p, todaySamples: tCount, pendingSamples: list.length }));
        });

        // 3. Reports
        onValue(query(ref(database, 'reports/' + dataOwnerId), orderByChild('createdAt'), limitToLast(100)), (snap) => {
            let rCount = 0;
            snap.forEach(c => { if (c.val().createdAt?.includes(today)) rCount++; });
            setStats(p => ({ ...p, todayReports: rCount }));
        });

    }, [user, dataOwnerId, today]);

    if (!user) return null;

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Lab Dashboard</h1>
                    <p className="text-gray-500 text-sm">Welcome back, {userProfile?.name}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => router.push('/dashboard/patients?add=true&flow=quick')}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md transition flex items-center gap-2 text-sm">
                        <i className="fas fa-user-plus"></i> Quick Add Patient
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/samples?add=true&flow=quick')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md transition flex items-center gap-2 text-sm">
                        <i className="fas fa-vial"></i> Quick Sample
                    </button>
                    <button onClick={() => { setSelectedSample(''); setShowQuickReportModal(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md transition flex items-center gap-2 text-sm">
                        <i className="fas fa-plus-circle"></i> Quick Report
                    </button>
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700"><i className="fas fa-list mr-2"></i> Pending Samples Queue</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-3">Sample ID</th>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Patient</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pendingSamplesList.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">All caught up! No pending samples.</td></tr>
                            ) : (
                                pendingSamplesList.map(s => (
                                    <tr key={s.id} className="hover:bg-blue-50 transition">
                                        <td className="px-6 py-4 font-mono font-bold text-blue-600 text-sm">{s.sampleNumber}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{new Date(s.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 font-semibold text-gray-800">{s.patientName}</td>
                                        <td className="px-6 py-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{s.sampleType}</span></td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => { setSelectedSample(s.id); setShowQuickReportModal(true); }}
                                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-bold transition">
                                                Generate Report
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showQuickReportModal && (
                <QuickReportModal onClose={() => setShowQuickReportModal(false)} ownerId={dataOwnerId} initialSampleId={selectedSample} />
            )}
        </div>
    );
}
