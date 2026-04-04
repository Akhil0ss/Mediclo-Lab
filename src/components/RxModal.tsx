'use client';

import { useState, useEffect } from 'react';
import { ref, update, onValue, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import Modal from './Modal';
import { useToast } from '@/contexts/ToastContext';
import { generateRxId } from '@/lib/idGenerator';
import { suggestDiagnosis, checkDrugInteractions, suggestLifestyleAdvice, getMedicineIntelligence } from '@/lib/groqAI';
import { getBrandingData } from '@/lib/dataUtils';
import { getArrivedReportsForVisit, filterCompletedReferrals } from '@/lib/clinicLogic';
import { query, orderByChild, limitToLast } from 'firebase/database';

interface RxModalProps {
    isOpen: boolean;
    onClose: () => void;
    visit: any;
    ownerId: string;
    doctorName?: string;
    labName?: string;
    readOnly?: boolean;
    isPharmacy?: boolean;
    patientDisplayId?: string;
}

export default function RxModal({ isOpen, onClose, visit, ownerId, doctorName, labName: initialLabName = 'CLINIC', readOnly = false, isPharmacy = false, patientDisplayId }: RxModalProps) {
    const { showToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [labName, setLabName] = useState(initialLabName);
    
    // AI State
    const [aiDiagnosis, setAiDiagnosis] = useState<any>(null);
    const [drugWarnings, setDrugWarnings] = useState<any>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const [medIntelligence, setMedIntelligence] = useState<Record<number, any>>({});
    const [activeMedIdx, setActiveMedIdx] = useState<number | null>(null);
    const [testSearchTerm, setTestSearchTerm] = useState('');

    const [form, setForm] = useState({
        diagnosis: '',
        advice: '',
        complaints: '',
        medicines: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
        nextVisit: '',
        referredTests: [] as string[],
        followUpDate: ''
    });
    const [patientHistory, setPatientHistory] = useState<any[]>([]);
    const [patientReports, setPatientReports] = useState<any[]>([]);
    const [arrivedReports, setArrivedReports] = useState<any[]>([]);
    const [currentTab, setCurrentTab] = useState<'rx' | 'ai'>('rx');

    useEffect(() => {
        if (!isOpen || !ownerId) return;
        const fetchBranding = async () => {
             const branding = await getBrandingData(ownerId, { ownerId });
             if (branding?.labName) setLabName(branding.labName);
        };
        fetchBranding();
    }, [isOpen, ownerId]);

    // Correlation: Identify reports arrived since this visit started
    useEffect(() => {
        if (!visit || !patientReports.length) return;
        const newReports = getArrivedReportsForVisit(visit, patientReports);
        setArrivedReports(newReports);
    }, [visit, patientReports]);

    useEffect(() => {
        if (visit && isOpen) {
            let finalReferredTests = visit.prescription?.referredTests || visit.referredTests || [];
            
            // Smart Resume: If resuming a referral, clear out tests that already have digital reports
            if (visit.status === 'referred' && arrivedReports.length > 0) {
                finalReferredTests = filterCompletedReferrals(finalReferredTests, arrivedReports);
            }

            setForm({
                diagnosis: visit.prescription?.diagnosis || '',
                complaints: visit.prescription?.complaints || visit.complaints || '',
                medicines: visit.prescription?.medicines || [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
                advice: visit.prescription?.advice || '',
                referredTests: finalReferredTests,
                followUpDate: visit.prescription?.followUpDate || '',
                nextVisit: visit.prescription?.nextVisit || ''
            });
        }
    }, [visit, isOpen, arrivedReports]);

    // Fetch Full Patient History (Past OPD Visits)
    useEffect(() => {
        if (!isOpen || !visit?.patientId || !ownerId) return;
        const opdRef = ref(database, `opd/${ownerId}`);
        const unsub = onValue(opdRef, (snap) => {
            const data: any[] = [];
            snap.forEach(c => {
                const val = c.val();
                if (val.patientId === visit.patientId && c.key !== visit.id) {
                    data.push({ id: c.key, ...val });
                }
            });
            setPatientHistory(data.sort((a,b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
        });
        return () => unsub();
    }, [isOpen, visit?.patientId, ownerId, visit?.id]);

    useEffect(() => {
        if (!ownerId) return;
        const templatesRef = ref(database, `templates/${ownerId}`);
        const unsub = onValue(templatesRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach(c => { data.push({id: c.key, ...c.val()}) });
            setTemplates(data);
        });
        return () => unsub();
    }, [ownerId]);

    // Fetch Patient Reports for clinical review
    useEffect(() => {
        if (!isOpen || !visit?.patientId || !ownerId) return;
        const reportsRef = ref(database, `reports/${ownerId}`);
        const unsub = onValue(reportsRef, (snap) => {
            const reports: any[] = [];
            snap.forEach(c => {
                const val = c.val();
                if (val.patientId === visit.patientId) {
                    reports.push({ id: c.key, ...val });
                }
            });
            setPatientReports(reports.sort((a,b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
        });
        return () => unsub();
    }, [isOpen, visit?.patientId, ownerId]);

    const handleGenerateDiagnosis = async () => {
        if (!form.diagnosis && !visit?.complaints) {
            showToast('Please enter complaints or provisional diagnosis first', 'warning');
            return;
        }
        setIsAiLoading(true);
        try {
            // Summarize History (Past Reports + Past Rx) - ULTRA COMPACT
            const labSummary = patientReports.slice(0, 5).map(r => 
                `${r.testName}:${r.results?.map((res:any) => `${res.parameter}=${res.value}`).join(',')}`
            ).join('|');

            const medicHistory = patientHistory.slice(0, 3).map(h => 
                `Dx:${h.prescription?.diagnosis || 'NA'}(${h.prescription?.medicines?.map((m:any) => m.name).join(',')})`
            ).join('|');

            const historyContext = `REPORTS:${labSummary} || HISTORY:${medicHistory}`;

            const res = await suggestDiagnosis(
                form.complaints || form.diagnosis || visit?.complaints || '',
                visit?.vitals || {},
                parseInt(visit?.patientAge) || 30,
                visit?.patientGender || 'Male',
                historyContext
            );
            setAiDiagnosis(res);
            if (window.innerWidth < 768) setCurrentTab('ai'); // Auto-focus result for mobile/tablet
            showToast('Advanced AI Clinical Analysis Complete', 'success');
        } catch (error) {
            showToast('AI Diagnosis failed', 'error');
        } finally {
            setIsAiLoading(false);
        }
    };

    // AI Drug Collision Trigger
    useEffect(() => {
        if (!isOpen || form.medicines.length < 2) {
            setDrugWarnings(null);
            return;
        }
        const validMeds = form.medicines.filter(m => m.name && m.name.length > 2);
        if (validMeds.length < 2) return;

        const timer = setTimeout(async () => {
            try {
                const res = await checkDrugInteractions(validMeds);
                setDrugWarnings(res);
            } catch (error) {
                console.error(error);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [form.medicines, isOpen]);

    const handleDosagePredict = async (idx: number, medName: string) => {
        if (!medName || medName.length < 3) return;
        try {
            const res = await getMedicineIntelligence(medName, parseInt(visit?.patientAge) || 30);
            setMedIntelligence(prev => ({ ...prev, [idx]: res }));
            setActiveMedIdx(idx); // Promote intelligence when matched
            
            // Auto-fill only if fields are empty to assist without interrupting
            const newM = [...form.medicines];
            if (!newM[idx].dosage) newM[idx].dosage = res.dosage;
            if (!newM[idx].frequency) newM[idx].frequency = res.frequency;
            if (!newM[idx].duration) newM[idx].duration = res.duration;
            if (!newM[idx].instructions) newM[idx].instructions = res.instructions;
            
            setForm({...form, medicines: newM});
        } catch (error) {
            console.error(error);
        }
    };

    const handleGenerateAdvice = async () => {
        if (!form.diagnosis && !visit?.complaints) {
            showToast('Enter diagnosis for AI advice', 'warning');
            return;
        }
        setIsAiLoading(true)
        try {
            const historyContext = patientReports.slice(0, 3).map(r => `${r.testName} (${r.status})`).join(', ');
            const res = await suggestLifestyleAdvice(
                form.diagnosis || visit?.complaints, 
                visit?.complaints || '',
                historyContext
            );
            let clean = (res || '').replace(/[*#]/g, '').trim();
            clean = clean.split('\n').map(line => line.trim().startsWith('-') ? line.replace('-', '•') : line).join('\n');
            setForm(prev => ({...prev, advice: clean}));
            showToast('Context-Aware AI Advice Generated', 'success');
        } catch (error) {
           showToast('Advice generation failed', 'error');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSave = async (options?: { status?: string }) => {
        if (!visit) return;
        setIsSaving(true);
        try {
            const rxRef = ref(database, `opd/${ownerId}/${visit.id}`);
            
            // Status Assignment: 
            // If explicit 'referred' passed (Sent to Lab button), status is referred.
            // Otherwise, status is completed (Finalize button).
            const isPartialReferral = options?.status === 'referred';
            const finalStatus = isPartialReferral ? 'referred' : 'completed';

            let rxId = visit.prescription?.rxId;
            if (!rxId) {
                rxId = await generateRxId(ownerId, labName);
            }

            const updateData = {
                complaints: form.complaints, // Sync updated complaints
                prescription: {
                    ...form,
                    rxId,
                    updatedAt: new Date().toISOString()
                },
                status: finalStatus,
                updatedAt: new Date().toISOString()
            };

            await update(rxRef, updateData);
            showToast(isPartialReferral ? 'Referred to Lab - Case remains in Queue' : 'Prescription Finalized', 'success');
            onClose();
        } catch (error) {
            showToast('Failed to save Rx', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleReferralTest = (test: string) => {
        const tests = [...form.referredTests];
        if (tests.includes(test)) {
            setForm({ ...form, referredTests: tests.filter(t => t !== test) });
        } else {
            setForm({ ...form, referredTests: [...tests, test] });
        }
    };

    if (!visit) return null;

    if (isPharmacy) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Dispensing Dashboard" maxWidth="max-w-6xl">
                 <div className="flex flex-col gap-0 bg-white min-h-[400px]">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
                        <div className="flex items-center gap-6">
                            <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase whitespace-nowrap">
                                {visit.patientName}
                                <span className="ml-3 text-xs font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded tracking-widest uppercase">{patientDisplayId || 'PATIENT'}</span>
                            </h3>
                            <div className="h-6 w-px bg-gray-200"></div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Prescribing Physician</span>
                                <span className="text-xs font-black text-blue-600 uppercase">Dr. {doctorName || visit.doctorName}</span>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-all active:scale-90"><i className="fas fa-times text-lg"></i></button>
                    </div>
                    <div className="p-6">
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 min-w-[320px]">Medicine Name</th>
                                        <th className="px-6 py-4">Dosage</th>
                                        <th className="px-6 py-4">Frequency</th>
                                        <th className="px-6 py-4">Duration</th>
                                        <th className="px-6 py-4">Instructions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(form.medicines || []).map((med, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/10 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-black text-xs text-gray-900 uppercase">{med.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-600">{med.dosage}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-blue-600">{med.frequency}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-gray-800">{med.duration}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-600 italic">"{med.instructions}"</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="max-w-[1400px]">
            <div className="flex flex-col gap-0 h-[92vh] max-h-[92vh] overflow-hidden bg-white -m-8 relative">
                {/* 1.0 SECURE CONSOLE HEADER (Internal to prevent overlap) */}
                <div className="bg-white px-4 md:px-6 py-4 border-b border-slate-100 flex items-center justify-between shadow-sm relative z-40">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                            <i className="fas fa-microscope text-xs"></i>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">Smart Rx Intelligence Console</h2>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-90"><i className="fas fa-times text-lg"></i></button>
                </div>

                {/* 1.1 TOP PULSE STRIP (VITALS & CONTEXT) */}
                <div className="bg-slate-900 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between shadow-2xl relative z-30 gap-y-3">
                    <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg border border-white/20 shrink-0">
                                <span className="text-sm font-black tracking-tighter">#{visit.token}</span>
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm md:text-lg font-black text-white tracking-tighter uppercase leading-none truncate">{visit.patientName}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-widest truncate">{patientDisplayId || 'PATIENT'}</span>
                                    <span className="w-1 h-1 rounded-full bg-white/20 shrink-0"></span>
                                    <span className="text-[9px] md:text-[10px] font-bold text-blue-400 uppercase tracking-widest whitespace-nowrap">{visit.patientAge}Y / {visit.patientGender}</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-8 w-[1px] bg-white/10 hidden md:block"></div>
                        <div className="flex items-center gap-4 md:gap-6 overflow-x-auto scrollbar-hide flex-1 md:flex-none">
                            {[
                                { label: 'BP', val: visit.vitals?.bp, color: 'text-rose-400' },
                                { label: 'Pulse', val: visit.vitals?.pulse, color: 'text-amber-400' },
                                { label: 'Wt.', val: visit.vitals?.weight, color: 'text-sky-400' },
                                { label: 'SpO2', val: visit.vitals?.spo2, color: 'text-emerald-400' }
                            ].map((v, i) => (
                                <div key={i} className="flex flex-col whitespace-nowrap">
                                    <span className="text-[7.5px] font-black text-white/40 uppercase tracking-[0.2em]">{v.label}</span>
                                    <span className={`text-[11px] font-black ${v.color}`}>{v.val || '---'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t border-white/10 pt-2 md:border-t-0 md:pt-0">
                        <div className="text-right">
                            <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Digital Auth</p>
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Dr. {doctorName || visit.doctorName}</p>
                        </div>
                    </div>
                </div>

                {/* 1.5 NATIVE-STYLE MOBILE NAVIGATION (Hidden on PC) */}
                <div className="md:hidden bg-slate-100 p-2 flex gap-1 border-b border-slate-200">
                    <button 
                        onClick={() => setCurrentTab('rx')} 
                        className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${currentTab === 'rx' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <i className="fas fa-prescription-bottle-alt text-xs"></i>
                        Rx Entry
                    </button>
                    <button 
                        onClick={() => setCurrentTab('ai')} 
                        className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all relative ${currentTab === 'ai' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <i className="fas fa-brain text-xs"></i>
                        Intelligence
                        {aiDiagnosis && <span className="absolute top-2 right-4 w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>}
                        {aiDiagnosis && <span className="absolute top-2 right-4 w-2 h-2 bg-indigo-500 rounded-full"></span>}
                    </button>
                </div>

                {/* 2. SPLIT WORKSPACE (Strictly Bounded Height) */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden h-full min-h-0">
                    {/* LEFT WORKSPACE: DATA ENTRY */}
                    <div className={`flex-1 md:flex-[2.5] flex flex-col h-full overflow-hidden min-h-0 bg-slate-50/30 ${currentTab === 'ai' ? 'hidden md:flex' : 'flex'}`}>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-6">
                        {/* 2.1 CLINICAL GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 shadow-sm rounded-2xl overflow-hidden border border-gray-200 bg-white">
                            <div className="flex flex-col border-b md:border-b-0 md:border-r border-gray-100">
                                <div className="h-[85px] p-4 bg-orange-50/20 border-l-4 border-l-amber-500 overflow-hidden flex flex-col">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[8px] font-black text-amber-600 uppercase tracking-[0.2em]">Chief Complaints</label>
                                        <span className="text-[7px] font-black text-amber-400 uppercase italic">EDITABLE</span>
                                    </div>
                                    <textarea 
                                        value={form.complaints}
                                        onChange={e => setForm({...form, complaints: e.target.value})}
                                        className="flex-1 bg-transparent text-xs font-bold text-slate-700 placeholder:text-slate-300 outline-none resize-none custom-scrollbar p-1"
                                        placeholder="Review & edit recorded symptoms..."
                                        readOnly={readOnly}
                                    />
                                </div>
                                <div className="h-[65px] p-4 border-t border-gray-100 bg-white flex items-center gap-3 border-l-4 border-l-indigo-600">
                                     <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-serif italic font-black text-xl">℞</div>
                                     <div className="min-w-0">
                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tighter leading-none truncate">Prescribed Medications</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Authorization</p>
                                            <i className="fas fa-chevron-down text-[8px] text-indigo-400"></i>
                                        </div>
                                     </div>
                                </div>
                            </div>
                            <div className="p-4 bg-white border-l-4 border-l-blue-600 flex flex-col h-[130px] md:h-auto">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[8px] font-black text-blue-600 uppercase tracking-[0.2em]">Provisional Diagnosis</label>
                                </div>
                                <textarea 
                                    value={form.diagnosis}
                                    onChange={e => setForm({...form, diagnosis: e.target.value})}
                                    placeholder="Enter clinical assessment..."
                                    className="flex-1 bg-gray-50/50 rounded-xl p-3 text-xs font-black text-slate-800 placeholder:text-slate-300 outline-none border border-transparent focus:border-blue-200 resize-none uppercase"
                                    readOnly={readOnly}
                                />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="px-4 md:px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Inventory & Dosing</span>
                                {!readOnly && (
                                    <button onClick={() => setForm({...form, medicines: [...form.medicines, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]})} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 shadow-md shrink-0">
                                        <i className="fas fa-plus mr-1"></i> Add Drug
                                    </button>
                                )}
                            </div>

                            {/* LIVE AI MEDICINE GUARD BAR (Un-nested for 100% Visibility) */}
                            {activeMedIdx !== null && medIntelligence[activeMedIdx] && (
                                <div className="bg-slate-900 px-4 md:px-6 py-3 border-b border-indigo-500/20 animate-in slide-in-from-top-1 flex flex-col md:flex-row md:items-center gap-3 md:gap-6 shadow-lg">
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xl animate-pulse">
                                            <i className="fas fa-brain text-xs"></i>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none">Guard Active</span>
                                            <span className="text-[10px] font-black text-white uppercase tracking-tighter truncate max-w-[120px]">{form.medicines[activeMedIdx]?.name}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col md:flex-row gap-3 md:gap-8 min-w-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[8px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-0.5">Clinical Guidance</p>
                                            <p className="text-[11px] font-bold text-white leading-none italic truncate">"{medIntelligence[activeMedIdx].doctorTips}"</p>
                                        </div>
                                        <div className="flex-1 min-w-0 border-l border-white/10 md:pl-6 pl-0">
                                            <p className="text-[8px] font-black text-rose-400 uppercase tracking-[0.2em] mb-0.5 flex items-center gap-1.5 line-clamp-1"><i className="fas fa-triangle-exclamation"></i> Risks/Side Effects</p>
                                            <p className="text-[11px] font-bold text-rose-200 leading-none italic truncate">"{medIntelligence[activeMedIdx].complications}"</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setActiveMedIdx(null)} className="text-white/30 hover:text-white transition-all text-sm shrink-0 ml-auto"><i className="fas fa-times-circle"></i></button>
                                </div>
                            )}

                            <div className="w-full overflow-x-auto">
                                <table className="w-full text-left table-fixed border-collapse min-w-[700px]">
                                    <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                        <tr>
                                            <th className="px-2 py-3 w-8 text-center">#</th>
                                            <th className="px-4 py-3 w-[55%]">Medicine Name</th>
                                            <th className="px-2 py-3 w-20 text-center">Freq.</th>
                                            <th className="px-2 py-3 w-20 text-center">Dur.</th>
                                            <th className="px-3 py-3 text-center w-32">Instructions</th>
                                            {!readOnly && <th className="px-2 py-3 text-center w-10"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {form.medicines.map((med, idx) => (
                                            <tr key={idx} className="hover:bg-indigo-50/5 group text-[11px]">
                                                <td className="px-2 py-3 text-center font-black text-slate-300 text-[10px]">{idx + 1}</td>
                                                <td className="px-4 py-3 relative group/med">
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="text" 
                                                            value={med.name}
                                                            onChange={e => { const nm = [...form.medicines]; nm[idx].name = e.target.value; setForm({...form, medicines: nm}); }}
                                                            onBlur={e => !readOnly && handleDosagePredict(idx, e.target.value)}
                                                            onFocus={() => setActiveMedIdx(idx)}
                                                            className="flex-1 bg-transparent font-black text-slate-900 border-none outline-none uppercase placeholder:text-slate-200 text-[11px] truncate tracking-tight"
                                                            placeholder="Enter Generic/Brand..."
                                                            readOnly={readOnly}
                                                        />
                                                        {medIntelligence[idx] && !readOnly && (
                                                            <div 
                                                                onClick={() => setActiveMedIdx(activeMedIdx === idx ? null : idx)}
                                                                className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm animate-in zoom-in-50 duration-300 ${activeMedIdx === idx ? 'bg-indigo-600 text-white border-indigo-700 font-bold' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}
                                                            >
                                                                <i className="fas fa-brain text-[8px]"></i>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        value={med.dosage}
                                                        onChange={e => { const nm = [...form.medicines]; nm[idx].dosage = e.target.value; setForm({...form, medicines: nm}); }}
                                                        className="w-full bg-transparent text-[8.5px] font-bold text-slate-400 outline-none mt-0.5"
                                                        placeholder="Dosage Guidance..."
                                                        readOnly={readOnly}
                                                    />
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    {!readOnly ? (
                                                        <select value={med.frequency} onChange={e => { const nm = [...form.medicines]; nm[idx].frequency = e.target.value; setForm({...form, medicines: nm}); }} className="w-full bg-gray-50 border-none text-[10px] font-black text-indigo-600 outline-none p-1 rounded uppercase appearance-none text-center">
                                                            <option value="">--</option>
                                                            <option value="OD">OD</option><option value="BD">BD</option><option value="TDS">TDS</option>
                                                            <option value="QID">QID</option><option value="STAT">STAT</option><option value="SOS">SOS</option>
                                                            <option value="1-0-1">1-0-1</option><option value="1-1-1">1-1-1</option>
                                                        </select>
                                                    ) : <span className="font-black text-indigo-600 text-[9px]">{med.frequency}</span>}
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    {!readOnly ? (
                                                        <select value={med.duration} onChange={e => { const nm = [...form.medicines]; nm[idx].duration = e.target.value; setForm({...form, medicines: nm}); }} className="w-full bg-gray-50 border-none text-[10px] font-black text-slate-700 outline-none p-1 rounded uppercase appearance-none text-center">
                                                            <option value="">--</option>
                                                            {['1D','3D','5D','7D','10D','14D','1M','3M'].map(d => <option key={d} value={d}>{d}</option>)}
                                                            <option value="CONT.">CONT.</option>
                                                        </select>
                                                    ) : <span className="font-black text-slate-700 text-[9px]">{med.duration}</span>}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {!readOnly ? (
                                                        <select value={med.instructions} onChange={e => { const nm = [...form.medicines]; nm[idx].instructions = e.target.value; setForm({...form, medicines: nm}); }} className="w-full bg-gray-50 border-none text-[10px] font-black text-slate-500 outline-none p-1 rounded uppercase italic truncate">
                                                            <option value="">GUIDE...</option>
                                                            {['After Food','Before Food','Empty Stomach','With Milk','At Bedtime','Morning Only','Night Only'].map(i => <option key={i} value={i}>{i.toUpperCase()}</option>)}
                                                        </select>
                                                    ) : <span className="font-bold text-slate-500 italic text-[9px] truncate block">{med.instructions}</span>}
                                                </td>
                                                {!readOnly && (
                                                    <td className="px-2 py-3 text-center">
                                                        <button onClick={() => { const nm = [...form.medicines]; nm.splice(idx,1); setForm({...form, medicines: nm}); }} className="text-slate-300 hover:text-rose-500 transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 2.3 UNIFIED ACTION ROW (60/40 Split: Advice & Investigations) */}
                        <div className="flex flex-col lg:flex-row gap-4">
                            {/* Patient Advice (Left 60%) */}
                            <div className="flex-[1.5] bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 relative">
                                <div className="flex justify-between items-center mb-3">
                                    <h5 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                                        <i className="fas fa-bullhorn text-indigo-500"></i> Clinical Instructions
                                    </h5>
                                    {!readOnly && (
                                        <button onClick={handleGenerateAdvice} className="text-[9px] font-black text-indigo-600 bg-white px-3 py-1 rounded-full border border-indigo-200 hover:bg-indigo-600 hover:text-white shadow-sm flex items-center gap-1 uppercase transition-all">
                                            <i className={`fas fa-sparkles ${isAiLoading ? 'animate-spin' : ''}`}></i> AI Advice
                                        </button>
                                    )}
                                </div>
                                <textarea 
                                    value={form.advice}
                                    onChange={e => setForm({...form, advice: e.target.value})}
                                    placeholder="Enter instructions for patient..."
                                    className="w-full h-[110px] bg-white rounded-xl p-3 text-[12px] font-bold text-slate-700 placeholder:text-slate-300 outline-none border border-indigo-50 focus:border-indigo-300 transition-all resize-none shadow-inner italic"
                                    readOnly={readOnly}
                                />
                            </div>

                            {/* Lab Referral (Right 40%) */}
                            <div className="flex-1 bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h5 className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-2">
                                        <i className="fas fa-microscope text-blue-600"></i> Lab Referrals
                                    </h5>
                                    <span className="text-[8px] font-black text-blue-400 bg-white px-2 py-0.5 rounded border border-blue-100 uppercase">Search</span>
                                </div>
                                
                                <div className="space-y-3">
                                    {!readOnly && (
                                        <div className="relative">
                                            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-[9px]"></i>
                                            <input 
                                                type="text"
                                                placeholder="Search to Refer..."
                                                value={testSearchTerm}
                                                className="w-full bg-white border border-blue-100 rounded-lg py-2 pl-8 pr-3 text-[10px] font-black outline-none focus:ring-2 focus:ring-blue-500/10 placeholder:text-blue-300 uppercase"
                                                onChange={(e) => setTestSearchTerm(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && testSearchTerm.trim()) {
                                                        toggleReferralTest(testSearchTerm.trim().toUpperCase());
                                                        setTestSearchTerm('');
                                                    }
                                                }}
                                            />
                                            
                                            {testSearchTerm.length > 0 && (
                                                <div className="absolute top-[110%] left-0 w-full z-50 flex flex-col gap-1 max-h-[220px] overflow-y-auto custom-scrollbar p-1.5 bg-white rounded-xl border border-blue-200 shadow-2xl animate-in slide-in-from-top-2">
                                                    {/* Manual Add Trigger */}
                                                    <button 
                                                        onClick={() => { toggleReferralTest(testSearchTerm.toUpperCase()); setTestSearchTerm(''); }}
                                                        className="flex items-center gap-2 p-2 rounded-lg text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-all text-left mb-1"
                                                    >
                                                        <i className="fas fa-keyboard opacity-40"></i>
                                                        <span className="truncate">Add "{testSearchTerm.toUpperCase()}" as Test</span>
                                                        <i className="fas fa-plus-circle ml-auto"></i>
                                                    </button>

                                                    {/* Template Filtering */}
                                                    {(templates.length > 0 ? templates : [
                                                        {name:'CBC'},{name:'LFT'},{name:'KFT'},{name:'FBS / PPBS'},{name:'HbA1c'},{name:'Lipid Profile'},{name:'Thyroid Profile'},{name:'X-Ray Chest'}
                                                    ])
                                                    .filter(t => t.name.toLowerCase().includes(testSearchTerm.toLowerCase()))
                                                    .map((test, tidx) => (
                                                        <button 
                                                            key={tidx} 
                                                            type="button" 
                                                            onClick={() => { toggleReferralTest(test.name); setTestSearchTerm(''); }} 
                                                            className={`flex items-center justify-between p-2 rounded-lg text-[10px] font-black border transition-all text-left ${form.referredTests.includes(test.name) ? 'bg-blue-600 text-white border-blue-700' : 'bg-white border-slate-50 text-slate-500 hover:border-blue-200'}`}
                                                        >
                                                            <span className="truncate leading-none uppercase">{test.name}</span>
                                                            <i className={`fas ${form.referredTests.includes(test.name) ? 'fa-check-circle' : 'fa-plus-circle opacity-10'}`}></i> 
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    <div className="relative">
                                        <div className="flex flex-wrap gap-1.5 min-h-[66px] content-start">
                                            {form.referredTests.length === 0 ? (
                                                <div className="w-full flex flex-col items-center justify-center py-4 text-blue-300 opacity-40">
                                                    <i className="fas fa-search-plus text-xs mb-1"></i>
                                                    <span className="text-[8px] font-black uppercase">Click test to add</span>
                                                </div>
                                            ) : (
                                                form.referredTests.map((t, i) => (
                                                    <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-[8px] font-black uppercase rounded-lg flex items-center gap-1.5 border border-blue-200 transition-all hover:bg-blue-200 shadow-sm">
                                                        {t} <i className="fas fa-times-circle cursor-pointer hover:text-red-500" onClick={() => toggleReferralTest(t)}></i>
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {drugWarnings && <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 animate-in slide-in-from-bottom-2 flex gap-4 mt-4"><div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-lg text-xs"><i className="fas fa-shield-virus"></i></div><div><h4 className="text-[11px] font-black text-rose-900 uppercase">Drug Interaction Warning</h4><p className="text-xs font-bold text-rose-700 mt-0.5 leading-relaxed italic">"{drugWarnings}"</p></div></div>}
                        </div>
                    </div>
                    </div>

                    {/* RIGHT WORKSPACE: INTELLIGENCE SIDEBAR */}
                    <div className={`w-full md:w-[350px] md:flex-none bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col h-full overflow-hidden min-h-0 ${currentTab === 'rx' ? 'hidden md:flex' : 'flex'}`}>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 pb-12">
                            {/* MedOS Intelligence Core */}
                            <div className="p-4 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-xl border border-white/10 shadow-xl overflow-hidden group">
                                <h5 className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 italic">
                                    MedOS Intelligence Core
                                    {patientReports.length > 0 && <span className="ml-auto text-[7px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-tighter">History Analyzed</span>}
                                </h5>
                                {aiDiagnosis ? (
                                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                                        {/* Nested Scroll Area for AI Output (High-Density Half-Height) */}
                                        <div className="max-h-[160px] overflow-y-auto custom-scrollbar-indigo space-y-3 pr-1">
                                            <div className="flex flex-col gap-2">
                                                {aiDiagnosis.possibleDiagnoses?.map((d: any, i: number) => (
                                                    <div key={i} className="p-2.5 bg-white/5 rounded-lg border border-white/5 hover:border-indigo-500/30 transition-all group relative">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[11px] font-black text-white uppercase tracking-tight">{d.name}</span>
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${d.probability === 'high' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{d.probability.toUpperCase()}</span>
                                                        </div>
                                                        <p className="text-[9px] text-white/50 leading-relaxed font-bold italic mb-2">"{d.reasoning}"</p>
                                                        <button 
                                                            onClick={() => setForm({...form, diagnosis: d.name})} 
                                                            className="w-full py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[8px] font-black uppercase rounded border border-indigo-500/30 transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            Select & Apply Diagnosis
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {aiDiagnosis.urgencyLevel && (
                                                <div className={`p-2 rounded-lg text-center text-[9px] font-black uppercase tracking-widest ${aiDiagnosis.urgencyLevel === 'high' || aiDiagnosis.urgencyLevel === 'emergency' ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    Urgency: {aiDiagnosis.urgencyLevel}
                                                </div>
                                            )}

                                            {aiDiagnosis.recommendedTests?.length > 0 && (
                                                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <h6 className="text-[8px] font-black text-indigo-300 uppercase mb-2">Recommended Investigations</h6>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {aiDiagnosis.recommendedTests.map((t: string, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-200 text-[8px] font-bold rounded border border-indigo-500/20">{t}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {aiDiagnosis.differentialNote && (
                                                <div className="p-2.5 bg-amber-500/5 rounded-lg border border-amber-500/10">
                                                    <p className="text-[8.5px] text-amber-400 leading-relaxed font-medium">Note: {aiDiagnosis.differentialNote}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2 pt-2 border-t border-white/5">
                                            <button onClick={() => setAiDiagnosis(null)} className="flex-1 py-1.5 bg-white/10 text-white/40 text-[9px] font-black uppercase rounded-lg hover:bg-white/20 transition-all">Clear Analysis</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-2">
                                        <button onClick={handleGenerateDiagnosis} disabled={isAiLoading} className="w-full py-2.5 bg-white text-indigo-950 text-[10px] font-black uppercase tracking-[0.1em] rounded-lg active:scale-[0.98] transition-all shadow-xl hover:bg-indigo-50">
                                            {isAiLoading ? <i className="fas fa-circle-notch animate-spin mr-2"></i> : <i className="fas fa-brain mr-2"></i>}
                                            Analyze Session & History
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Clinic Report Archive */}
                            <div className="space-y-4">
                                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 p-2 rounded flex justify-between">
                                    <span>Clinic Report Archive</span>
                                    <span className="text-indigo-400 font-black">LATEST</span>
                                </h5>
                                {patientReports.length === 0 ? (
                                    <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-bold text-slate-300 uppercase tracking-widest">No History Found</div>
                                ) : (
                                    patientReports.slice(0, 3).map((report, idx) => (
                                        <div key={idx} onClick={() => window.open(`/print/report/${report.id}`, '_blank')} className="p-3 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 transition-all cursor-pointer shadow-sm">
                                            <div className="flex justify-between items-start mb-1 text-[11px] font-black text-slate-900 uppercase truncate pr-4">{report.testName}</div>
                                            <div className="flex flex-wrap gap-1 mt-1.5 opacity-80">
                                                {report.results?.slice(0, 3).map((r: any, i: number) => <span key={i} className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${r.threatLevel === 'High' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>{r.parameter}: {r.value}</span>)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. NARROW ACTION FOOTER */}
                <div className="bg-slate-900 border-t border-white/10 p-2 flex flex-wrap items-center justify-between gap-3 relative z-30 shadow-[0_-15px_30px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center gap-3">
                         <div className="flex flex-col">
                            <label className="text-[6.5px] font-black text-white/30 uppercase tracking-widest ml-1">Follow-up</label>
                            <div className="flex items-center gap-1.5">
                                <input 
                                    type="date"
                                    value={form.followUpDate}
                                    onChange={e => setForm({...form, followUpDate: e.target.value})}
                                    className="bg-white/5 border border-white/10 text-white text-[10px] font-black px-2 py-1 rounded-lg outline-none w-[120px] focus:border-indigo-500"
                                    readOnly={readOnly}
                                />
                                {!readOnly && (
                                    <div className="flex items-center gap-1">
                                        {[{ l: '3D', v: 3 }, { l: '7D', v: 7 }, { l: '15D', v: 15 }].map(btn => (
                                            <button
                                                key={btn.v}
                                                type="button"
                                                onClick={() => {
                                                    const d = new Date();
                                                    d.setDate(d.getDate() + btn.v);
                                                    setForm({...form, followUpDate: d.toISOString().split('T')[0]});
                                                }}
                                                className="px-1.5 py-1 bg-white/5 hover:bg-indigo-600 text-white/40 hover:text-white text-[7.5px] font-black rounded border border-white/5 transition-all uppercase"
                                            >
                                                +{btn.l}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!readOnly ? (
                            <>
                                <button type="button" onClick={onClose} className="px-3 py-2 text-white/30 font-black text-[9px] uppercase hover:text-white">Cancel</button>
                                <button 
                                    type="button"
                                    onClick={() => handleSave()} 
                                    disabled={isSaving || !form.diagnosis} 
                                    className={`px-8 py-2 md:px-10 md:py-2.5 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg active:scale-95 disabled:opacity-50 ${form.referredTests.length > 0 ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                >
                                    {isSaving ? '...' : (form.referredTests.length > 0 ? 'Save & Refer Lab' : 'Authorize Rx')}
                                </button>
                            </>
                        ) : <button type="button" onClick={onClose} className="px-6 py-2 bg-white/5 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">Close</button>}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
