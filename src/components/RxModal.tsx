'use client';

import { useState, useEffect } from 'react';
import { ref, update, push, onValue, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import Modal from './Modal';
import { useToast } from '@/contexts/ToastContext';
import { generateRxId } from '@/lib/idGenerator';
import { suggestDiagnosis, checkDrugInteractions, suggestLifestyleAdvice, predictDosage } from '@/lib/groqAI';

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

export default function RxModal({ isOpen, onClose, visit, ownerId, doctorName, labName = 'CLINIC', readOnly = false, isPharmacy = false, patientDisplayId }: RxModalProps) {
    const { showToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    // AI State
    const [aiDiagnosis, setAiDiagnosis] = useState<any>(null);
    const [drugWarnings, setDrugWarnings] = useState<any>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);

    const [form, setForm] = useState({
        diagnosis: '',
        advice: '',
        medicines: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
        nextVisit: '',
        referredTests: [] as string[],
        followUpDate: ''
    });
    const [patientHistory, setPatientHistory] = useState<any[]>([]);
    const [patientReports, setPatientReports] = useState<any[]>([]);
    const [historyInsight, setHistoryInsight] = useState<any>(null);

    useEffect(() => {
        if (visit && isOpen) {
            setForm({
                diagnosis: visit.prescription?.diagnosis || '',
                medicines: visit.prescription?.medicines || [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
                advice: visit.prescription?.advice || '',
                referredTests: visit.prescription?.referredTests || [],
                followUpDate: visit.prescription?.followUpDate || '',
                nextVisit: visit.prescription?.nextVisit || ''
            });
        }
    }, [visit, isOpen]);

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

    // Fetch Patient History for AI Context
    useEffect(() => {
        if (!isOpen || !visit?.patientId || !ownerId) return;
        const opdRef = ref(database, `opd/${ownerId}`);
        const unsub = onValue(opdRef, (snap) => {
            const history: any[] = [];
            snap.forEach(c => {
                const val = c.val();
                if (val.patientId === visit.patientId && c.key !== visit.id && val.status === 'completed') {
                    history.push({ id: c.key, ...val });
                }
            });
            setPatientHistory(history.sort((a,b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()));
        });
        return () => unsub();
    }, [isOpen, visit?.patientId, ownerId]);

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
            // Sort by date, newest first
            setPatientReports(reports.sort((a,b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
        });
        return () => unsub();
    }, [isOpen, visit?.patientId, ownerId]);

    // AI Assistive Diagnosis
    const handleGenerateDiagnosis = async () => {
        if (!form.diagnosis && !visit?.complaints) {
            showToast('Please enter complaints or provisional diagnosis first', 'warning');
            return;
        }
        setIsAiLoading(true);
        try {
            const res = await suggestDiagnosis(
                form.diagnosis || visit?.complaints || '',
                visit?.vitals || {},
                parseInt(visit?.patientAge) || 30,
                visit?.patientGender || 'Male'
            );
            setAiDiagnosis(res);
        } catch (error) {
            console.error(error);
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
            const res = await predictDosage(medName, parseInt(visit?.patientAge) || 30);
            const newM = [...form.medicines];
            newM[idx] = { ...newM[idx], ...res };
            setForm({...form, medicines: newM});
        } catch (error) {
            console.error(error);
        }
    };

    const handleGenerateAdvice = async () => {
        if (!form.diagnosis && !visit?.complaints) return;
        try {
            const res = await suggestLifestyleAdvice(form.diagnosis || visit?.complaints, visit?.complaints || '');
            // Clean AI artifacts if any
            const clean = (res || '').replace(/[*#]/g, '').trim();
            setForm(prev => ({...prev, advice: clean}));
        } catch (error) {
           console.error(error);
        }
    };

    const handleSave = async (e: React.FormEvent, isReferral = false) => {
        e.preventDefault();
        if (!visit) return;
        setIsSaving(true);
        try {
            let rxId = visit.prescription?.rxId;
            if (!rxId) {
                rxId = await generateRxId(ownerId, labName);
            }

            const status = isReferral ? 'referred' : 'completed';

            await update(ref(database, `opd/${ownerId}/${visit.id}`), {
                prescription: {
                    ...form,
                    rxId,
                    updatedAt: new Date().toISOString()
                },
                status: status,
                updatedAt: new Date().toISOString()
            });
            showToast(`Prescription ${status === 'referred' ? 'sent to Lab' : 'authorized'}!`, 'success');
            onClose();
        } catch (error) {
            showToast('Failed to save Rx', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAnalysis = async () => {
        setIsAiLoading(true);
        try {
            const res = await suggestDiagnosis(
                visit.complaints || '',
                visit.vitals || {},
                parseInt(visit.patientAge),
                visit.patientGender
            );
            setAiDiagnosis(res);
            showToast('Vitals and Symptoms Analyzed', 'success');
        } catch (e) {
            showToast('Analysis failed', 'error');
        } finally {
            setIsAiLoading(false);
        }
    };

    if (!visit) return null;

    if (isPharmacy) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Dispensing Dashboard" maxWidth="max-w-6xl">
                <div className="flex flex-col gap-0 bg-white min-h-[400px]">
                    {/* 📋 REDESIGNED TOP BAR (INLINE) */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
                        <div className="flex items-center gap-6">
                            <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase whitespace-nowrap">
                                {visit.patientName}
                                <span className="ml-3 text-xs font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded tracking-widest uppercase">{patientDisplayId || 'PATIENT'}</span>
                            </h3>
                            <div className="h-6 w-px bg-gray-200"></div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Authored by</span>
                                <span className="text-xs font-black text-blue-600 uppercase">Dr. {doctorName || visit.doctorName}</span>
                            </div>
                            {visit.complaints && (
                                <>
                                    <div className="h-6 w-px bg-gray-200"></div>
                                    <div className="flex items-center gap-3 max-w-md">
                                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-widest leading-none">Complaints</span>
                                        <p className="text-xs font-bold text-gray-700 italic truncate">"{visit.complaints}"</p>
                                    </div>
                                </>
                            )}
                        </div>
                        <button 
                            onClick={onClose} 
                            className="w-10 h-10 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-all active:scale-90"
                        >
                            <i className="fas fa-times text-lg"></i>
                        </button>
                    </div>

                    {/* 💊 MEDICATION TABLE (BELOW) */}
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
                                    {(form.medicines || []).length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold italic">No medicines prescribed.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Smart Rx Console" maxWidth="max-w-7xl">
            <div className="flex flex-col gap-6 max-h-[85vh] overflow-hidden bg-gray-50/30">
                {/* 🏥 STEP 1: COMPACT PATIENT CONTEXT & REFER BUTTON */}
                <div className="bg-white p-4 mx-4 mt-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
                    {visit.status === 'referred' && (
                        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-orange-500 animate-pulse"></div>
                    )}
                    <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg ${visit.status === 'referred' ? 'bg-orange-600 animate-in zoom-in' : 'bg-blue-600'}`}>
                            <span className="text-[10px] font-black leading-none">TKN</span>
                            <span className="text-lg font-black leading-none">#{visit.token}</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase">{visit.patientName}</h3>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black tracking-widest uppercase border ${visit.patientGender === 'Male' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{visit.patientAge}Y / {visit.patientGender}</span>
                                {visit.status === 'referred' && (
                                    <span className="px-2 py-1 bg-orange-50 text-orange-700 text-[8px] font-black rounded-lg uppercase tracking-widest border border-orange-100 animate-pulse">
                                        <i className="fas fa-flask mr-1"></i> Lab Result Review
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="bg-gray-100 text-gray-500 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">{patientDisplayId || 'NEW PATIENT'}</span>
                                <span className="text-[10px] text-gray-400 font-bold">•</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase whitespace-nowrap tracking-wide">AUTHENTICATING {visit.doctorName || doctorName || 'ASSN'}</span>
                            </div>
                        </div>
                    </div>
                    {!readOnly && (
                        <div className="flex items-center gap-2">
                            <button 
                                type="button"
                                onClick={(e) => handleSave(e, true)}
                                disabled={isSaving || form.referredTests.length === 0}
                                className="bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-600 hover:text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                            >
                                <i className="fas fa-microscope"></i> Refer to Lab
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-col px-4 pb-4 overflow-hidden flex-1 relative">
                    <div className="overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-24">
                        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm transition-all hover:border-blue-100">
                            {visit.complaints && (
                                <div className="p-3 bg-amber-50/30 border border-amber-100 rounded-xl relative group mb-4">
                                    <span className="absolute -top-2 left-3 bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded tracking-widest uppercase">Chief Complaints</span>
                                    <p className="text-xs font-bold text-gray-700 italic pt-1 leading-relaxed">"{visit.complaints}"</p>
                                </div>
                            )}

                            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl relative overflow-hidden">
                                <h5 className="text-[9px] font-black text-indigo-700 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                    <i className="fas fa-flask-vial text-indigo-500"></i> Recent Diagnostic Findings
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {patientReports.slice(0, 6).map((report, ridx) => (
                                        <div key={ridx} className="bg-white p-3 rounded-xl border border-indigo-50 shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => window.open(`/print/report/${report.id}`, '_blank')}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[10px] font-black text-gray-900 truncate uppercase tracking-tight">{report.testName}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {report.results?.slice(0, 3).map((res: any, i: number) => (
                                                    <span key={i} className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${res.threatLevel === 'High' || res.threatLevel === 'Critical' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-600'}`}>
                                                        {res.parameter}: {res.value}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <h4 className="text-[10px] font-black text-gray-700 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <i className="fas fa-prescription text-blue-500 text-xs"></i> Medication Matrix
                                </h4>
                                {!readOnly && (
                                    <button 
                                        type="button" 
                                        onClick={() => setForm({...form, medicines: [...form.medicines, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]})} 
                                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg active:scale-95 flex items-center gap-2"
                                    >
                                        <i className="fas fa-plus"></i> Add Drug
                                    </button>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 min-w-[320px]">Medicine Name</th>
                                            <th className="px-6 py-4">Dosage</th>
                                            <th className="px-6 py-4 w-32">Frequency</th>
                                            <th className="px-6 py-4 w-32">Duration</th>
                                            <th className="px-6 py-4">Instructions</th>
                                            {!readOnly && <th className="px-6 py-4 text-center w-12"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {form.medicines.map((med, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50/10 transition-colors group">
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    <input 
                                                        type="text" 
                                                        value={med.name || ''}
                                                        onChange={e => { const nm = [...form.medicines]; nm[idx].name = e.target.value; setForm({...form, medicines: nm}); }}
                                                        onBlur={e => !readOnly && handleDosagePredict(idx, e.target.value)}
                                                        className="w-full bg-transparent text-xs font-black text-gray-900 border-b border-transparent focus:border-blue-500 outline-none uppercase py-1"
                                                        readOnly={readOnly}
                                                    />
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    <input 
                                                        type="text" 
                                                        value={med.dosage || ''}
                                                        onChange={e => { const nm = [...form.medicines]; nm[idx].dosage = e.target.value; setForm({...form, medicines: nm}); }}
                                                        className="w-full bg-transparent text-xs font-bold text-gray-600 border-b border-transparent focus:border-blue-500 outline-none py-1"
                                                        readOnly={readOnly}
                                                    />
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    {!readOnly ? (
                                                        <select 
                                                            value={med.frequency}
                                                            onChange={e => { const nm = [...form.medicines]; nm[idx].frequency = e.target.value; setForm({...form, medicines: nm}); }}
                                                            className="w-full bg-transparent text-[11px] font-black text-blue-600 outline-none cursor-pointer hover:bg-blue-50 rounded"
                                                        >
                                                            <option value="">Select...</option>
                                                            <option value="1-0-1">1-0-1</option>
                                                            <option value="1-1-1">1-1-1</option>
                                                            <option value="1-0-0">1-0-0</option>
                                                            <option value="0-0-1">0-0-1</option>
                                                            <option value="SOS">SOS</option>
                                                        </select>
                                                    ) : <span className="text-xs font-black text-gray-800">{med.frequency}</span>}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    {!readOnly ? (
                                                        <select 
                                                            value={med.duration || ''}
                                                            onChange={e => { const nm = [...form.medicines]; nm[idx].duration = e.target.value; setForm({...form, medicines: nm}); }}
                                                            className="w-full bg-transparent text-[11px] font-black text-gray-800 outline-none cursor-pointer hover:bg-gray-100 rounded"
                                                        >
                                                            <option value="">Dur...</option>
                                                            <option value="3 Days">3D</option>
                                                            <option value="5 Days">5D</option>
                                                        </select>
                                                    ) : <span className="text-xs font-black text-gray-800">{med.duration}</span>}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    {!readOnly ? (
                                                        <select 
                                                            value={med.instructions || ''}
                                                            onChange={e => { const nm = [...form.medicines]; nm[idx].instructions = e.target.value; setForm({...form, medicines: nm}); }}
                                                            className="w-full bg-transparent text-[11px] font-black text-gray-600 outline-none cursor-pointer hover:bg-blue-50 rounded"
                                                        >
                                                            <option value="">Select...</option>
                                                            <option value="Before Food">BEFORE FOOD</option>
                                                            <option value="After Food">AFTER FOOD</option>
                                                        </select>
                                                    ) : <span className="text-xs font-bold text-gray-600">{med.instructions}</span>}
                                                </td>
                                                {!readOnly && (
                                                    <td className="px-4 py-2 text-center whitespace-nowrap">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => { const nm = [...form.medicines]; nm.splice(idx,1); setForm({...form, medicines: nm}); }}
                                                            className="text-gray-300 hover:text-red-500"
                                                        >
                                                            <i className="fas fa-trash text-[10px]"></i>
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex flex-wrap items-center justify-between gap-6 z-20">
                        <div className="flex items-center gap-8">
                             <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block ml-1">Follow-up Period</label>
                                <div className="flex items-center gap-2">
                                    {!readOnly ? (
                                        <input 
                                            type="date"
                                            value={form.followUpDate || ''}
                                            onChange={e => setForm({...form, followUpDate: e.target.value})}
                                            className="bg-gray-50 border border-gray-200 text-xs font-black px-3 py-2 rounded-xl outline-none"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                                            <span className="text-xs font-black text-blue-700">{form.followUpDate || 'No follow-up'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="hidden lg:flex items-center gap-4 py-2 px-6 border-l border-gray-100">
                                <div className="leading-tight">
                                    <p className="text-[10px] font-black text-gray-900 uppercase">Authenticated by Dr. {doctorName || visit.doctorName}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {!readOnly ? (
                                <>
                                    <button onClick={onClose} className="px-6 py-4 text-gray-400 font-black text-[10px] uppercase tracking-widest">Discard</button>
                                    <button onClick={e => handleSave(e, false)} disabled={isSaving || !form.diagnosis} className="px-10 py-4 bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl disabled:opacity-50">
                                        {isSaving ? 'VALIDATING...' : 'Authorize Rx'}
                                    </button>
                                </>
                            ) : <button onClick={onClose} className="px-8 py-4 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl">Close</button>}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
