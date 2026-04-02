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
}

export default function RxModal({ isOpen, onClose, visit, ownerId, doctorName, labName = 'CLINIC', readOnly = false }: RxModalProps) {
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
                followUpDate: visit.prescription?.followUpDate || ''
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
                                <span className="bg-gray-100 text-gray-500 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">{visit.opdId || 'NEW VISIT'}</span>
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
                    {/* Main Workspace */}
                    <div className="overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-24">
                        
                        {/* 🌡️ STEP 2: VITALS & SYMPTOMS INLINE ROW */}
                        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm transition-all hover:border-blue-100">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <i className="fas fa-heartbeat text-rose-500 text-xs"></i> Clinical Vitals & Complaints
                                </h4>
                                {!readOnly && (
                                    <button 
                                        type="button" 
                                        onClick={handleAnalysis}
                                        disabled={isAiLoading}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <i className={`fas fa-brain ${isAiLoading ? 'fa-spin' : ''}`}></i> {isAiLoading ? 'Analyzing...' : 'Analyze Case'}
                                    </button>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                                {Object.entries(visit.vitals || {}).map(([k, v]) => (
                                    v ? (
                                        <div key={k} className="bg-gray-50/50 px-3 py-2 rounded-xl border border-gray-100 flex flex-col gap-0.5">
                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">{k}</span>
                                            <span className="text-xs font-black text-gray-800">{String(v)}</span>
                                        </div>
                                    ) : null
                                ))}
                            </div>

                            {visit.complaints && (
                                <div className="p-3 bg-amber-50/30 border border-amber-100 rounded-xl relative group mb-4">
                                    <span className="absolute -top-2 left-3 bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded tracking-widest uppercase">Chief Complaints</span>
                                    <p className="text-xs font-bold text-gray-700 italic pt-1 leading-relaxed">"{visit.complaints}"</p>
                                </div>
                            )}

                            {/* 🧪 LATEST LAB REPORTS (ONLY FOR REFERRED) */}
                            {patientReports.length > 0 && (
                                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                        <i className="fas fa-vials text-4xl text-indigo-600"></i>
                                    </div>
                                    <h5 className="text-[9px] font-black text-indigo-700 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                        <i className="fas fa-flask-vial text-indigo-500"></i> Recent Diagnostic Findings
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {patientReports.slice(0, 6).map((report, ridx) => (
                                            <div key={ridx} className="bg-white p-3 rounded-xl border border-indigo-50 shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => window.open(`/print/report/${report.id}`, '_blank')}>
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[10px] font-black text-gray-900 truncate uppercase tracking-tight">{report.testName}</span>
                                                    <i className="fas fa-external-link-alt text-[8px] text-gray-300 group-hover:text-indigo-500"></i>
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {report.results?.slice(0, 3).map((res: any, i: number) => (
                                                        <span key={i} className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${res.threatLevel === 'High' || res.threatLevel === 'Critical' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-600'}`}>
                                                            {res.parameter}: {res.value}
                                                        </span>
                                                    ))}
                                                    {report.results?.length > 3 && <span className="text-[7px] text-gray-400 font-bold">+{report.results.length - 3}</span>}
                                                </div>
                                                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50">
                                                    <p className="text-[8px] text-gray-400 font-black uppercase tracking-tighter">{new Date(report.date || report.createdAt).toLocaleDateString()}</p>
                                                    <span className="text-[7px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">PREVIEW REPORT</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* 🧠 STEP 3: DIAGNOSIS ENGINE */}
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">Clinical Diagnosis</label>
                                    <textarea 
                                        value={form.diagnosis || ''}
                                        onChange={e => setForm({...form, diagnosis: e.target.value})}
                                        placeholder="Enter primary clinical impression..."
                                        className="w-full p-4 border border-gray-200 rounded-2xl bg-white focus:ring-4 focus:ring-blue-50 outline-none text-sm font-black shadow-inner resize-none min-h-[80px] transition-all"
                                        readOnly={readOnly}
                                    />
                                    
                                    {!readOnly && (aiDiagnosis?.possibleDiagnoses) && (
                                        <div className="flex flex-wrap gap-2">
                                            {(aiDiagnosis.possibleDiagnoses.slice(0, 3)).map((d: any, i: number) => (
                                                <button 
                                                    key={i}
                                                    type="button"
                                                    onClick={() => setForm({...form, diagnosis: d.name})}
                                                    className="px-3 py-2 bg-white border border-purple-100 rounded-xl text-left hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all group shadow-sm active:scale-95"
                                                >
                                                    <span className="text-[10px] font-black uppercase truncate block">{d.name}</span>
                                                    <p className="text-[8px] font-bold text-purple-400 group-hover:text-purple-100 tracking-tighter uppercase">{d.probability} CONFIDENCE</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 bg-gray-50/30 p-4 rounded-2xl border border-gray-100 h-full min-h-[140px]">
                                    <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-2">
                                        <i className="fas fa-microscope text-blue-500"></i> Evidence & Insights
                                    </h5>
                                    {aiDiagnosis?.differentialNote ? (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold text-gray-600 leading-relaxed italic">"{aiDiagnosis.differentialNote}"</p>
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {aiDiagnosis.possibleDiagnoses?.map((d: any, i: number) => (
                                                    <span key={i} className="text-[8px] font-black text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded uppercase">Diff: {d.name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full opacity-20 text-gray-400 py-4">
                                            <i className="fas fa-dna text-2xl mb-1"></i>
                                            <span className="text-[8px] font-black uppercase">{isAiLoading ? 'Analyzing Case...' : 'Analysis Pending'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 💊 STEP 4: TREATMENT REGIME (WIDE TABLE) */}
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
                                                        placeholder="Type Medicine..."
                                                        className="w-full bg-transparent text-xs font-black text-gray-900 border-b border-transparent focus:border-blue-500 outline-none uppercase py-1"
                                                        readOnly={readOnly}
                                                    />
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    <input 
                                                        type="text" 
                                                        value={med.dosage || ''}
                                                        onChange={e => { const nm = [...form.medicines]; nm[idx].dosage = e.target.value; setForm({...form, medicines: nm}); }}
                                                        placeholder="mg/ml"
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
                                                            <option value="OD">O.D.</option>
                                                            <option value="BD">B.D.</option>
                                                            <option value="TDS">T.D.S.</option>
                                                        </select>
                                                    ) : (
                                                        <span className="text-xs font-black text-gray-800">{med.frequency}</span>
                                                    )}
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
                                                            <option value="7 Days">1W</option>
                                                            <option value="10 Days">10D</option>
                                                            <option value="15 Days">15D</option>
                                                            <option value="1 Month">1M</option>
                                                            <option value="3 Months">3M</option>
                                                            <option value="6 Months">6M</option>
                                                        </select>
                                                    ) : (
                                                        <span className="text-xs font-black text-gray-800">{med.duration}</span>
                                                    )}
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
                                                            <option value="Empty Stomach">EMPTY STOMACH</option>
                                                            <option value="At Bedtime">AT BEDTIME</option>
                                                            <option value="In Morning">IN MORNING</option>
                                                            <option value="With Milk">WITH MILK</option>
                                                            <option value="SOS">SOS (AS REQ.)</option>
                                                        </select>
                                                    ) : (
                                                        <span className="text-xs font-bold text-gray-600">{med.instructions}</span>
                                                    )}
                                                </td>
                                                {!readOnly && (
                                                    <td className="px-4 py-2 text-center whitespace-nowrap">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => { const nm = [...form.medicines]; nm.splice(idx,1); setForm({...form, medicines: nm}); }}
                                                            className="text-gray-300 hover:text-red-500 transition-colors"
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

                        {/* 📝 STEP 5: CLINICAL ADVICE & LABS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                            <div className="space-y-3 bg-white p-5 rounded-2xl border border-gray-200">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Medical Advice</label>
                                    {!readOnly && (
                                        <button 
                                            type="button" 
                                            onClick={handleGenerateAdvice} 
                                            className="text-[8px] font-black text-teal-600 uppercase tracking-widest hover:text-teal-800 transition-colors border border-teal-50 px-2 py-1 rounded"
                                        >
                                            <i className="fas fa-wand-magic-sparkles mr-1"></i> AI Suggestions
                                        </button>
                                    )}
                                </div>
                                <textarea 
                                    value={form.advice || ''}
                                    onChange={e => setForm({...form, advice: e.target.value})}
                                    placeholder="Lifestyle, Diet, Precautions..."
                                    className="w-full p-4 border border-gray-200 rounded-2xl bg-gray-50/30 focus:ring-4 focus:ring-teal-50 outline-none text-xs font-black shadow-inner resize-none min-h-[100px]"
                                    readOnly={readOnly}
                                />
                            </div>

                            <div className="bg-orange-50/40 p-5 rounded-2xl border border-orange-100 flex flex-col h-full relative overflow-hidden">
                                <label className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-3 flex items-center gap-2 relative z-10"><i className="fas fa-flask"></i> Clinical Referrals</label>
                                
                                {!readOnly && (
                                    <div className="relative mb-3">
                                        <input 
                                            list="clinicalTests"
                                            type="text" 
                                            placeholder="Select Clinical Referral... (Enter)" 
                                            onKeyDown={e => {
                                                if(e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const v = (e.target as HTMLInputElement).value.trim();
                                                    if (v && !form.referredTests.includes(v)) {
                                                        setForm({...form, referredTests: [...form.referredTests, v]});
                                                        (e.target as HTMLInputElement).value = '';
                                                    }
                                                }
                                            }} 
                                            className="w-full p-2.5 text-[10px] font-black bg-white border border-orange-200 focus:border-orange-500 rounded-xl outline-none shadow-sm placeholder:text-gray-300"
                                        />
                                        <datalist id="clinicalTests">
                                            {templates.map((t: any) => (
                                                <option key={t.id} value={t.testName || t.name} />
                                            ))}
                                        </datalist>
                                    </div>
                                )}
                                
                                <div className="flex flex-wrap gap-1.5 content-start min-h-[50px]">
                                    {form.referredTests.length === 0 ? (
                                        <span className="text-[10px] text-orange-200 font-bold italic">No tests referred.</span>
                                    ) : (
                                        form.referredTests.map((test, idx) => (
                                            <span key={idx} className="bg-orange-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black flex items-center gap-2 shadow-sm">
                                                {test}
                                                {!readOnly && <i className="fas fa-times cursor-pointer hover:bg-orange-700 p-1 rounded transition-colors" onClick={() => setForm({...form, referredTests: form.referredTests.filter((_,i) => i !== idx)})}></i>}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* 🚀 STEP 6: HORIZONTAL SIGNATURE FOOTER */}
                    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] flex flex-wrap items-center justify-between gap-6 z-20">
                        <div className="flex items-center gap-8">
                             {/* Follow-up Selector */}
                             <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block ml-1">Follow-up Period</label>
                                <div className="flex items-center gap-2">
                                    {!readOnly ? (
                                        <>
                                            <select 
                                                className="bg-gray-50 border border-gray-200 text-[10px] font-black px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 uppercase cursor-pointer"
                                                onChange={e => {
                                                    const days = parseInt(e.target.value);
                                                    if(isNaN(days)) return;
                                                    const date = new Date();
                                                    date.setDate(date.getDate() + days);
                                                    setForm({...form, followUpDate: date.toISOString().split('T')[0]});
                                                }}
                                            >
                                                <option value="">Presets...</option>
                                                <option value="3">3 Days</option>
                                                <option value="7">1 Week</option>
                                                <option value="15">2 Weeks</option>
                                                <option value="30">1 Month</option>
                                            </select>
                                            <input 
                                                type="date"
                                                value={form.followUpDate || ''}
                                                onChange={e => setForm({...form, followUpDate: e.target.value})}
                                                className="bg-gray-50 border border-gray-200 text-xs font-black px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                                            <i className="far fa-calendar-check text-blue-500 text-xs"></i>
                                            <span className="text-xs font-black text-blue-700">{form.followUpDate || 'No follow-up'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Center Signature */}
                            <div className="hidden lg:flex items-center gap-4 py-2 px-6 border-l border-gray-100">
                                <div className="w-10 h-10 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100 flex items-center justify-center text-sm">
                                    <i className="fas fa-signature"></i>
                                </div>
                                <div className="leading-tight">
                                    <p className="text-[10px] font-black text-gray-900 uppercase">Authenticated by Dr. {doctorName || visit.doctorName}</p>
                                    <p className="text-[9px] font-bold text-blue-500 tracking-tighter uppercase font-mono">MD-CERT-{visit.id.substring(0,8)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Save Actions */}
                        <div className="flex items-center gap-3">
                            {!readOnly ? (
                                <>
                                    <button 
                                        onClick={onClose} 
                                        className="px-6 py-4 text-gray-400 hover:text-gray-600 font-black text-[10px] uppercase tracking-widest transition-colors"
                                    >
                                        Discard
                                    </button>
                                    <button 
                                        onClick={e => handleSave(e, false)} 
                                        disabled={isSaving || !form.diagnosis}
                                        className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
                                    >
                                        {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-shield-alt"></i>}
                                        {isSaving ? 'VALIDATING...' : 'Authorize Rx'}
                                    </button>
                                </>
                            ) : (
                                <div className="flex gap-3">
                                    <button onClick={() => window.open(`/print/opd/${visit.id}`, '_blank')} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-3">
                                        <i className="fas fa-print"></i> Print Rx
                                    </button>
                                    <button onClick={onClose} className="px-8 py-4 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-all">
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
