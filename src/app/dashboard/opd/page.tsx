'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ref, onValue, push, update, remove, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { formatIdFromDate } from '@/lib/idGenerator';
import Modal from '@/components/Modal';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const QuickReportModal = dynamic(() => import('@/components/QuickReportModal'), { ssr: false });
const QuickOPDModal = dynamic(() => import('@/components/QuickOPDModal'), { ssr: false });

import { suggestDiagnosis, checkDrugInteractions, suggestLifestyleAdvice, predictDosage } from '@/lib/groqAI';

export default function OPDPage() {
    const { user, userProfile } = useAuth();
    const { showToast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    // Data State
    const [visits, setVisits] = useState<any[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [currentPage, setCurrentPage] = useState(1);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [editVisit, setEditVisit] = useState<any>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
    const [selectedVisit, setSelectedVisit] = useState<any>(null);
    const itemsPerPage = 10;

    // AI Clinical State
    const [aiDiagnosis, setAiDiagnosis] = useState<any>(null);
    const [drugWarnings, setDrugWarnings] = useState<any>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // visitForm state removed as it is now handled by QuickOPDModal

    const [prescriptionForm, setPrescriptionForm] = useState({
        diagnosis: '',
        advice: '',
        medicines: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
        nextVisit: '',
        referredTests: [] as string[]
    });

    const ownerId = userProfile?.ownerId || user?.uid;

    useEffect(() => {
        const visitIdParam = searchParams.get('visitId');
        if (visitIdParam && visits.length > 0 && userProfile?.role === 'doctor') {
            const visit = visits.find(v => v.id === visitIdParam);
            if (visit && visit.status === 'pending') {
                setSelectedVisit(visit);
                setPrescriptionForm({
                    diagnosis: visit.prescription?.diagnosis || '',
                    medicines: visit.prescription?.medicines || [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
                    advice: visit.prescription?.advice || '',
                    nextVisit: visit.prescription?.nextVisit || '',
                    referredTests: visit.prescription?.referredTests || []
                });
                setShowPrescriptionModal(true);
            }
        }
    }, [searchParams, visits, userProfile?.role]);

    useEffect(() => {
        if (!ownerId) return;

        // Fetch Visits
        const visitsRef = ref(database, `opd/${ownerId}`);
        const unsubVisits = onValue(visitsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setVisits(data);
        });

        // Fetch Patients
        const patientsRef = ref(database, `patients/${ownerId}`);
        const unsubPatients = onValue(patientsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
            setPatients(data);
        });

        // Fetch Doctors
        const staffRef = ref(database, `users/${ownerId}/auth/staff`);
        const unsubStaff = onValue(staffRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                const val = child.val();
                if (val.role === 'doctor') {
                    data.push({ id: child.key, ...val });
                }
            });
            setDoctors(data);
        });

        // Fetch Reports
        const reportsRef = ref(database, `reports/${ownerId}`);
        const unsubReports = onValue(reportsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
            setReports(data);
        });

        // Fetch Templates for Referrals
        const templatesRef = ref(database, `templates/${ownerId}`);
        const commonRef = ref(database, 'common_templates');
        const unsubTemplates = onValue(templatesRef, (tsnap) => {
            onValue(commonRef, (csnap) => {
                const userT: any[] = [];
                tsnap.forEach(c => { userT.push({id: c.key, ...c.val()}); });
                const commonT: any[] = [];
                csnap.forEach(c => { commonT.push({id: c.key, ...c.val()}); });
                const combined = [...userT];
                commonT.forEach(ct => {
                    if (!combined.find(ut => ut.name.toLowerCase() === ct.name.toLowerCase())) {
                        combined.push(ct);
                    }
                });
                setTemplates(combined.sort((a,b) => a.name.localeCompare(b.name)));
            });
        });

        return () => {
            unsubVisits();
            unsubPatients();
            unsubStaff();
            unsubReports();
            unsubTemplates();
        };
    }, [ownerId]);

    // Filtering & Sorting
    const filteredVisits = useMemo(() => {
        const sorted = [...visits].sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            
            // 1. Prioritize Pending Emergencies (Only for the 'Pending' queue top)
            if (a.status === 'pending' && b.status === 'pending') {
                if (a.isEmergency && !b.isEmergency) return -1;
                if (!a.isEmergency && b.isEmergency) return 1;
            }

            // 2. Main Chronological Sort: Newest to Oldest
            return timeB - timeA;
        });

        return sorted.filter(v => {
            const matchesSearch = v.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 v.patientId?.toLowerCase().includes(searchQuery.toLowerCase());
            const visitDate = v.createdAt?.split('T')[0];
            const matchesDate = (!fromDate || visitDate >= fromDate) && (!toDate || visitDate <= toDate);
            return matchesSearch && matchesDate;
        });
    }, [visits, searchQuery, fromDate, toDate]);

    // Pagination
    const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);
    const paginatedVisits = filteredVisits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // handleRegisterVisit removed as it is now handled by QuickOPDModal

    // 1. AI Assistive Diagnosis Trigger
    useEffect(() => {
        if (!showPrescriptionModal || !selectedVisit || !prescriptionForm.diagnosis) return;

        const timer = setTimeout(async () => {
            setIsAiLoading(true);
            try {
                const res = await suggestDiagnosis(
                    prescriptionForm.diagnosis,
                    selectedVisit.vitals || {},
                    parseInt(selectedVisit.patientAge) || 30,
                    selectedVisit.patientGender || 'Male'
                );
                setAiDiagnosis(res);
            } catch (error) {
                console.error('AI Diagnosis Error:', error);
            } finally {
                setIsAiLoading(false);
            }
        }, 1500); // 1.5s debounce

        return () => clearTimeout(timer);
    }, [prescriptionForm.diagnosis, showPrescriptionModal, selectedVisit]);

    // 2. AI Drug Collision Trigger
    useEffect(() => {
        if (!showPrescriptionModal || prescriptionForm.medicines.length < 2) {
            setDrugWarnings(null);
            return;
        }

        const validMeds = prescriptionForm.medicines.filter(m => m.name && m.name.length > 2);
        if (validMeds.length < 2) return;

        const timer = setTimeout(async () => {
            try {
                const res = await checkDrugInteractions(validMeds);
                setDrugWarnings(res);
            } catch (error) {
                console.error('AI Drug Interaction Error:', error);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [prescriptionForm.medicines, showPrescriptionModal]);

    // 3. AI Lifestyle Advice Trigger
    useEffect(() => {
        if (!showPrescriptionModal || !prescriptionForm.diagnosis || prescriptionForm.diagnosis.length < 5) return;

        const timer = setTimeout(async () => {
            try {
                const res = await suggestLifestyleAdvice(prescriptionForm.diagnosis, selectedVisit?.complaints || '');
                // Pre-fill advice if empty
                if (!prescriptionForm.advice) {
                    setPrescriptionForm(prev => ({...prev, advice: res}));
                }
            } catch (error) {
                console.error('AI Advice Error:', error);
            }
        }, 3000); // 3s debounce

        return () => clearTimeout(timer);
    }, [prescriptionForm.diagnosis, showPrescriptionModal]);

    // 4. AI Dosage Prediction Handler
    const handleMedDosagePredict = async (idx: number, medName: string) => {
        if (!medName || medName.length < 3) return;
        try {
            const res = await predictDosage(medName, parseInt(selectedVisit?.patientAge) || 30);
            const newM = [...prescriptionForm.medicines];
            newM[idx] = { ...newM[idx], ...res };
            setPrescriptionForm({...prescriptionForm, medicines: newM});
            showToast(`Dosage predicted for ${medName}`, 'success');
        } catch (error) {
            console.error('AI Dosage Prediction Error:', error);
        }
    };

    const handleDeleteVisit = async (id: string) => {
        if (window.confirm("NOTICE: Are you sure you want to permanently delete this OPD visit record? This action cannot be undone.")) {
            try {
                await remove(ref(database, `opd/${ownerId}/${id}`));
                showToast('Visit Record Deleted', 'success');
            } catch (error) {
                showToast('Failed to delete visit', 'error');
            }
        }
    };

    const handleSavePrescription = async (e: React.FormEvent, status: 'completed' | 'referred' = 'completed') => {
        e.preventDefault();
        if (!selectedVisit || userProfile?.role !== 'doctor') {
            if (userProfile?.role !== 'doctor') showToast('Only Doctors can save prescriptions', 'error');
            return;
        }
        setIsSaving(true);

        try {
            await update(ref(database, `opd/${ownerId}/${selectedVisit.id}`), {
                prescription: {
                    ...prescriptionForm,
                    updatedAt: new Date().toISOString()
                },
                status: status, // This marks the visit as 'completed' or 'referred'
                updatedAt: new Date().toISOString()
            });
            showToast(status === 'completed' ? 'Prescription Saved! Visit Completed.' : 'Patient Referred & Rx on Hold', 'success');
            setShowPrescriptionModal(false);
            router.push('/dashboard/opd');
        } catch (error) {
            showToast('Failed to save prescription', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const addMedicine = () => {
        setPrescriptionForm({
            ...prescriptionForm,
            medicines: [...prescriptionForm.medicines, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
        });
    };

    const updateMedicine = (index: number, field: string, value: string) => {
        const newMedicines = [...prescriptionForm.medicines];
        newMedicines[index] = { ...newMedicines[index], [field]: value };
        setPrescriptionForm({ ...prescriptionForm, medicines: newMedicines });
    };

    const removeMedicine = (index: number) => {
        const newMedicines = prescriptionForm.medicines.filter((_, i) => i !== index);
        setPrescriptionForm({ ...prescriptionForm, medicines: newMedicines });
    };

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <i className="fas fa-stethoscope text-blue-600"></i>
                            OPD Management
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Manage patient tokens, vitals and doctor consultations</p>
                    </div>
                    <button 
                        onClick={() => setShowRegisterModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2 active:scale-95"
                    >
                        <i className="fas fa-plus"></i> New OPD Visit
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
                    <div className="relative">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input 
                            type="text" 
                            placeholder="Search Patient Name / ID..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                    <input 
                        type="date" 
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <input 
                        type="date" 
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                        <i className="fas fa-info-circle"></i>
                        {filteredVisits.length} Records Found
                    </div>
                </div>
            </div>

            {/* Visits Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Token / ID</th>
                                <th className="px-6 py-4">Patient Details</th>
                                <th className="px-6 py-4">Vitals Summary</th>
                                <th className="px-6 py-4">Assigned Doctor</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedVisits.map((visit) => (
                                <tr key={visit.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col">
                                                <span className={`text-xl font-black ${visit.isEmergency && visit.status === 'pending' ? 'text-red-600 animate-pulse' : 'text-blue-600'}`}>
                                                    #{visit.token}
                                                </span>
                                            </div>
                                            {visit.isEmergency && visit.status === 'pending' && (
                                                <div className="flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-full animate-bounce shadow-lg shadow-red-200">
                                                    <i className="fas fa-exclamation-triangle text-[10px]"></i>
                                                    <span className="text-[9px] font-bold tracking-widest leading-none">URGENT</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 truncate max-w-[200px]">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase whitespace-nowrap overflow-hidden text-ellipsis">
                                                {visit.patientName}
                                            </span>
                                            {visit.patientId && !visit.patientId.startsWith('-') && (
                                                <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded tracking-tighter shrink-0">
                                                    ({visit.patientId})
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {visit.vitals.bp && <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-bold border border-red-100">BP: {visit.vitals.bp}</span>}
                                            {visit.vitals.pulse && <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-bold border border-orange-100">P: {visit.vitals.pulse}</span>}
                                            {visit.vitals.spo2 && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold border border-blue-100">SpO2: {visit.vitals.spo2}%</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                {visit.doctorName?.[0] || 'D'}
                                            </div>
                                            <span className="text-sm font-medium text-gray-700">{visit.doctorName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                                            visit.status === 'pending' 
                                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200' 
                                            : 'bg-green-50 text-green-700 border-green-200'
                                        }`}>
                                            {visit.status === 'pending' ? 'WAITING' : 'CHECKED'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {userProfile?.role === 'doctor' && (
                                                <>
                                                    <button 
                                                        onClick={() => {
                                                            if (userProfile?.role !== 'doctor') return;
                                                            setSelectedVisit(visit);
                                                            if (visit.prescription) {
                                                                setPrescriptionForm({
                                                                    ...prescriptionForm,
                                                                    ...visit.prescription,
                                                                    medicines: visit.prescription.medicines || [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
                                                                    referredTests: visit.prescription.referredTests || []
                                                                });
                                                            } else {
                                                                setPrescriptionForm({
                                                                    diagnosis: '',
                                                                    advice: '',
                                                                    medicines: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
                                                                    nextVisit: '',
                                                                    referredTests: []
                                                                });
                                                            }
                                                            setShowPrescriptionModal(true);
                                                        }}
                                                        className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors scale-90" title="Consultation"
                                                    >
                                                        <i className="fas fa-file-signature"></i>
                                                    </button>
                                                    <button 
                                                        disabled={visit.status !== 'completed'}
                                                        onClick={() => window.open(`/print/opd/${visit.id}`, '_blank')}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-20 scale-90" title="Print"
                                                    >
                                                        <i className="fas fa-print"></i>
                                                    </button>
                                                </>
                                            )}
                                            
                                            {/* Administrative Actions - Edit/Delete */}
                                            {userProfile?.role !== 'doctor' && visit.status === 'pending' && (
                                                <button 
                                                    onClick={() => {
                                                        setEditVisit(visit);
                                                        setShowEditModal(true);
                                                    }}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors scale-90" title="Edit Patient Details"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                            )}
                                            
                                            <button 
                                                onClick={() => handleDeleteVisit(visit.id)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors scale-90" title="Delete Entry"
                                            >
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border rounded-lg text-sm font-bold bg-white hover:bg-gray-100 disabled:opacity-50">Prev</button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border rounded-lg text-sm font-bold bg-white hover:bg-gray-100 disabled:opacity-50">Next</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Standardized Quick OPD Modal Integration */}
            <QuickOPDModal 
                isOpen={showRegisterModal} 
                onClose={() => setShowRegisterModal(false)} 
                ownerId={ownerId} 
            />

            <QuickOPDModal 
                isOpen={showEditModal} 
                onClose={() => {
                    setShowEditModal(false);
                    setEditVisit(null);
                }} 
                ownerId={ownerId} 
                editData={editVisit}
            />

            {/* Prescription Modal */}
            <Modal isOpen={showPrescriptionModal} onClose={() => { setShowPrescriptionModal(false); router.push('/dashboard/opd'); }} title="Medical Consultation & Prescription">
                <div className="flex flex-col lg:flex-row gap-6 max-h-[85vh] overflow-hidden">
                    {/* Left: Consultation Form */}
                    <form onSubmit={(e) => handleSavePrescription(e)} className="flex-[2] space-y-6 overflow-y-auto pr-4 custom-scrollbar">
                        {selectedVisit && (
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-6 flex justify-between items-center relative overflow-hidden group">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h4 className="font-extrabold text-blue-900 text-lg">{selectedVisit.patientName}</h4>
                                        <span className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-full shadow-sm">TOKEN #{selectedVisit.token}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-4">
                                        {Object.entries(selectedVisit.vitals || {}).map(([k, v]) => (
                                            v ? <div key={k} className="bg-white/60 px-2 py-1 rounded-lg border border-blue-100 shadow-sm"><span className="text-[9px] text-blue-400 font-bold uppercase tracking-tighter">{k}:</span> <span className="text-xs font-black text-blue-700">{v as string}</span></div> : null
                                        ))}
                                    </div>
                                </div>
                                <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-blue-100/50 to-transparent flex items-center justify-center pointer-events-none">
                                    <i className="fas fa-stethoscope text-4xl text-blue-200/50 rotate-12 group-hover:scale-110 transition-transform"></i>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Provisional Diagnosis / Chief Complaints</label>
                            <textarea 
                                value={prescriptionForm.diagnosis}
                                onChange={(e) => setPrescriptionForm({...prescriptionForm, diagnosis: e.target.value})}
                                required
                                className="w-full p-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Enter diagnosis and complaints..."
                                rows={3}
                            ></textarea>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-gray-700">Medicines & Instructions</label>
                                <button type="button" onClick={() => setPrescriptionForm({...prescriptionForm, medicines: [...prescriptionForm.medicines, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]})} className="text-xs font-bold text-blue-600 hover:underline">+ Add Medicine</button>
                            </div>
                            <div className="space-y-3">
                                {prescriptionForm.medicines.map((med: any, idx: number) => (
                                    <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 relative group">
                                        <button type="button" onClick={() => {
                                            const newM = [...prescriptionForm.medicines];
                                            newM.splice(idx, 1);
                                            setPrescriptionForm({...prescriptionForm, medicines: newM});
                                        }} className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-times text-[10px]"></i></button>
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <input 
                                                type="text" placeholder="Medicine Name" 
                                                value={med.name}
                                                onChange={e => {
                                                    const newM = [...prescriptionForm.medicines];
                                                    newM[idx].name = e.target.value;
                                                    setPrescriptionForm({...prescriptionForm, medicines: newM});
                                                }}
                                                onBlur={(e) => handleMedDosagePredict(idx, e.target.value)}
                                                className="p-2 text-sm border rounded-lg bg-white outline-none focus:ring-1 focus:ring-blue-400"
                                            />
                                            <div className="relative">
                                                <input 
                                                    type="text" placeholder="Dosage (e.g. 500mg)" 
                                                    value={med.dosage}
                                                    onChange={e => {
                                                        const newM = [...prescriptionForm.medicines];
                                                        newM[idx].dosage = e.target.value;
                                                        setPrescriptionForm({...prescriptionForm, medicines: newM});
                                                    }}
                                                    className="p-2 text-sm border rounded-lg bg-white w-full pr-8"
                                                />
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    <i className="fas fa-magic text-[10px] text-blue-400 animate-pulse" title="AI Predicted"></i>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input type="text" placeholder="Freq (1-0-1)" value={med.frequency} onChange={e => {
                                                const newM = [...prescriptionForm.medicines];
                                                newM[idx].frequency = e.target.value;
                                                setPrescriptionForm({...prescriptionForm, medicines: newM});
                                            }} className="p-2 text-[11px] border rounded bg-white" />
                                            <input type="text" placeholder="Dur (5 days)" value={med.duration} onChange={e => {
                                                const newM = [...prescriptionForm.medicines];
                                                newM[idx].duration = e.target.value;
                                                setPrescriptionForm({...prescriptionForm, medicines: newM});
                                            }} className="p-2 text-[11px] border rounded bg-white" />
                                            <input type="text" placeholder="Inst (After Food)" value={med.instructions} onChange={e => {
                                                const newM = [...prescriptionForm.medicines];
                                                newM[idx].instructions = e.target.value;
                                                setPrescriptionForm({...prescriptionForm, medicines: newM});
                                            }} className="p-2 text-[11px] border rounded bg-white" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Lab Referral Engine */}
                        <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100 mt-6">
                            <h5 className="flex items-center gap-2 text-sm font-black text-orange-700 uppercase tracking-widest mb-4">
                                <i className="fas fa-vial"></i> Refer to Laboratory
                            </h5>
                            <div className="space-y-3">
                                {aiDiagnosis?.recommendedTests?.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3 px-1">
                                        <p className="w-full text-[10px] font-bold text-orange-400 uppercase tracking-tighter mb-1">AI Recommended Tests:</p>
                                        {aiDiagnosis.recommendedTests.map((test: string, i: number) => (
                                            <button 
                                                key={i} 
                                                type="button" 
                                                onClick={() => {
                                                    if (!prescriptionForm.referredTests.includes(test)) {
                                                        setPrescriptionForm({...prescriptionForm, referredTests: [...prescriptionForm.referredTests, test]});
                                                    }
                                                }}
                                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${prescriptionForm.referredTests.includes(test) ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'}`}
                                            >
                                                + {test}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <div className="relative">
                                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                                    <input 
                                        type="text"
                                        placeholder="Add lab tests (e.g. CBC, Sugar)..."
                                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-500 transition-all font-bold"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = (e.target as HTMLInputElement).value.trim();
                                                if (val && !prescriptionForm.referredTests.includes(val)) {
                                                    setPrescriptionForm({...prescriptionForm, referredTests: [...prescriptionForm.referredTests, val]});
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }
                                        }}
                                    />
                                    <datalist id="rx-templates-list">
                                        {templates.map(t => <option key={t.id} value={t.name} />)}
                                    </datalist>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {prescriptionForm.referredTests.map((test: string, idx: number) => (
                                        <span key={idx} className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-2 shadow-sm border border-orange-200">
                                            {test}
                                            <button type="button" onClick={() => setPrescriptionForm({...prescriptionForm, referredTests: prescriptionForm.referredTests.filter((_,i) => i !== idx)})} className="hover:text-red-600">
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </span>
                                    ))}
                                    {prescriptionForm.referredTests.length === 0 && <p className="text-[10px] text-gray-400 italic">No tests referred.</p>}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Advice & Lifestyle Modifications</label>
                            <textarea 
                                value={prescriptionForm.advice}
                                onChange={(e) => setPrescriptionForm({...prescriptionForm, advice: e.target.value})}
                                className="w-full p-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Rest, diet plan, etc..."
                                rows={2}
                            ></textarea>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Next Visit Recommendation</label>
                                <input 
                                    type="date"
                                    value={prescriptionForm.nextVisit}
                                    onChange={(e) => setPrescriptionForm({...prescriptionForm, nextVisit: e.target.value})}
                                    className="w-full p-3 border rounded-xl bg-gray-50 text-[11px] font-black uppercase"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                            <button 
                                type="button"
                                onClick={() => setShowPrescriptionModal(false)}
                                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Cancel
                            </button>
                            
                            {prescriptionForm.referredTests.length > 0 && (
                                <button 
                                    type="button"
                                    onClick={(e) => handleSavePrescription(e, 'referred')}
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                >
                                    <i className="fas fa-flask"></i>
                                    {isSaving ? 'Saving...' : 'Refer & Hold Rx'}
                                </button>
                            )}

                            <button 
                                type="submit"
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-100 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            >
                                <i className="fas fa-check-double"></i>
                                {isSaving ? 'Saving...' : 'Save & Complete Rx'}
                            </button>
                        </div>
                    </form>

                    {/* Right: AI Clinical Assistant & History (DOCTOR ONLY) */}
                    {userProfile?.role === 'doctor' && (
                        <div className="hidden lg:flex flex-1 flex-col gap-6 w-96 border-l pl-6 overflow-y-auto pr-2 custom-scrollbar">
                        {/* 1. AI Clinical Intelligence */}
                        <div className="bg-gradient-to-br from-gray-900 to-indigo-950 rounded-2xl p-5 text-white shadow-2xl relative overflow-hidden ring-1 ring-white/10 shrink-0">
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                                            <i className={`fas fa-brain ${isAiLoading ? 'animate-pulse text-blue-400' : 'text-blue-300'}`}></i>
                                        </div>
                                        <h3 className="text-sm font-black tracking-widest uppercase">Clinical AI Intelligence</h3>
                                    </div>
                                    <span className="text-[8px] font-black bg-blue-500/30 px-2 py-0.5 rounded border border-blue-500/30 text-blue-300">DOCTOR ONLY</span>
                                </div>

                                {/* Drug Warnings (Collisions) */}
                                {drugWarnings && drugWarnings.hasInteractions && (
                                    <div className="mb-4 animate-in zoom-in-95 duration-300">
                                        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3">
                                            <div className="flex items-center gap-2 text-red-400 mb-2">
                                                <i className="fas fa-exclamation-triangle animate-bounce text-xs"></i>
                                                <span className="text-[10px] font-black uppercase tracking-wider">Drug Collision Alert</span>
                                            </div>
                                            {drugWarnings.warnings.map((w: string, i: number) => (
                                                <p key={i} className="text-[11px] text-red-100/90 leading-relaxed mb-1">• {w}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Diagnosis Assistant */}
                                {aiDiagnosis ? (
                                    <div className="space-y-4 animate-in fade-in duration-500">
                                        <div>
                                            <p className="text-[9px] font-bold text-blue-300/60 uppercase tracking-widest mb-2">Assistive Differential Diagnosis</p>
                                            <div className="space-y-2">
                                                {aiDiagnosis.possibleDiagnoses?.map((d: any, i: number) => (
                                                    <div key={i} className="bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-all group">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">{d.name}</span>
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${d.probability === 'high' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                                {d.probability.toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <p className="text-[9px] text-gray-400 leading-tight italic">{d.reasoning}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-[9px] font-bold text-blue-300/60 uppercase tracking-widest mb-2">Recommended Clinical Exams</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {aiDiagnosis.recommendedTests?.map((t: string, i: number) => (
                                                    <span key={i} className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-lg border border-indigo-500/20 font-black">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                                        <i className="fas fa-stethoscope text-2xl text-white/10 mb-2"></i>
                                        <p className="text-[10px] text-gray-400 italic">Type diagnosis for AI assistance...</p>
                                    </div>
                                )}
                            </div>
                            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full"></div>
                        </div>

                        {/* 2. Patient History Timeline */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex items-center gap-2 mb-4 px-1">
                                <i className="fas fa-history text-gray-400 text-xs"></i>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Patient Intelligence Timeline</h3>
                            </div>
                            <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                                {/* Last 5 Prescriptions */}
                                {visits
                                    .filter(v => v.patientId === selectedVisit?.patientId && v.id !== selectedVisit?.id && v.status === 'completed')
                                    .sort((a,b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                                    .slice(0, 5)
                                    .map(v => (
                                        <div key={v.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 transition-all group shadow-sm">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{new Date(v.visitDate).toLocaleDateString()}</span>
                                                <i className="fas fa-prescription text-[9px] text-gray-300 group-hover:text-blue-400 transition-colors"></i>
                                            </div>
                                            <p className="text-[11px] font-black text-gray-800 line-clamp-1">{v.prescription?.diagnosis || 'Follow up'}</p>
                                            <p className="text-[9px] text-gray-400 italic truncate mt-1">
                                                {v.prescription?.medicines?.map((m:any) => m.name).join(', ')}
                                            </p>
                                        </div>
                                    ))
                                }

                                {/* Last 5 Reports */}
                                {reports
                                    .filter(r => r.patientId === selectedVisit?.patientId)
                                    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .slice(0, 5)
                                    .map(r => (
                                        <div key={r.id} onClick={() => window.open(`/print/report/${r.id}`, '_blank')} className="p-4 bg-indigo-50/20 rounded-2xl border border-indigo-50 hover:border-indigo-200 cursor-pointer transition-all shadow-sm group">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[9px] font-bold text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                                                <i className="fas fa-flask text-[9px] text-indigo-300 group-hover:text-indigo-500"></i>
                                            </div>
                                            <p className="text-[11px] font-black text-indigo-900 truncate">{r.testName || 'Laboratory Test'}</p>
                                            <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 mt-2 inline-block rounded-full ${r.threatLevel === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                {r.threatLevel || 'Normal'}
                                            </span>
                                        </div>
                                    ))
                                }

                                {visits.filter(v => v.patientId === selectedVisit?.patientId && v.status === 'completed').length === 0 && 
                                 reports.filter(r => r.patientId === selectedVisit?.patientId).length === 0 && (
                                    <div className="py-12 text-center text-gray-300 italic text-[10px]">
                                        No previous medical history found.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    </div>
);
}
