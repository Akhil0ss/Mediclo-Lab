'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, push, get, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import Modal from './Modal';
import { useToast } from '@/contexts/ToastContext';
import { generateOpdId, generateRxId } from '@/lib/idGenerator';
import { getBrandingData } from '@/lib/dataUtils';

interface OnlineAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    ownerId: string;
}

export default function OnlineAppointmentModal({ isOpen, onClose, ownerId }: OnlineAppointmentModalProps) {
    const { showToast } = useToast();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [labName, setLabName] = useState('CLINIC');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFields, setEditFields] = useState({ date: '', time: '', token: '' });

    useEffect(() => {
        if (!isOpen || !ownerId) return;

        const appointmentsRef = ref(database, `appointments/${ownerId}`);
        const unsub = onValue(appointmentsRef, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((child) => {
                const val = child.val();
                if (val.status === 'pending' || val.status === 'confirmed') {
                    list.push({ id: child.key, ...val });
                }
            });
            // Sort: pending first, then by createdAt newest to oldest
            const sorted = list.sort((a, b) => {
                if (a.status === 'pending' && b.status === 'confirmed') return -1;
                if (a.status === 'confirmed' && b.status === 'pending') return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            setAppointments(sorted);
            setLoading(false);
        });

        getBrandingData(ownerId, { ownerId }).then(data => {
            if (data?.labName) setLabName(data.labName);
        });

        return () => unsub();
    }, [isOpen, ownerId]);

    const handleApprove = async (appointment: any) => {
        if (isProcessing) return;
        setIsProcessing(true);

        const targetDate = editingId === appointment.id ? editFields.date : appointment.date;
        const targetTime = editingId === appointment.id ? editFields.time : appointment.time;
        const manualToken = editingId === appointment.id ? parseInt(editFields.token) : NaN;

        try {
            const today = targetDate || new Date().toISOString().split('T')[0];
            
            let tokenCount = isNaN(manualToken) ? 1 : manualToken;
            if (isNaN(manualToken)) {
                const opdRef = ref(database, `opd/${ownerId}`);
                const snapshot = await get(opdRef);
                if (snapshot.exists()) {
                    const visits = Object.values(snapshot.val());
                    tokenCount = visits.filter((v: any) => v.visitDate === today).length + 1;
                }
            }

            const opdId = await generateOpdId(ownerId, labName);
            const rxId = await generateRxId(ownerId, labName);

            // 2. Create OPD Visit
            const visitData = {
                patientId: appointment.patientId || 'WALKIN', 
                patientName: appointment.patientName,
                patientAge: appointment.age,
                patientGender: appointment.gender,
                patientPhone: appointment.mobile,
                doctorId: appointment.doctorId || '',
                doctorName: appointment.doctorName || 'Consultant',
                complaints: appointment.notes || appointment.type || 'Online Booking',
                opdId,
                rxId,
                status: 'pending',
                visitDate: today,
                token: tokenCount,
                createdAt: new Date().toISOString(),
                source: 'online_portal'
            };

            const newVisitRef = await push(ref(database, `opd/${ownerId}`), visitData);
            const visitKey = newVisitRef.key;

            // 3. Update Patient Records if patientId exists
            if (appointment.patientId) {
                await update(ref(database, `patient_records/${ownerId}/${appointment.patientId}/visits/${visitKey}`), {
                    opdId,
                    rxId,
                    date: today,
                    token: tokenCount,
                    status: 'pending'
                });

                // Also update the specific appointment record in patient_records if it was indexed there
                // The portal book page does this: update(ref(database, `patient_records/${ownerId}/${storedPid}/appointments/${appointmentKey}`), ...)
                // We should sync the status there too.
                await update(ref(database, `patient_records/${ownerId}/${appointment.patientId}/appointments/${appointment.id}`), {
                    status: 'confirmed',
                    opdVisitId: visitKey,
                    date: today,
                    time: targetTime
                });
            }

            // 4. Update Main Appointment Status
            await update(ref(database, `appointments/${ownerId}/${appointment.id}`), {
                status: 'confirmed',
                opdVisitId: visitKey,
                date: today,
                time: targetTime,
                token: tokenCount,
                confirmedAt: new Date().toISOString()
            });

            setEditingId(null);

            showToast(`Appointment Confirmed! Token #${tokenCount} assigned.`, 'success');
        } catch (error: any) {
            console.error('Approval Error:', error);
            showToast('Failed to approve appointment', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteConfirmed = async (appointment: any) => {
        if (!window.confirm("Are you sure you want to void this confirmed appointment?")) return;
        setIsProcessing(true);
        try {
            // 1. Revert main appointment status
            await update(ref(database, `appointments/${ownerId}/${appointment.id}`), {
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                voidedReason: 'No-Show / Cancelled by Admin'
            });

            // 2. Revert status in patient_records if patientId exists
            if (appointment.patientId) {
                await update(ref(database, `patient_records/${ownerId}/${appointment.patientId}/appointments/${appointment.id}`), {
                    status: 'cancelled'
                });
            }

            // 3. Mark linked OPD visit as cancelled (if exists)
            if (appointment.opdVisitId) {
                await update(ref(database, `opd/${ownerId}/${appointment.opdVisitId}`), {
                    status: 'cancelled'
                });
            }

            showToast('Appointment Voided', 'info');
        } catch (error) {
            console.error('Void Error:', error);
            showToast('Failed to void appointment', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (appointmentId: string, patientId?: string) => {
        if (!window.confirm("Are you sure you want to reject this appointment?")) return;
        setIsProcessing(true);
        try {
            await update(ref(database, `appointments/${ownerId}/${appointmentId}`), {
                status: 'rejected',
                rejectedAt: new Date().toISOString()
            });

            if (patientId) {
                await update(ref(database, `patient_records/${ownerId}/${patientId}/appointments/${appointmentId}`), {
                    status: 'rejected'
                });
            }

            showToast('Appointment Rejected', 'info');
        } catch (error) {
            showToast('Failed to update status', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Online Appointment Management" maxWidth="max-w-6xl">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {loading ? (
                    <div className="py-20 text-center flex flex-col items-center gap-4">
                        <i className="fas fa-spinner fa-spin text-4xl text-blue-100"></i>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Searching Records...</p>
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 border-2 border-dashed border-gray-100">
                            <i className="fas fa-calendar-check text-2xl"></i>
                        </div>
                        <div className="flex flex-col items-center">
                            <p className="text-[11px] font-black text-gray-900 uppercase tracking-[0.2em]">Queue Clear</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">No pending online requests</p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3">Patient Detail</th>
                                    <th className="px-4 py-3">Slot (Date/Time)</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3">Dr / Dept</th>
                                    <th className="px-4 py-3">Notes</th>
                                    <th className="px-4 py-3 text-right">Clinical Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {appointments.map((app) => (
                                    <tr key={app.id} className="hover:bg-blue-50/20 transition-colors group">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black text-[10px]">
                                                    {app.patientName?.[0]}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-gray-900 uppercase tracking-tight leading-none mb-0.5">{app.patientName}</p>
                                                    <p className="text-[9px] font-bold text-blue-600">{app.mobile} <span className="text-gray-300 mx-1">|</span> {app.age}Y/{app.gender[0]}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {editingId === app.id ? (
                                                <div className="flex flex-col gap-1">
                                                    <input 
                                                        type="date" 
                                                        value={editFields.date} 
                                                        onChange={(e) => setEditFields({ ...editFields, date: e.target.value })}
                                                        className="text-[10px] font-bold border border-blue-200 rounded p-1"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Time (e.g. 10:30 AM)"
                                                        value={editFields.time} 
                                                        onChange={(e) => setEditFields({ ...editFields, time: e.target.value })}
                                                        className="text-[10px] font-bold border border-blue-200 rounded p-1"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-gray-800">{app.date}</span>
                                                    <span className="text-[9px] font-bold text-indigo-500 uppercase">{app.time}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${
                                                app.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-600'
                                            }`}>
                                                {app.status}
                                                {app.token && app.status === 'confirmed' && ` • Token #${app.token}`}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-gray-700 uppercase tracking-tighter">Dr. {app.doctorName?.split(' ')[0]}</span>
                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">{app.type || 'Consultation'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-[10px] text-gray-500 font-medium italic max-w-[150px] truncate" title={app.notes}>
                                                {app.notes || <span className="opacity-30">No special instructions</span>}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-2">
                                                {app.status === 'confirmed' ? (
                                                    <button 
                                                        disabled={isProcessing}
                                                        onClick={() => handleDeleteConfirmed(app)}
                                                        className="px-3 py-1.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5"
                                                    >
                                                        <i className="fas fa-trash"></i> Void / Cancel
                                                    </button>
                                                ) : editingId === app.id ? (
                                                    <>
                                                        <div className="flex flex-col items-end gap-1 mr-2 border-r border-gray-100 pr-2">
                                                            <span className="text-[7px] font-black text-gray-400 uppercase">Token #</span>
                                                            <input 
                                                                type="text" 
                                                                placeholder="Token"
                                                                value={editFields.token}
                                                                onChange={(e) => setEditFields({ ...editFields, token: e.target.value })}
                                                                className="w-12 text-[10px] font-black text-emerald-600 border border-emerald-200 rounded p-1 text-center"
                                                            />
                                                        </div>
                                                        <button 
                                                            disabled={isProcessing}
                                                            onClick={() => handleApprove(app)}
                                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm shadow-emerald-100 transition-all active:scale-95"
                                                        >
                                                            Update & Approve
                                                        </button>
                                                        <button 
                                                            onClick={() => setEditingId(null)}
                                                            className="px-3 py-1.5 bg-gray-100 font-black text-[9px] text-gray-500 rounded-lg uppercase tracking-widest"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button 
                                                            disabled={isProcessing}
                                                            onClick={() => {
                                                                setEditingId(app.id);
                                                                setEditFields({ date: app.date, time: app.time, token: '' });
                                                            }}
                                                            className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5"
                                                        >
                                                            <i className="fas fa-edit"></i> Edit
                                                        </button>
                                                        <button 
                                                            disabled={isProcessing}
                                                            onClick={() => handleApprove(app)}
                                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm shadow-emerald-100 transition-all active:scale-95 flex items-center gap-1.5"
                                                        >
                                                            <i className="fas fa-check"></i> Approve
                                                        </button>
                                                        <button 
                                                            disabled={isProcessing}
                                                            onClick={() => handleReject(app.id, app.patientId)}
                                                            className="px-3 py-1.5 bg-white border border-red-100 text-red-500 hover:bg-red-50 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95"
                                                        >
                                                            <i className="fas fa-times"></i>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            <div className="mt-8 flex justify-between items-center bg-gray-50 -mx-6 -mb-6 p-6 border-t border-gray-100">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">
                    <i className="fas fa-info-circle mr-1"></i> Approving creates an active OPD entry with a live token.
                </p>
                <button 
                    onClick={onClose}
                    className="px-8 py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200"
                >
                    Dismiss
                </button>
            </div>
        </Modal>
    );
}
