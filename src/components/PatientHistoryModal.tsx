'use client';

import { useState, useEffect, useCallback } from 'react';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '@/lib/firebase';
import { generateClinicalHistoryInsight } from '@/lib/groqAI';
import Modal from './Modal';

interface PatientHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: string;        // Firebase unique key (e.g. -Nx123...)
    patientName: string;
    ownerId: string;          // Always the root clinic owner ID
    role?: string;            // Used to gate AI Insight tab
    defaultTab?: 'visits' | 'samples' | 'reports' | 'ai';
    onViewRx?: (visit: any) => void;
}

// ─── Helper: group items by date ──────────────────────────────────────────────
function groupByDate(items: { date: string; type: string; data: any }[]) {
    const map: Record<string, typeof items> = {};
    items.forEach(item => {
        if (!map[item.date]) map[item.date] = [];
        map[item.date].push(item);
    });
    return Object.keys(map)
        .sort((a, b) => b.localeCompare(a))
        .map(date => ({ date, items: map[date] }));
}

export default function PatientHistoryModal({
    isOpen,
    onClose,
    patientId,
    patientName,
    ownerId,
    role,
    defaultTab = 'visits',
    onViewRx
}: PatientHistoryModalProps) {
    const [patient, setPatient]       = useState<any>(null);
    const [visits, setVisits]         = useState<any[]>([]);
    const [reports, setReports]       = useState<any[]>([]);
    const [samples, setSamples]       = useState<any[]>([]);
    const [loading, setLoading]       = useState(true);
    const [activeTab, setActiveTab]   = useState<'visits' | 'samples' | 'reports' | 'ai'>(defaultTab);

    // doctors don't see samples; owners/reception/admin do
    const showSamples = role !== 'doctor' && role !== 'dr-staff';
    const [aiInsight, setAiInsight]   = useState<any>(null);
    const [aiLoading, setAiLoading]   = useState(false);
    const [aiError, setAiError]       = useState('');

    const isDoctor = role === 'doctor' || role === 'dr-staff';
    const isLab = role === 'lab';
    const isPharmacy = role === 'pharmacy';

    // ── Two-phase fetch: resolve IDs first, then fetch all clinic records ──────
    const fetchAll = useCallback(async () => {
        if (!patientId || !ownerId) return;
        setLoading(true);
        setVisits([]);
        setReports([]);
        setSamples([]);
        setPatient(null);
        setAiInsight(null);

        try {
            // Phase 1: Resolve patient profile → get Firebase key AND readable ID
            let firebaseKey = patientId;
            let readableId: string | null = null;
            let patientProfile: any = null;

            // Try direct lookup first
            const directSnap = await get(ref(database, `patients/${ownerId}/${patientId}`));
            if (directSnap.exists()) {
                patientProfile = directSnap.val();
                firebaseKey = patientId;
                readableId = patientProfile.patientId || null;
            } else {
                // patientId might be a readable ID — search by it
                const searchSnap = await get(
                    query(ref(database, `patients/${ownerId}`), orderByChild('patientId'), equalTo(patientId))
                );
                searchSnap.forEach(child => {
                    patientProfile = child.val();
                    firebaseKey = child.key!;
                    readableId = patientId;
                });

                // Last resort: search by name match (for legacy records)
                if (!patientProfile && patientName) {
                    const nameSnap = await get(
                        query(ref(database, `patients/${ownerId}`), orderByChild('name'), equalTo(patientName))
                    );
                    nameSnap.forEach(child => {
                        if (!patientProfile) {
                            patientProfile = child.val();
                            firebaseKey = child.key!;
                            readableId = patientProfile.patientId || null;
                        }
                    });
                }
            }

            setPatient(patientProfile);

            // Phase 2: Fetch ALL OPD visits matching either ID form
            const allVisits: any[] = [];
            const visitKeys = new Set<string>();

            const addVisits = (snap: any) => {
                snap.forEach((c: any) => {
                    if (!visitKeys.has(c.key)) {
                        const val = c.val();
                        // Only add to history if session is finished
                        if (val.status === 'completed' || val.status === 'referred') {
                            visitKeys.add(c.key);
                            allVisits.push({ id: c.key, ...val });
                        }
                    }
                });
            };

            const [v1, v2] = await Promise.all([
                get(query(ref(database, `opd/${ownerId}`), orderByChild('patientId'), equalTo(firebaseKey))),
                readableId
                    ? get(query(ref(database, `opd/${ownerId}`), orderByChild('patientId'), equalTo(readableId)))
                    : Promise.resolve(null)
            ]);
            addVisits(v1);
            if (v2) addVisits(v2);

            allVisits.sort((a, b) => {
                const da = a.visitDate || a.createdAt || '';
                const db = b.visitDate || b.createdAt || '';
                return db.localeCompare(da);
            });
            setVisits(allVisits);

            // Phase 3: Fetch ALL reports matching either ID form
            const allReports: any[] = [];
            const reportKeys = new Set<string>();

            const addReports = (snap: any) => {
                snap.forEach((c: any) => {
                    if (!reportKeys.has(c.key)) {
                        reportKeys.add(c.key);
                        allReports.push({ id: c.key, ...c.val() });
                    }
                });
            };

            const [r1, r2] = await Promise.all([
                get(query(ref(database, `reports/${ownerId}`), orderByChild('patientId'), equalTo(firebaseKey))),
                readableId
                    ? get(query(ref(database, `reports/${ownerId}`), orderByChild('patientId'), equalTo(readableId)))
                    : Promise.resolve(null)
            ]);
            addReports(r1);
            if (r2) addReports(r2);

            allReports.sort((a, b) =>
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
            setReports(allReports);

            // Phase 4: Fetch ALL samples matching either ID form
            const allSamples: any[] = [];
            const sampleKeys = new Set<string>();
            const addSamples = (snap: any) => {
                snap.forEach((c: any) => {
                    if (!sampleKeys.has(c.key)) {
                        sampleKeys.add(c.key);
                        allSamples.push({ id: c.key, ...c.val() });
                    }
                });
            };
            const [s1, s2] = await Promise.all([
                get(query(ref(database, `samples/${ownerId}`), orderByChild('patientId'), equalTo(firebaseKey))),
                readableId
                    ? get(query(ref(database, `samples/${ownerId}`), orderByChild('patientId'), equalTo(readableId)))
                    : Promise.resolve(null)
            ]);
            addSamples(s1);
            if (s2) addSamples(s2);
            allSamples.sort((a, b) =>
                new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime()
            );
            setSamples(allSamples);
        } catch (err) {
            console.error('PatientHistoryModal fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [patientId, ownerId, patientName]);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(defaultTab);
            fetchAll();
        }
    }, [isOpen, fetchAll, defaultTab]);

    const handleGenerateAI = async () => {
        setAiLoading(true);
        setAiError('');
        const cacheKey = `ai_insight_${patientId}_${visits.length}_${reports.length}`;

        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                setAiInsight(JSON.parse(cached));
                setAiLoading(false);
                return;
            }

            // Mapping visits/reports to the structure expected by groqAI service
            const mappedVisits = visits.map(v => ({
                date: v.visitDate || v.createdAt?.split('T')[0] || '',
                diagnosis: v.prescription?.diagnosis || v.complaints || 'OPD Visit',
                medicines: (v.prescription?.medicines || []).map((m: any) => m.name),
                vitals: v.vitals || {}
            }));
            const mappedReports = reports.map(r => ({
                date: r.createdAt?.split('T')[0] || '',
                test: r.testName || 'Lab Report',
                threatLevel: r.threatLevel || 'Normal'
            }));

            const result = await generateClinicalHistoryInsight(mappedVisits, mappedReports);
            setAiInsight(result);
            localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch (e) {
            console.error('AI Insight Error:', e);
            setAiError('Could not generate insight. Please check GROQ_API_KEY configuration.');
        } finally {
            setAiLoading(false);
        }
    };

    // Build grouped timeline items
    const visitItems = visits.map(v => ({
        date: v.visitDate || (v.createdAt ? v.createdAt.split('T')[0] : ''),
        type: 'visit',
        data: v,
    }));
    const reportItems = reports.map(r => ({
        date: r.createdAt ? r.createdAt.split('T')[0] : '',
        type: 'report',
        data: r,
    }));

    const groupedVisits  = groupByDate(visitItems);
    const groupedReports = groupByDate(reportItems);

    const DateDivider = ({ date }: { date: string }) => (
        <div className="flex items-center gap-2 my-3">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <div className="h-px flex-1 bg-gray-100" />
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Clinical History — ${patientName}`}>
            <div className="flex flex-col" style={{ height: '75vh' }}>

                {/* ── Tabs ── */}
                <div className="flex bg-gray-100 p-1 rounded-xl mb-4 shrink-0">
                    {!isLab && (
                        <button
                            onClick={() => setActiveTab('visits')}
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-tight rounded-lg transition-all ${
                                activeTab === 'visits' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <i className="fas fa-notes-medical mr-1"></i> Visits ({visits.length})
                        </button>
                    )}
                    {showSamples && (
                        <button
                            onClick={() => setActiveTab('samples')}
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-tight rounded-lg transition-all ${
                                activeTab === 'samples' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <i className="fas fa-vial mr-1"></i> Samples ({samples.length})
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-tight rounded-lg transition-all ${
                            activeTab === 'reports' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <i className="fas fa-file-medical mr-1"></i> Reports ({reports.length})
                    </button>
                    {(isDoctor || isPharmacy) && (
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-tight rounded-lg transition-all ${
                                activeTab === 'ai' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <i className={`fas ${isPharmacy ? 'fa-prescription' : 'fa-brain'} mr-1`}></i> {isPharmacy ? 'Prescription' : 'AI'}
                        </button>
                    )}
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto pr-1">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-300">
                            <i className="fas fa-circle-notch fa-spin text-3xl"></i>
                            <p className="text-[10px] font-black uppercase tracking-widest">Loading Clinical Records...</p>
                        </div>
                    ) : (
                        <>
                            {/* ── VISITS TAB ── */}
                            {activeTab === 'visits' && (
                                <div className="space-y-2">
                                    {visits.length === 0 ? (
                                        <div className="py-16 text-center text-gray-300">
                                            <i className="fas fa-folder-open text-4xl mb-3 block"></i>
                                            <p className="text-[10px] font-black uppercase tracking-widest">No OPD visits found</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto bg-white border border-gray-100 rounded-2xl shadow-sm">
                                            <table className="w-full text-left">
                                                <thead className="text-[9px] text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 font-black">Date & Status</th>
                                                        <th className="px-4 py-3 font-black">Diagnosis / Complaints</th>
                                                        <th className="px-4 py-3 font-black">Vitals</th>
                                                        <th className="px-4 py-3 font-black text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {groupedVisits.flatMap(group => 
                                                        group.items.map((item, idx) => {
                                                            const v = item.data;
                                                            return (
                                                                <tr key={v.id || idx} className="hover:bg-blue-50/30 transition-colors group">
                                                                    <td className="px-4 py-3 align-top whitespace-nowrap">
                                                                        <div className="text-[11px] font-black text-gray-900 mb-0.5">{group.date}</div>
                                                                        <div className="flex items-center gap-2 mb-1.5 min-w-0">
                                                                            <div className="text-[9px] text-gray-400 font-bold opacity-60 uppercase" title={v.opdId || v.id}>{v.opdId || v.id}</div>
                                                                            <div className="text-gray-300">|</div>
                                                                            <div className="text-[9px] text-gray-500 font-bold">{v.doctorName ? `Dr. ${v.doctorName}` : 'OPD'}</div>
                                                                        </div>
                                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                                                                            v.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                            v.status === 'in-consultation' ? 'bg-blue-100 text-blue-700' :
                                                                            v.status === 'referred' ? 'bg-orange-100 text-orange-700' :
                                                                            'bg-gray-100 text-gray-500'
                                                                        }`}>{v.status || 'pending'}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top">
                                                                        <div className="text-[10px] font-bold text-gray-800 line-clamp-3 leading-relaxed max-w-xs">
                                                                            {v.prescription?.diagnosis || v.complaints || <span className="italic text-gray-400">None recorded</span>}
                                                                        </div>
                                                                        {v.prescription?.medicines?.length > 0 && (
                                                                            <div className="mt-2 text-[9px] font-black text-indigo-500 flex items-center gap-1">
                                                                                <i className="fas fa-pills"></i> {v.prescription.medicines.length} meds prescribed
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top whitespace-nowrap">
                                                                        <div className="flex flex-col gap-1.5">
                                                                            {v.vitals?.bp ? <span className="text-[9px] text-red-600 font-black"><i className="fas fa-heartbeat w-3 text-center"></i> {v.vitals.bp}</span> : null}
                                                                            {v.vitals?.pulse ? <span className="text-[9px] text-blue-600 font-black"><i className="fas fa-wave-square w-3 text-center"></i> {v.vitals.pulse}</span> : null}
                                                                            {v.vitals?.spo2 ? <span className="text-[9px] text-cyan-600 font-black"><i className="fas fa-lungs w-3 text-center"></i> {v.vitals.spo2}%</span> : null}
                                                                            {!v.vitals?.bp && !v.vitals?.pulse && !v.vitals?.spo2 && <span className="text-[9px] text-gray-300 font-bold italic">—</span>}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top text-right">
                                                                        {v.prescription ? (
                                                                            <button 
                                                                                onClick={() => window.open(`/print/opd/${v.id}`, '_blank')}
                                                                                className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-600 hover:text-white transition-all inline-flex items-center gap-1.5 shadow-sm"
                                                                            >
                                                                                <i className="fas fa-prescription"></i> {isDoctor ? 'View Rx' : 'Print Rx'}
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-[8px] text-gray-300 font-black uppercase tracking-widest bg-gray-50 px-2 py-1 rounded">No Rx</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── SAMPLES TAB ── */}
                            {activeTab === 'samples' && showSamples && (
                                <div className="space-y-3">
                                    {samples.length === 0 ? (
                                        <div className="py-16 text-center text-gray-300">
                                            <i className="fas fa-vial text-4xl mb-3 block"></i>
                                            <p className="text-[10px] font-black uppercase tracking-widest">No sample records found</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto bg-white border border-gray-100 rounded-2xl shadow-sm">
                                            <table className="w-full text-left">
                                                <thead className="text-[9px] text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 font-black">Date & Type</th>
                                                        <th className="px-4 py-3 font-black">Tests Ordered</th>
                                                        <th className="px-4 py-3 font-black text-right">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {samples.map((s, idx) => (
                                                        <tr key={s.id || idx} className="hover:bg-orange-50/30 transition-colors">
                                                            <td className="px-4 py-3 align-top whitespace-nowrap">
                                                                <div className="text-[11px] font-black text-gray-900 mb-0.5">
                                                                    {s.date || (s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—')}
                                                                </div>
                                                                <div className="text-[9px] text-gray-500 font-bold">
                                                                    #{s.sampleNumber || 'NA'} • {s.sampleType || 'General'}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 align-top">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {s.tests?.map((t: string, ti: number) => (
                                                                        <span key={ti} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-[9px] font-bold border border-gray-200">
                                                                            {t}
                                                                        </span>
                                                                    )) || <span className="text-[9px] text-gray-300 italic">No tests listed</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                                                                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${
                                                                    s.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                                    s.status === 'Processing' ? 'bg-blue-100 text-blue-600' :
                                                                    s.status === 'Rejected' ? 'bg-red-100 text-red-600' :
                                                                    'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                    {s.status || 'Pending'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── REPORTS TAB ── */}
                            {activeTab === 'reports' && (
                                <div className="space-y-2">
                                    {reports.length === 0 ? (
                                        <div className="py-16 text-center text-gray-300">
                                            <i className="fas fa-flask text-4xl mb-3 block"></i>
                                            <p className="text-[10px] font-black uppercase tracking-widest">No laboratory reports found</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto bg-white border border-gray-100 rounded-2xl shadow-sm">
                                            <table className="w-full text-left">
                                                <thead className="text-[9px] text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 font-black">Date & Test</th>
                                                        <th className="px-4 py-3 font-black">Threat Level</th>
                                                        <th className="px-4 py-3 font-black text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {groupedReports.flatMap(group => 
                                                        group.items.map((item, idx) => {
                                                            const r = item.data;
                                                            return (
                                                                <tr key={r.id || idx} className="hover:bg-indigo-50/30 transition-colors group">
                                                                    <td className="px-4 py-3 align-top whitespace-nowrap">
                                                                        <div className="text-[11px] font-black text-gray-900 mb-0.5">{group.date}</div>
                                                                        <div className="text-[10px] text-indigo-600 font-bold truncate max-w-[200px]" title={r.testName}>
                                                                            {r.testName || 'Lab Investigation'}
                                                                        </div>
                                                                        <div className="text-[8px] text-gray-400 font-black tracking-widest mt-0.5">
                                                                            {r.reportId || r.id?.slice(-6) || '—'}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top whitespace-nowrap">
                                                                        <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase inline-block ${
                                                                            r.threatLevel === 'High' || r.threatLevel === 'critical' ? 'bg-red-100 text-red-600' :
                                                                            r.threatLevel === 'Moderate' || r.threatLevel === 'warning' ? 'bg-orange-100 text-orange-600' :
                                                                            'bg-green-100 text-green-600'
                                                                        }`}>
                                                                            {r.threatLevel || 'Normal'}
                                                                        </span>
                                                                        <div className="text-[8px] text-gray-400 font-bold mt-1.5 uppercase tracking-tighter">
                                                                            {r.status || 'Result Available'}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top text-right">
                                                                        <button
                                                                            onClick={() => window.open(`/print/report/${r.id}`, '_blank')}
                                                                            className="text-[9px] font-black bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all inline-flex items-center gap-1.5 shadow-sm"
                                                                        >
                                                                            <i className="fas fa-file-pdf"></i> View PDF
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── AI INSIGHT TAB ── */}
                            {activeTab === 'ai' && (
                                <div className="space-y-4">
                                    {!aiInsight && !aiLoading && (
                                        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 p-8 text-white text-center shadow-2xl">
                                            <div className="w-16 h-16 bg-blue-500/20 border border-blue-400/30 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-900/30">
                                                <i className="fas fa-brain text-2xl text-blue-400"></i>
                                            </div>
                                            <h3 className="text-sm font-black tracking-[0.2em] uppercase mb-2">AI Clinical Intelligence</h3>
                                            <p className="text-[10px] text-gray-400 leading-relaxed max-w-xs mx-auto mb-3">
                                                AI will analyze <strong className="text-white">{visits.length} visits</strong> and <strong className="text-white">{reports.length} reports</strong> to generate a health insight.
                                            </p>
                                            {visits.length === 0 && reports.length === 0 ? (
                                                <p className="text-[9px] text-red-400 font-bold">No clinical data available to analyze.</p>
                                            ) : (
                                                <button
                                                    onClick={handleGenerateAI}
                                                    className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all shadow-xl shadow-blue-900/50 active:scale-95"
                                                >
                                                    <i className="fas fa-bolt mr-1.5"></i> Generate Health Insight
                                                </button>
                                            )}
                                            {aiError && <p className="text-[9px] text-red-400 font-bold mt-3">{aiError}</p>}
                                        </div>
                                    )}

                                    {aiLoading && (
                                        <div className="bg-gray-900 rounded-2xl p-10 text-center text-white shadow-xl">
                                            <i className="fas fa-circle-notch fa-spin text-3xl text-blue-400 mb-4 block"></i>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Synthesizing clinical records with AI...</p>
                                        </div>
                                    )}

                                    {aiInsight && !aiLoading && (
                                        <div className="space-y-4">
                                            <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-5 mb-4 shadow-sm">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <i className="fas fa-stethoscope text-blue-500 text-sm"></i>
                                                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-700">Clinical Trajectory</h4>
                                                </div>
                                                <p className="text-[11px] font-bold leading-relaxed text-gray-800 italic">"{aiInsight.narrative}"</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {/* Trends */}
                                                <div className="bg-white border-2 border-indigo-50 rounded-2xl p-4 shadow-sm">
                                                    <h4 className="text-[8px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                                                        <i className="fas fa-chart-line"></i> Health Trends
                                                    </h4>
                                                    <ul className="space-y-2">
                                                        {(aiInsight.trends || []).map((t: string, i: number) => (
                                                            <li key={i} className="flex items-start gap-2 text-[10px] font-bold text-gray-700">
                                                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 shrink-0"></span>
                                                                {t}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Risks */}
                                                <div className="bg-rose-50/60 border-2 border-rose-100 rounded-2xl p-4">
                                                    <h4 className="text-[8px] font-black text-rose-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                                                        <i className="fas fa-exclamation-triangle"></i> Risk Factors
                                                    </h4>
                                                    <ul className="space-y-2">
                                                        {(aiInsight.riskFactors || []).map((r: string, i: number) => (
                                                            <li key={i} className="flex items-start gap-2 text-[10px] font-bold text-gray-700">
                                                                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full mt-1.5 shrink-0"></span>
                                                                {r}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {/* Recommendations */}
                                            <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-4">
                                                <h4 className="text-[8px] font-black text-amber-700 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                                                    <i className="fas fa-lightbulb"></i> Clinical Recommendations
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {(aiInsight.recommendations || []).map((rec: string, i: number) => (
                                                        <span key={i} className="bg-amber-100 text-amber-900 px-3 py-1.5 rounded-xl text-[10px] font-black border border-amber-200">
                                                            {rec}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Refresh */}
                                            <button
                                                onClick={handleGenerateAI}
                                                className="w-full py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] hover:text-blue-600 border border-dashed border-gray-200 rounded-xl transition-colors"
                                            >
                                                <i className="fas fa-sync mr-1.5"></i> Refresh Insight
                                            </button>

                                            {/* Disclaimer */}
                                            <div className="flex gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                                                <i className="fas fa-shield-alt text-blue-500 mt-0.5 shrink-0"></i>
                                                <p className="text-[9px] text-blue-700/80 font-bold leading-relaxed">
                                                    AI insights are generated from historical data. All findings must be interpreted by a licensed clinician in the context of the current clinical examination.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
}
