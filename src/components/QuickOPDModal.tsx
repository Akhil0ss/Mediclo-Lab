'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, get, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import Modal from './Modal';
import { useToast } from '@/contexts/ToastContext';
import { generateOpdId, generateRxId } from '@/lib/idGenerator';
import { getBrandingData } from '@/lib/dataUtils';

interface QuickOPDModalProps {
    isOpen: boolean;
    onClose: () => void;
    ownerId: string;
    editData?: any; // Added for editing
}

export default function QuickOPDModal({ isOpen, onClose, ownerId, editData }: QuickOPDModalProps) {
    const { showToast } = useToast();
    const [patients, setPatients] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [labName, setLabName] = useState('CLINIC');

    const [form, setForm] = useState({
        patientId: '',
        patientName: '',
        patientAge: '',
        patientGender: '',
        patientPhone: '',
        patientUHID: '',
        doctorId: '',
        doctorName: '',
        vitals: {
            bp: '',
            pulse: '',
            weight: '',
            temp: '',
            spo2: ''
        },
        complaints: '',
        isEmergency: false
    });

    // Populate form if editing
    useEffect(() => {
        if (isOpen && editData) {
            setForm({
                patientId: editData.patientId || '',
                patientName: editData.patientName || '',
                patientAge: editData.patientAge || '',
                patientGender: editData.patientGender || '',
                patientPhone: editData.patientPhone || '',
                patientUHID: editData.patientUHID || '',
                doctorId: editData.doctorId || '',
                doctorName: editData.doctorName || '',
                vitals: editData.vitals || { bp: '', pulse: '', weight: '', temp: '', spo2: '' },
                complaints: editData.complaints || '',
                isEmergency: editData.isEmergency || false
            });
            setSearchQuery(editData.patientName || '');
        } else if (isOpen && !editData) {
            // Reset for new entry
            setForm({
                patientId: '', patientName: '', patientAge: '', patientGender: '',
                patientPhone: '', patientUHID: '',
                doctorId: '', doctorName: '',
                vitals: { bp: '', pulse: '', weight: '', temp: '', spo2: '' },
                complaints: '',
                isEmergency: false
            });
            setSearchQuery('');
        }
    }, [isOpen, editData]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen || !ownerId) return;

        // Fetch Patients
        const patientsRef = ref(database, `patients/${ownerId}`);
        const unsubPatients = onValue(patientsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
            // Sort by most recently added or name
            setPatients(data.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
        });

        // Fetch Doctors
        const staffRef = ref(database, `users/${ownerId}/auth/staff`);
        const unsubStaff = onValue(staffRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                const val = child.val();
                if (val.role === 'doctor' || val.role === 'dr-staff') {
                    data.push({ id: child.key, ...val });
                }
            });
            setDoctors(data);
        }, (error) => {
            console.error("Error fetching staff:", error);
        });

        // Fetch Branding for Clinic Name
        getBrandingData(ownerId, { ownerId }).then(data => {
            if (data?.labName) setLabName(data.labName);
        });

        return () => {
            unsubPatients();
            unsubStaff();
        };
    }, [isOpen, ownerId]);

    const filteredPatients = searchQuery 
        ? patients.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.mobile?.includes(searchQuery))
        : patients;

    const selectPatient = (p: any) => {
        setForm({
            ...form, 
            patientId: p.id, 
            patientName: p.name,
            patientAge: p.age || '',
            patientGender: p.gender || '',
            patientPhone: p.mobile || '',
            patientUHID: p.patientId || ''
        });
        setSearchQuery(p.name);
        setShowDropdown(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.patientId || !form.doctorId) {
            showToast('Select Patient and Doctor', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            if (editData?.id) {
                // Ensure OPD ID exists for legacy records during edit
                let opdId = editData.opdId;
                if (!opdId) {
                    opdId = await generateOpdId(ownerId, labName);
                }

                await update(ref(database, `opd/${ownerId}/${editData.id}`), {
                    ...form,
                    opdId,
                    updatedAt: new Date().toISOString()
                });
                showToast('OPD Entry Updated', 'success');
            } else {
                // Create new
                const today = new Date().toISOString().split('T')[0];
                
                // Get current count for token
                const opdRef = ref(database, `opd/${ownerId}`);
                const snapshot = await get(opdRef);
                let tokenCount = 1;
                if (snapshot.exists()) {
                    const visits = Object.values(snapshot.val());
                    tokenCount = visits.filter((v: any) => v.visitDate === today).length + 1;
                }

                const visitDate = today;
                const opdId = await generateOpdId(ownerId, labName);
                const rxId = await generateRxId(ownerId, labName);

                const visitData = {
                    ...form,
                    opdId,
                    rxId,
                    status: 'pending',
                    visitDate,
                    token: tokenCount,
                    createdAt: new Date().toISOString()
                };

                const newVisitRef = await push(ref(database, `opd/${ownerId}`), visitData);
                const visitKey = newVisitRef.key;

                // BINDING: Update patient_records index
                await update(ref(database, `patient_records/${ownerId}/${form.patientId}/visits/${visitKey}`), {
                    opdId,
                    rxId,
                    date: visitDate,
                    token: tokenCount,
                    status: 'pending'
                });

                showToast(`OPD Created: ${opdId} (Token #${tokenCount})`, 'success');
            }
            
            onClose();
        } catch (error: any) {
            console.error('OPD Registration Error:', error);
            showToast(editData?.id ? `Update failed: ${error.message}` : `Registration failed: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editData ? "Edit OPD Entry" : "Create New OPD Entry"}>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Patient dropdown selection (Primary) */}
                    <div className="space-y-2 relative" ref={dropdownRef}>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Patient (Required)</label>
                        <div 
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold flex justify-between items-center cursor-pointer hover:bg-white transition-all shadow-inner"
                        >
                            <span className={form.patientId ? "text-gray-900" : "text-gray-400"}>
                                {form.patientId ? form.patientName : "-- Choose from List --"}
                            </span>
                            <i className={`fas fa-chevron-down text-xs transition-transform ${showDropdown ? "rotate-180" : ""}`}></i>
                        </div>

                        {showDropdown && (
                            <div className="absolute z-[60] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                                    <input 
                                        type="text"
                                        autoFocus
                                        placeholder="Search by Name or Mobile..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                    {filteredPatients.length > 0 ? (
                                        filteredPatients.map((p) => (
                                            <button 
                                                key={p.id}
                                                type="button"
                                                onClick={() => selectPatient(p)}
                                                className={`w-full px-4 py-2 text-left hover:bg-orange-50 transition-colors border-b last:border-0 border-gray-50 flex items-center justify-between ${form.patientId === p.id ? 'bg-orange-50/50' : ''}`}
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className="font-bold text-xs text-gray-800 capitalize truncate">{p.name}</span>
                                                    <span className="text-[10px] text-gray-400 whitespace-nowrap opacity-70">| {p.mobile}</span>
                                                </div>
                                                {form.patientId === p.id && <i className="fas fa-check text-orange-600 text-[10px]"></i>}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-6 text-center">
                                            <p className="text-xs text-gray-400 italic">No matching patient found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Doctor Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assign Physician</label>
                        <select 
                            required
                            value={form.doctorId}
                            onChange={(e) => {
                                const d = doctors.find(doc => doc.id === e.target.value);
                                setForm({...form, doctorId: e.target.value, doctorName: d?.name || ''});
                            }}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500 shadow-inner appearance-none relative"
                        >
                            <option value="">-- Choose Doctor --</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>Dr. {d.name} ({d.specialization || 'Clinical Expert'})</option>
                            ))}
                        </select>
                    </div>

                    {/* Vitals Grid */}
                    <div className="md:col-span-2 grid grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-inner">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">BP (mmHg)</label>
                            <input type="text" placeholder="120/80" value={form.vitals.bp} onChange={e => setForm({...form, vitals: {...form.vitals, bp: e.target.value}})} className="w-full p-2 bg-white border rounded-lg text-xs font-bold focus:border-orange-400 outline-none transition-all" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Pulse</label>
                            <input type="text" placeholder="72" value={form.vitals.pulse} onChange={e => setForm({...form, vitals: {...form.vitals, pulse: e.target.value}})} className="w-full p-2 bg-white border rounded-lg text-xs font-bold focus:border-orange-400 outline-none transition-all" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Weight</label>
                            <input type="text" placeholder="kg" value={form.vitals.weight} onChange={e => setForm({...form, vitals: {...form.vitals, weight: e.target.value}})} className="w-full p-2 bg-white border rounded-lg text-xs font-bold focus:border-orange-400 outline-none transition-all" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Temp</label>
                            <input type="text" placeholder="F" value={form.vitals.temp} onChange={e => setForm({...form, vitals: {...form.vitals, temp: e.target.value}})} className="w-full p-2 bg-white border rounded-lg text-xs font-bold focus:border-orange-400 outline-none transition-all" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">SpO2</label>
                            <input type="text" placeholder="%" value={form.vitals.spo2} onChange={e => setForm({...form, vitals: {...form.vitals, spo2: e.target.value}})} className="w-full p-2 bg-white border rounded-lg text-xs font-bold focus:border-orange-400 outline-none transition-all" />
                        </div>
                    </div>

                    {/* Complaints */}
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chief Complaints</label>
                        <textarea 
                            rows={3}
                            value={form.complaints}
                            onChange={(e) => setForm({...form, complaints: e.target.value})}
                            placeholder="Symptoms or reason for visit..."
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none resize-none shadow-inner"
                        />
                    </div>

                    {/* Emergency Toggle */}
                    <div className="md:col-span-2 flex items-center gap-4 p-4 bg-red-50 rounded-2xl border border-red-100 shadow-sm transition-all hover:bg-red-100/50">
                        <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-red-200">
                            <i className="fas fa-ambulance text-white"></i>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-black text-red-700 uppercase tracking-wider">Emergency Priority Case</h4>
                            <p className="text-[10px] text-red-500 font-bold uppercase opacity-70">Marking this will alert the Doctor immediately.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={form.isEmergency} 
                                onChange={(e) => setForm({...form, isEmergency: e.target.checked})}
                                className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="px-6 py-2.5 text-gray-400 font-bold text-xs uppercase hover:text-gray-600 transition-colors"
                    >
                        Back
                    </button>
                    <button 
                        type="submit"
                        disabled={isSaving}
                        className="px-8 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-orange-200 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isSaving ? 'Processing...' : (editData ? 'Update OPD' : 'Create OPD')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
