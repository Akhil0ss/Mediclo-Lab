'use client';

import { useState, useEffect } from 'react';
import { ref, push, onValue, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import Modal from './Modal';
import { useToast } from '@/contexts/ToastContext';
import { generatePatientId } from '@/lib/idGenerator';
import { getBrandingData } from '@/lib/dataUtils';

interface QuickPatientModalProps {
    isOpen: boolean;
    onClose: () => void;
    ownerId: string;
}

export default function QuickPatientModal({ isOpen, onClose, ownerId }: QuickPatientModalProps) {
    const { showToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    // Unified Clinician List (Internal Staff + External Doctors)
    const [doctors, setDoctors] = useState<any[]>([]);
    const [showNewDrInput, setShowNewDrInput] = useState(false);
    const [newDrName, setNewDrName] = useState('');

    const [form, setForm] = useState({
        title: 'Mr.',
        name: '',
        mobile: '',
        gender: 'Male',
        age: '',
        address: '',
        refDoctor: 'Self'
    });

    useEffect(() => {
        if (!isOpen || !ownerId) return;

        // 1. Fetch External Doctors (Correct Path: externalDoctors)
        const extDocsRef = ref(database, `externalDoctors/${ownerId}`);
        const unsubExt = onValue(extDocsRef, (snapshot) => {
            const ext: any[] = [];
            snapshot.forEach(child => {
                ext.push({ id: child.key, name: child.val().name, type: 'External' });
            });
            
            // 2. Fetch Internal Staff (Doctors)
            const staffRef = ref(database, `users/${ownerId}/auth/staff`);
            onValue(staffRef, (staffSnap) => {
                const staff: any[] = [];
                staffSnap.forEach(child => {
                    const val = child.val();
                    if (val.role === 'doctor') {
                        staff.push({ id: child.key, name: val.name, type: 'Internal' });
                    }
                });
                setDoctors([...staff, ...ext].sort((a,b) => a.name.localeCompare(b.name)));
            });
        });

        return () => unsubExt();
    }, [isOpen, ownerId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.mobile) {
            showToast('Name and Mobile are required', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            let finalRefDoctor = form.refDoctor;

            // If adding a new doctor, save them first
            if (showNewDrInput && newDrName.trim()) {
                const drData = {
                    name: newDrName.trim(),
                    createdAt: new Date().toISOString()
                };
                await push(ref(database, `externalDoctors/${ownerId}`), drData);
                finalRefDoctor = newDrName.trim();
            }

            const branding = await getBrandingData(ownerId, { ownerId });
            const labName = branding?.labName || 'CLINIC';
            const patientReadableId = await generatePatientId(ownerId, labName);

            const patientData = {
                ...form,
                patientId: patientReadableId,
                refDoctor: finalRefDoctor,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await push(ref(database, `patients/${ownerId}`), patientData);
            showToast(`Patient Registered: ${patientReadableId}`, 'success');
            onClose();
            // Reset
            setForm({ title: 'Mr.', name: '', mobile: '', gender: 'Male', age: '', address: '', refDoctor: 'Self' });
            setShowNewDrInput(false);
            setNewDrName('');
        } catch (error) {
            showToast('Failed to register patient', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quick Patient Registration">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Title & Name */}
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Name (Required)</label>
                        <div className="flex gap-2">
                            <select 
                                value={form.title}
                                onChange={(e) => setForm({...form, title: e.target.value})}
                                className="w-24 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 shadow-inner appearance-none"
                            >
                                <option value="Mr.">Mr.</option>
                                <option value="Ms.">Ms.</option>
                                <option value="Mrs.">Mrs.</option>
                                <option value="Mast.">Mast.</option>
                                <option value="Miss">Miss</option>
                                <option value="Dr.">Dr.</option>
                            </select>
                            <input 
                                required
                                type="text"
                                placeholder="Patient Full Name"
                                value={form.name}
                                onChange={(e) => setForm({...form, name: e.target.value})}
                                className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Mobile */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mobile Number</label>
                        <input 
                            required
                            type="tel"
                            placeholder="Mobile No."
                            value={form.mobile}
                            onChange={(e) => setForm({...form, mobile: e.target.value})}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 shadow-inner"
                        />
                    </div>

                    {/* Age & Gender */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Age</label>
                            <input 
                                type="text"
                                placeholder="Age"
                                value={form.age}
                                onChange={(e) => setForm({...form, age: e.target.value})}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gender</label>
                            <select 
                                value={form.gender}
                                onChange={(e) => setForm({...form, gender: e.target.value})}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    {/* Referring Doctor (Unified + Inline Add) */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Referring Doctor</label>
                            <button 
                                type="button" 
                                onClick={() => setShowNewDrInput(!showNewDrInput)}
                                className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${showNewDrInput ? 'text-red-500' : 'text-purple-600'}`}
                            >
                                {showNewDrInput ? 'Cancel' : '+ Add New Dr'}
                            </button>
                        </div>
                        
                        {showNewDrInput ? (
                            <input 
                                autoFocus
                                type="text"
                                placeholder="Enter Doctor Name"
                                value={newDrName}
                                onChange={(e) => setNewDrName(e.target.value)}
                                className="w-full p-2.5 bg-white border-2 border-purple-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none shadow-lg animate-in zoom-in-95"
                            />
                        ) : (
                            <div className="relative group">
                                <select 
                                    value={form.refDoctor}
                                    onChange={(e) => setForm({...form, refDoctor: e.target.value})}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 appearance-none shadow-inner pr-8"
                                >
                                    <option value="Self">Self / Walk-in</option>
                                    <optgroup label="Internal Staff">
                                        {doctors.filter(d => d.type === 'Internal').map(d => (
                                            <option key={d.id} value={d.name}>Dr. {d.name} (Staff)</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="External Doctors">
                                        {doctors.filter(d => d.type === 'External').map(d => (
                                            <option key={d.id} value={d.name}>Dr. {d.name} (Associate)</option>
                                        ))}
                                    </optgroup>
                                </select>
                                <i className="fas fa-chevron-down absolute right-3 top-3.5 text-gray-300 text-[10px] pointer-events-none group-hover:text-purple-400 transition-colors"></i>
                            </div>
                        )}
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Address</label>
                        <input 
                            type="text"
                            placeholder="Residential area"
                            value={form.address}
                            onChange={(e) => setForm({...form, address: e.target.value})}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 shadow-inner"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 text-gray-400 font-bold text-xs uppercase hover:text-gray-600">Close</button>
                    <button type="submit" disabled={isSaving} className="px-8 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-purple-200 active:scale-95 transition-all">
                        {isSaving ? 'Saving...' : 'Add Patient'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
