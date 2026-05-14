'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import Modal from './Modal';
import { useToast } from '@/contexts/ToastContext';
import { generateSampleId } from '@/lib/idGenerator';
import { mergeTemplates } from '@/lib/templateUtils';

interface QuickSampleModalProps {
    isOpen: boolean;
    onClose: () => void;
    ownerId: string;
    labName?: string;
    initialVisit?: any;
    initialPatient?: any;
}

export default function QuickSampleModal({ isOpen, onClose, ownerId, labName, initialVisit, initialPatient }: QuickSampleModalProps) {
    const { showToast } = useToast();
    const [patients, setPatients] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    
    // UI State for New Doctor
    const [showNewDrInput, setShowNewDrInput] = useState(false);
    const [newDrName, setNewDrName] = useState('');

    // Dropdown & Search Logic
    const [searchQuery, setSearchQuery] = useState('');
    const [testSearch, setTestSearch] = useState('');
    const [showPatDropdown, setShowPatDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [form, setForm] = useState({
        sampleNumber: '',
        patientId: '',
        patientName: '',
        patientAge: '',
        patientGender: '',
        patientMobile: '',
        refDoctor: 'Self',
        sampleType: 'Whole Blood',
        containerType: 'Plain Vial',
        priority: 'Routine',
        collectionCondition: 'Random',
        collectedBy: '',
        remarks: '',
        date: new Date().toISOString().slice(0, 16),
        selectedTests: [] as string[],
        visitId: ''
    });

    const sampleTypes = ['Whole Blood', 'Serum', 'Plasma', 'Urine', 'Stool', 'Swab', 'Sputum', 'Semen', 'Fluid', 'Tissue', 'Other'];
    const conditions = ['Random', 'Fasting', 'Post-Prandial (PP)', 'Timed Sample'];

    useEffect(() => {
        if (!isOpen) {
            // Reset ID and other flags when modal is closed
            setForm(prev => ({ ...prev, sampleNumber: '' }));
            setShowNewDrInput(false);
            setNewDrName('');
            return;
        }

        // 0. Only generate ID once per open event
        if (!form.sampleNumber && ownerId) {
            generateSampleId(ownerId, labName || 'CLINIC').then(id => {
                setForm(prev => ({ ...prev, sampleNumber: id }));
            });
        }
    }, [isOpen, ownerId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowPatDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen || !ownerId) return;

        // 1. Fetch Patients
        const patientsRef = ref(database, `patients/${ownerId}`);
        onValue(patientsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach(child => { data.push({ id: child.key, ...child.val() }); });
            setPatients(data.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
        });

        // 2. Fetch Templates
        const userTRef = ref(database, `templates/${ownerId}`);
        const commTRef = ref(database, 'common_templates');
        Promise.all([get(userTRef), get(commTRef)]).then(([userSnap, commSnap]) => {
            const ut: any[] = [];
            userSnap.forEach(c => { ut.push({ id: c.key, ...c.val() }); });
            const ct: any[] = [];
            commSnap.forEach(c => { ct.push({ id: c.key, ...c.val() }); });
            setTemplates(mergeTemplates(ut, ct));
        });

        // 3. Fetch Clinicians (Internal + External)
        const extDocsRef = ref(database, `externalDoctors/${ownerId}`);
        onValue(extDocsRef, (snapshot) => {
            const ext: any[] = [];
            snapshot.forEach(child => { ext.push({ id: child.key, name: child.val().name, type: 'External' }); });
            
            const staffRef = ref(database, `users/${ownerId}/auth/staff`);
            onValue(staffRef, (staffSnap) => {
                const docsOnly: any[] = [];
                staffSnap.forEach(child => {
                    const val = child.val();
                    if (val.role === 'doctor') docsOnly.push({ id: child.key, name: val.name, type: 'Internal' });
                });
                setDoctors([...docsOnly, ...ext].sort((a,b) => a.name.localeCompare(b.name)));
            });
        });
    }, [isOpen, ownerId]);

    // SECURE HYDRATION HOOK: Prevents Infinite Re-renders
    useEffect(() => {
        if (!isOpen) return;

        // 5. Handle Initial Context (Auto-fill from Doctor Referral)
        if (initialVisit && form.visitId !== initialVisit.id && templates.length > 0) {
            const referredNames = initialVisit.prescription?.referredTests || [];
            // Map test names from Rx output to our lab template IDs
            const idsFromNames = templates
                .filter(t => referredNames.includes(t.name) || referredNames.includes(t.id))
                .map(t => t.id);

            setForm(prev => ({
                ...prev,
                patientId: initialVisit.patientId || '',
                patientName: initialVisit.patientName || '',
                patientAge: initialVisit.patientAge || '',
                patientGender: initialVisit.patientGender || 'Male',
                patientMobile: initialVisit.patientMobile || '',
                refDoctor: initialVisit.doctorName || 'Self',
                selectedTests: idsFromNames,
                visitId: initialVisit.id || ''
            }));
        } else if (initialPatient && !initialVisit && form.patientId !== (initialPatient.id || initialPatient.patientId)) {
            setForm(prev => ({
                ...prev,
                patientId: initialPatient.id || initialPatient.patientId || '',
                patientName: initialPatient.name || '',
                patientAge: initialPatient.age || '',
                patientGender: initialPatient.gender || 'Male',
                patientMobile: initialPatient.mobile || '',
                refDoctor: initialPatient.refDoctor || 'Self'
            }));
        }
    }, [isOpen, initialVisit, initialPatient, templates, form.visitId, form.patientId]);

    const selectPatient = (p: any) => {
        setForm({
            ...form, 
            patientId: p.id, 
            patientName: p.name,
            patientAge: p.age || '',
            patientGender: p.gender || 'Male',
            patientMobile: p.mobile || '',
            refDoctor: p.refDoctor || 'Self'
        });
        setShowPatDropdown(false);
    };

    const toggleTest = (id: string) => {
        setForm(prev => ({
            ...prev,
            selectedTests: prev.selectedTests.includes(id) 
                ? prev.selectedTests.filter(t => t !== id)
                : [...prev.selectedTests, id]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.patientId || form.selectedTests.length === 0) {
            showToast('Select patient and at least one test', 'warning');
            return;
        }

        if (form.patientName.length < 2 || form.patientName.length > 50) {
            showToast('Patient name must be between 2 and 50 characters', 'error');
            return;
        }
        
        if (form.patientMobile && form.patientMobile.length !== 10) {
            showToast('Mobile number must be exactly 10 digits', 'error');
            return;
        }

        setIsSaving(true);
        try {
            let finalRefDoctor = form.refDoctor;

            // Save New External Doctor if needed
            if (showNewDrInput && newDrName.trim()) {
                const drData = {
                    name: newDrName.trim(),
                    createdAt: new Date().toISOString()
                };
                await push(ref(database, `externalDoctors/${ownerId}`), drData);
                finalRefDoctor = newDrName.trim();
            }

            const testNames = form.selectedTests.map(id => templates.find(t => t.id === id)?.name).filter(Boolean);
            
            const sampleData = {
                ...form,
                refDoctor: finalRefDoctor, // Ensure consistency with patient/report naming
                tests: testNames,
                testIds: form.selectedTests,
                status: 'Pending',
                visitId: form.visitId || '', // Link to clinical visit if referred
                createdAt: new Date().toISOString()
            };

            await push(ref(database, `samples/${ownerId}`), sampleData);
            logAudit(ownerId, AUDIT_ACTIONS.SAMPLE_COLLECTED, `Sample collected for ${form.patientName} - ${testNames.join(', ')}`, form.patientName || 'Unknown');
            showToast('Sample Collected Successfully!', 'success');
            onClose();
            // Reset
            setShowNewDrInput(false);
            setNewDrName('');
        } catch (error) {
            showToast('Failed to save sample', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Collect Laboratory Sample">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Header: ID and Timing */}
                    <div className="flex gap-3 md:col-span-2">
                        <div className="flex-1 p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                            <label className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Assigned Sample ID</label>
                            <span className="text-sm font-black text-indigo-900">{form.sampleNumber}</span>
                        </div>
                        <div className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                            <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Collection Time</label>
                            <input type="datetime-local" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="bg-transparent border-none p-0 text-xs font-bold text-gray-700 outline-none w-full" />
                        </div>
                    </div>

                    {/* Patient Selection */}
                    <div className="space-y-2 relative" ref={dropdownRef}>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Patient (Required)</label>
                        <div 
                            onClick={() => setShowPatDropdown(!showPatDropdown)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold flex justify-between items-center cursor-pointer hover:bg-white transition-all shadow-inner"
                        >
                            <span className={form.patientId ? "text-gray-900" : "text-gray-400"}>
                                {form.patientId ? form.patientName : "-- Choose from List --"}
                            </span>
                            <i className={`fas fa-chevron-down text-xs transition-transform ${showPatDropdown ? "rotate-180" : ""}`}></i>
                        </div>

                        {showPatDropdown && (
                            <div className="absolute z-[65] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden">
                                <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                                    <input autoFocus placeholder="Search by name or mobile..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" onClick={e => e.stopPropagation()} />
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                    {(searchQuery ? patients.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.mobile?.includes(searchQuery)) : patients).map(p => (
                                        <button key={p.id} type="button" onClick={() => selectPatient(p)} className="w-full px-4 py-2 text-left hover:bg-indigo-50 flex items-center justify-between border-b last:border-0 border-gray-50">
                                            <span className="font-bold text-xs text-gray-800 capitalize">{p.name} <span className="opacity-40 ml-2 font-normal">| {p.mobile}</span></span>
                                            {form.patientId === p.id && <i className="fas fa-check text-indigo-600 text-[10px]"></i>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Referring Doctor */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Referring Doctor</label>
                            <button 
                                type="button" 
                                onClick={() => setShowNewDrInput(!showNewDrInput)}
                                className={`text-[9px] font-black uppercase tracking-tighter ${showNewDrInput ? 'text-red-500' : 'text-indigo-600'}`}
                            >
                                {showNewDrInput ? 'Cancel' : '+ New Dr'}
                            </button>
                        </div>

                        {showNewDrInput ? (
                            <input 
                                autoFocus
                                type="text"
                                placeholder="Enter Doctor's Full Name"
                                value={newDrName}
                                onChange={(e) => setNewDrName(e.target.value)}
                                className="w-full p-2.5 bg-white border-2 border-indigo-200 rounded-xl text-sm font-bold shadow-lg outline-none animate-in zoom-in-95"
                            />
                        ) : (
                            <div className="relative group">
                                <select 
                                    value={form.refDoctor}
                                    onChange={(e) => setForm({...form, refDoctor: e.target.value})}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none shadow-inner pr-8"
                                >
                                    <option value="Self">Self / Walk-in</option>
                                    <optgroup label="Internal Staff">
                                        {doctors.filter(d => d.type === 'Internal').map(d => (
                                            <option key={d.id} value={d.name}>Dr. {d.name} (Staff)</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="External Associates">
                                        {doctors.filter(d => d.type === 'External').map(d => (
                                            <option key={d.id} value={d.name}>Dr. {d.name} (Associate)</option>
                                        ))}
                                    </optgroup>
                                </select>
                                <i className="fas fa-chevron-down absolute right-3 top-3.5 text-gray-300 text-[10px] pointer-events-none group-hover:text-indigo-400 transition-colors"></i>
                            </div>
                        )}
                    </div>

                    {/* Integrated Phlebotomy Details */}
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Phlebotomy Details (Type, Vial, Condition, Priority, Collector)</label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {/* Type */}
                            <select value={form.sampleType} onChange={e => setForm({...form, sampleType: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-bold shadow-inner">
                                {sampleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            {/* Vial */}
                            <select value={form.containerType} onChange={e => setForm({...form, containerType: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-bold shadow-inner">
                                <option value="Plain Vial">Plain Vial</option>
                                <option value="EDTA (Purple)">EDTA (Purple)</option>
                                <option value="Citrate (Blue)">Citrate (Blue)</option>
                                <option value="Heparin (Green)">Heparin (Green)</option>
                                <option value="Fluoride (Grey)">Fluoride (Grey)</option>
                                <option value="Urine Container">Urine Container</option>
                                <option value="Stool Container">Stool Container</option>
                                <option value="Swab/Other">Swab/Other</option>
                            </select>
                            {/* Condition */}
                            <select value={form.collectionCondition} onChange={e => setForm({...form, collectionCondition: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-bold shadow-inner">
                                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {/* Priority */}
                            <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-bold shadow-inner border-orange-200 text-orange-700">
                                <option value="Routine">Regular</option>
                                <option value="Urgent">Urgent</option>
                            </select>
                            {/* Collector */}
                            <input 
                                required
                                type="text" 
                                placeholder="Phlebotomist Name" 
                                value={form.collectedBy} 
                                onChange={e => setForm({...form, collectedBy: e.target.value})} 
                                className="w-full p-2 bg-purple-50 border border-purple-100 rounded-xl text-[10px] font-bold shadow-inner focus:ring-1 focus:ring-indigo-400 outline-none" 
                            />
                        </div>
                    </div>

                    {/* Test Selection */}
                    <div className="md:col-span-2 space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Required Tests ({form.selectedTests.length})</label>
                        <div className="relative">
                            <i className="fas fa-search absolute left-3 top-3 text-gray-300 text-xs"></i>
                            <input type="text" placeholder="Search tests..." value={testSearch} onChange={e => setTestSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-t-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="max-h-44 overflow-y-auto border border-t-0 rounded-b-xl grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100">
                            {(testSearch ? templates.filter(t => 
                                t.name?.toLowerCase().includes(testSearch.toLowerCase()) || 
                                t.subtests?.some((st: any) => (st.name || st.testName || "").toLowerCase().includes(testSearch.toLowerCase()))
                            ) : templates.slice(0, 30)).map(t => (
                                <div key={t.id} onClick={() => toggleTest(t.id)} className={`px-4 py-2 bg-white flex items-center gap-3 cursor-pointer select-none transition-colors ${form.selectedTests.includes(t.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${form.selectedTests.includes(t.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                                        {form.selectedTests.includes(t.id) && <i className="fas fa-check text-[8px]"></i>}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-[11px] font-bold text-gray-700 truncate capitalize">{t.name}</p>
                                        <p className="text-[8px] font-black text-gray-300 uppercase tracking-tighter">{t.category || 'General'}</p>
                                    </div>
                                    <span className="text-[10px] font-black text-indigo-600">₹{t.totalPrice || t.price || 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Internal Remarks</label>
                        <textarea rows={2} value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} placeholder="Any specific instructions for processing..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner" />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 text-gray-400 font-bold text-xs uppercase transition-colors hover:text-gray-600">Close</button>
                    <button type="submit" disabled={isSaving} className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-700 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all">
                        {isSaving ? 'Processing...' : 'Collect Sample'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
