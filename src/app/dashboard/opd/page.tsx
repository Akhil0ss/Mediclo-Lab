'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmDialogContext';
import { ref, onValue, push, update, remove, get, query, orderByChild, equalTo, limitToLast } from 'firebase/database';
import { database } from '@/lib/firebase';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { formatIdFromDate, generateRxId } from '@/lib/idGenerator';
import { getArrivedReportsForVisit } from '@/lib/clinicLogic';
import QuickSampleModal from '@/components/QuickSampleModal';
import Modal from '@/components/Modal';
import SkeletonTable from '@/components/SkeletonTable';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const QuickReportModal = dynamic(() => import('@/components/QuickReportModal'), { ssr: false });
const QuickOPDModal = dynamic(() => import('@/components/QuickOPDModal'), { ssr: false });

import { suggestDiagnosis, checkDrugInteractions, suggestLifestyleAdvice } from '@/lib/groqAI';

export default function OPDPage() {
    const { user, userProfile } = useAuth();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const searchParams = useSearchParams();
    const router = useRouter();
    // Data State
    const [visits, setVisits] = useState<any[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [allRecentReports, setAllRecentReports] = useState<any[]>([]);
    const [allRecentSamples, setAllRecentSamples] = useState<any[]>([]); // For flow status resolution
    const [showQuickSampleModal, setShowQuickSampleModal] = useState(false);
    const [selectedVisitForLab, setSelectedVisitForLab] = useState<any>(null);
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [currentPage, setCurrentPage] = useState(1);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [editVisit, setEditVisit] = useState<any>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
    const [selectedVisit, setSelectedVisit] = useState<any>(null);
    const itemsPerPage = 20;

    // AI Clinical State
    const [aiDiagnosis, setAiDiagnosis] = useState<any>(null);
    const [drugWarnings, setDrugWarnings] = useState<any>(null);
    const [patientHistory, setPatientHistory] = useState<any[]>([]);
    const [prescTemplates, setPrescTemplates] = useState<any[]>([]);
    const [templateName, setTemplateName] = useState('');
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
        const visitsRef = query(ref(database, `opd/${ownerId}`), orderByChild('createdAt'), limitToLast(200));
        const unsubVisits = onValue(visitsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setVisits(data);
            setLoading(false);
        });

        // Fetch Patients (Performance Optimized: Last 500 only)
        const unsubP = onValue(query(ref(database, `patients/${ownerId}`), orderByChild('createdAt'), limitToLast(500)), (snap) => {
            const data: any[] = [];
            snap.forEach((child) => {
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

        // Fetch Reports for diagnostic correlation
        const reportsRef = query(ref(database, `reports/${ownerId}`), limitToLast(50));
        const unsubReports = onValue(reportsRef, (snap) => {
            const list: any[] = [];
            snap.forEach(c => { list.push({ id: c.key, ...c.val() }); });
            setAllRecentReports(list.reverse());
        });

        // Fetch Samples for flow status
        const samplesRef = query(ref(database, `samples/${ownerId}`), limitToLast(100));
        const unsubSamples = onValue(samplesRef, (snap) => {
            const list: any[] = [];
            snap.forEach(c => { list.push({ id: c.key, ...c.val() }); });
            setAllRecentSamples(list);
        });

        // Fetch Templates for Referrals (using get() to avoid nested listener leak)
        const templatesRef = ref(database, `templates/${ownerId}`);
        const commonRef = ref(database, 'common_templates');
        const fetchTemplates = async () => {
            try {
                const [tsnap, csnap] = await Promise.all([get(templatesRef), get(commonRef)]);
                const userT: any[] = [];
                if (tsnap.exists()) tsnap.forEach(c => { userT.push({id: c.key, ...c.val()}); });
                const commonT: any[] = [];
                if (csnap.exists()) csnap.forEach(c => { commonT.push({id: c.key, ...c.val()}); });
                const combined = [...userT];
                commonT.forEach(ct => {
                    if (!combined.find(ut => ut.name.toLowerCase() === ct.name.toLowerCase())) {
                        combined.push(ct);
                    }
                });
                setTemplates(combined.sort((a,b) => a.name.localeCompare(b.name)));
            } catch (err) {
                console.error('Failed to fetch templates:', err);
            }
        };
        // Listen for template changes but fetch common_templates via get() (no nesting)
        const unsubTemplates = onValue(templatesRef, () => { fetchTemplates(); });

        return () => {
            unsubVisits();
            unsubP();
            unsubStaff();
            unsubReports();
            unsubSamples();
            unsubTemplates();
        };
    }, [ownerId]);

    // Fetch Patient History when a visit is selected
    useEffect(() => {
        if (!selectedVisit || !ownerId) return;

        const historyRef = query(ref(database, `opd/${ownerId}`), orderByChild('patientId'), equalTo(selectedVisit.patientId));
        get(historyRef).then(snap => {
            if (snap.exists()) {
                const data: any[] = [];
                snap.forEach(c => {
                    const v = c.val();
                    if (c.key !== selectedVisit.id && v.status === 'completed') {
                        data.push({ id: c.key, ...v });
                    }
                });
                setPatientHistory(data.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5));
            }
        });
    }, [selectedVisit, ownerId]);

    // Fetch Prescription Templates
    useEffect(() => {
        if (!ownerId || !user?.uid) return;
        const ptRef = ref(database, `prescription_templates/${ownerId}/${user.uid}`);
        onValue(ptRef, (snap) => {
            const data: any[] = [];
            snap.forEach(c => { data.push({ id: c.key, ...c.val() }); });
            setPrescTemplates(data);
        });
    }, [ownerId, user]);

    // Filtering & Sorting
    const filteredVisits = useMemo(() => {
        // Only show Completed or Referred visits in the archive
        const archiveVisits = visits.filter(v => v.status === 'completed' || v.status === 'referred');

        const sorted = [...archiveVisits].sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
        });

        return sorted.filter(v => {
            const matchesSearch = v.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 v.patientId?.toLowerCase().includes(searchQuery.toLowerCase());
            const visitDate = v.createdAt?.split('T')[0];
            const matchesDate = (!fromDate || visitDate >= fromDate) && (!toDate || visitDate <= toDate);
            const matchesDoctor = !selectedDoctorId || v.doctorId === selectedDoctorId;
            return matchesSearch && matchesDate && matchesDoctor;
        });
    }, [visits, searchQuery, fromDate, toDate, selectedDoctorId]);

    // Pagination
    const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);
    const paginatedVisits = filteredVisits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

    const handleMedDosagePredict = async (idx: number, medName: string) => {
        // AI Dosage Prediction feature currently disabled
        showToast(`AI dosage help for ${medName} is temporarily unavailable`, 'info');
    };

    const handleSaveTemplate = async () => {
        if (!templateName || prescriptionForm.medicines.length === 0 || !prescriptionForm.medicines[0].name) {
            showToast('Enter template name and at least one medicine', 'warning');
            return;
        }
        try {
            await push(ref(database, `prescription_templates/${ownerId}/${user.uid}`), {
                name: templateName,
                ...prescriptionForm,
                createdAt: new Date().toISOString()
            });
            showToast('Prescription Template Saved!', 'success');
            setTemplateName('');
        } catch (e) {
            showToast('Failed to save template', 'error');
        }
    };

    const handleLoadTemplate = (temp: any) => {
        setPrescriptionForm({
            ...prescriptionForm,
            diagnosis: temp.diagnosis || prescriptionForm.diagnosis,
            medicines: temp.medicines || [],
            advice: temp.advice || prescriptionForm.advice
        });
        showToast(`Applied template: ${temp.name}`, 'success');
    };

    const handleDeleteVisit = async (id: string) => {
        if (await confirm("NOTICE: Are you sure you want to permanently delete this OPD visit record? This action cannot be undone.")) {
            try {
                await remove(ref(database, `opd/${ownerId}/${id}`));
                logAudit(ownerId, AUDIT_ACTIONS.OPD_VISIT_CREATED, `Deleted OPD visit record ${id}`, userProfile?.name || user?.uid || 'Unknown');
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
            let rxId = selectedVisit.prescription?.rxId;
            if (!rxId) {
                rxId = await generateRxId(ownerId, userProfile?.labName || 'CLINIC');
            }

            await update(ref(database, `opd/${ownerId}/${selectedVisit.id}`), {
                prescription: {
                    ...prescriptionForm,
                    rxId,
                    updatedAt: new Date().toISOString()
                },
                status: status, // This marks the visit as 'completed' or 'referred'
                updatedAt: new Date().toISOString()
            });
            showToast(status === 'completed' ? `Prescription Saved (${rxId})! Visit Completed.` : `Patient Referred (${rxId}) & Rx on Hold`, 'success');
            logAudit(ownerId, AUDIT_ACTIONS.RX_CREATED, `Prescription ${rxId} saved for visit ${selectedVisit.id} (${status})`, userProfile?.name || user?.uid || 'Unknown');
            setShowPrescriptionModal(false);
            router.push('/dashboard/opd');
        } catch (error) {
            showToast('Failed to save prescription', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Ultra-Compact Unified Header & Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 sticky top-0 z-20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Inline Title & Action */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 rounded-lg text-blue-600 border border-blue-100/50">
                            <i className="fas fa-stethoscope text-[10px]"></i>
                            <h2 className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                OPD RECORDS
                            </h2>
                        </div>
                    </div>

                    {/* Inline Filter Battery */}
                    <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
                        <div className="relative shrink-0">
                            <i className="fas fa-user-md absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[9px]"></i>
                            <select 
                                value={selectedDoctorId}
                                onChange={(e) => setSelectedDoctorId(e.target.value)}
                                className="pl-7 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-black outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                            >
                                <option value="">ALL DOCTORS</option>
                                {doctors.map(dr => (
                                    <option key={dr.id} value={dr.id}>DR. {dr.name.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative flex-1 max-w-[180px]">
                            <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[9px]"></i>
                            <input 
                                type="text" 
                                placeholder="SEARCH PATIENT..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-7 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-black outline-none focus:ring-1 focus:ring-blue-500 shadow-inner uppercase"
                            />
                        </div>
                        
                        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 shadow-inner">
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] font-black text-gray-400">FROM</span>
                                <input 
                                    type="date" 
                                    value={fromDate}
                                    onChange={e => setFromDate(e.target.value)}
                                    className="bg-transparent text-[10px] font-black text-gray-700 outline-none w-[90px]"
                                />
                            </div>
                            <div className="w-[1px] h-3 bg-gray-300"></div>
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] font-black text-gray-400">TO</span>
                                <input 
                                    type="date" 
                                    value={toDate}
                                    onChange={e => setToDate(e.target.value)}
                                    className="bg-transparent text-[10px] font-black text-gray-700 outline-none w-[90px]"
                                />
                            </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black shadow-md shadow-blue-100">
                            {filteredVisits.length} RECS
                        </div>
                    </div>
                </div>
            </div>

            {/* Visits Table */}
            {loading ? <SkeletonTable rows={10} columns={7} /> : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[9px] uppercase tracking-widest font-black text-gray-400 border-b border-gray-100">
                            <tr>
                                <th className="px-3 py-2">Token / ID</th>
                                <th className="px-3 py-2">Patient Profile</th>
                                <th className="px-3 py-2">Clinical Evidence</th>
                                <th className="px-3 py-2">Physician</th>
                                <th className="px-3 py-2 text-center">Pharmacy</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginatedVisits.map((visit) => {
                                const arrivedReports = getArrivedReportsForVisit(visit, allRecentReports);
                                const hasReports = arrivedReports.length > 0;

                                return (
                                <tr key={visit.id} className="hover:bg-indigo-50/20 transition-colors group">
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black text-blue-600">#{visit.token}</span>
                                            {hasReports && (visit.status === 'referred' || visit.status === 'pending') && (
                                                <span className="bg-emerald-500 text-white px-1 py-0.5 rounded-full text-[6px] font-black animate-bounce shadow-sm flex items-center gap-0.5">
                                                    REPORT <i className="fas fa-check text-[5px]"></i>
                                                </span>
                                            )}
                                            <span className="text-gray-300">|</span>
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter" title={visit.opdId || visit.id}>
                                                {visit.opdId || visit.id}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-1.5 truncate max-w-[150px]">
                                        <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors uppercase whitespace-nowrap overflow-hidden text-ellipsis text-[11px]">
                                                {visit.patientName}
                                            </span>
                                            <span className="text-[8px] font-black text-gray-400 bg-gray-50 px-1 py-0.5 rounded tracking-tighter shrink-0 uppercase">
                                                {visit.patientAge}{visit.patientGender?.[0]}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <p className="text-[10px] text-gray-500 italic line-clamp-1 max-w-[180px]" title={visit.complaints || 'No specific complaints'}>
                                            {visit.complaints || 'Routine Checkup'}
                                        </p>
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
                                            <i className="fas fa-user-md text-indigo-400 text-[9px]"></i>
                                            <span className="truncate max-w-[80px]">DR. {visit.doctorName?.split(' ')[0]}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-center">
                                        {visit.prescription ? (
                                            <div className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase inline-flex items-center gap-1 ${
                                                visit.pharmacyStatus === 'dispensed' 
                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                                                : 'bg-orange-100 text-orange-700 border border-orange-200 animate-pulse'
                                            }`}>
                                                <i className={`fas ${visit.pharmacyStatus === 'dispensed' ? 'fa-check-double' : 'fa-mortar-pestle'} text-[7px]`}></i>
                                                {visit.pharmacyStatus === 'dispensed' ? 'Dispensed' : 'Pending'}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-gray-300 font-bold">-</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-1.5">
                                        {(() => {
                                            // Flow Status Resolver
                                            const getFlowStatus = (v: any) => {
                                                if (v.status === 'completed') return { label: 'CONSULTED', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: 'fas fa-check-double' };
                                                const reportFound = allRecentReports.some(r => r.visitId === v.id);
                                                if (reportFound) return { label: 'RESULT READY', color: 'bg-emerald-500 text-white border-emerald-500', icon: 'fas fa-file-medical-alt', bounce: true };
                                                const sampleFound = allRecentSamples.some(s => s.visitId === v.id);
                                                if (sampleFound) return { label: 'SAMPLE COLLECTED', color: 'bg-sky-500 text-white border-sky-500', icon: 'fas fa-vial' };
                                                if (v.status === 'referred') return { label: 'SENT TO LAB', color: 'bg-orange-600 text-white border-orange-500', icon: 'fas fa-flask' };
                                                return { label: (v.status || 'pending').toUpperCase(), color: 'bg-amber-50 text-amber-600 border-amber-100', icon: 'fas fa-user-clock' };
                                            };

                                            const f = getFlowStatus(visit);
                                            
                                            // If Sent to Lab and no sample collected yet, show actionable button
                                            if (visit.status === 'referred' && f.label === 'SENT TO LAB') {
                                                return (
                                                    <button 
                                                        onClick={() => { setSelectedVisitForLab(visit); setShowQuickSampleModal(true); }}
                                                        className={`px-2 py-0.5 rounded-full text-[8px] font-black border uppercase tracking-widest ${f.color} shadow-sm hover:scale-105 transition-all active:scale-95 flex items-center gap-1 group/btn`}
                                                        title="Click to Collect Sample"
                                                    >
                                                        <i className={`${f.icon} text-[7px] group-hover/btn:animate-pulse`}></i>
                                                        {f.label}
                                                    </button>
                                                );
                                            }

                                            return (
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border uppercase tracking-widest flex items-center gap-1 w-fit ${f.color} ${f.bounce ? 'animate-bounce' : ''}`}>
                                                    <i className={`${f.icon} text-[7px]`}></i>
                                                    {f.label}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-3 py-1.5 text-right">
                                        <div className="flex justify-end gap-1.5">
                                            <button 
                                                onClick={() => {
                                                    setSelectedVisit(visit);
                                                    if (visit.prescription) {
                                                        setPrescriptionForm({
                                                            ...prescriptionForm,
                                                            ...visit.prescription,
                                                            medicines: visit.prescription.medicines || [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
                                                            referredTests: visit.prescription.referredTests || []
                                                        });
                                                    }
                                                    setShowPrescriptionModal(true);
                                                }}
                                                className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors" title="View Patient Details"
                                            >
                                                <i className="fas fa-eye text-[10px]"></i>
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    try { localStorage.setItem(`print_cache_opd_${visit.id}`, JSON.stringify(visit)); } catch(e) {}
                                                    window.open(`/print/opd/${visit.id}`, '_blank');
                                                }}
                                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-50" title="Print Prescription"
                                            >
                                                <i className="fas fa-print text-[10px]"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                )})}
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
            )}

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

            {/* Quick Sample Modal Integration */}
            {showQuickSampleModal && (
                <QuickSampleModal
                    isOpen={showQuickSampleModal}
                    onClose={() => {
                        setShowQuickSampleModal(false);
                        setSelectedVisitForLab(null);
                    }}
                    ownerId={ownerId}
                    initialVisit={selectedVisitForLab}
                />
            )}

            {/* Prescription Modal */}
            <Modal 
                isOpen={showPrescriptionModal} 
                onClose={() => { setShowPrescriptionModal(false); router.push('/dashboard/opd'); }} 
                title={(selectedVisit?.status === 'completed' || selectedVisit?.status === 'referred') ? "Prescription Verification Record" : "Medical Consultation & Prescription"}
            >
                <div className="flex flex-col lg:flex-row gap-6 max-h-[85vh] overflow-hidden">
                    {(selectedVisit?.status === 'completed' || selectedVisit?.status === 'referred') ? (
                        <div className="w-full space-y-6 overflow-y-auto pr-4 custom-scrollbar pb-6 bg-white p-2 flex-1">
                            {/* Header / Patient info */}
                            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-sm">
                                <i className="fas fa-file-prescription absolute -right-6 -bottom-6 text-9xl text-indigo-500/10 rotate-12"></i>
                                <div className="relative z-10 w-full md:w-auto">
                                    <h4 className="text-2xl font-black text-indigo-950 uppercase tracking-tighter mb-1">{selectedVisit?.patientName}</h4>
                                    <div className="flex items-center gap-3 opacity-90 flex-wrap">
                                        <span className="text-[11px] font-black text-indigo-700 bg-indigo-100 px-3 py-1 rounded-md uppercase border border-indigo-200">{selectedVisit?.patientAge}Y / {selectedVisit?.patientGender}</span>
                                        <span className="text-[11px] font-black text-indigo-700 bg-indigo-100 px-3 py-1 rounded-md uppercase tracking-widest border border-indigo-200">TK #{selectedVisit?.token}</span>
                                        <span className="text-[11px] font-black text-indigo-700 bg-indigo-100 px-3 py-1 rounded-md uppercase tracking-widest border border-indigo-200">{selectedVisit?.createdAt ? new Date(selectedVisit.createdAt).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="relative z-10 text-left md:text-right w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-indigo-200/50">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Consulting Physician</span>
                                    <span className="text-base font-black text-indigo-900 uppercase">Dr. {selectedVisit?.doctorName || 'Not Assigned'}</span>
                                </div>
                            </div>

                            {/* Vitals Grid */}
                            {selectedVisit?.vitals && Object.keys(selectedVisit.vitals).length > 0 && Object.values(selectedVisit.vitals).some(v => v) && (
                                <div className="px-2">
                                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="fas fa-heartbeat text-rose-400"></i> Clinical Vitals</h5>
                                    <div className="flex flex-wrap gap-3">
                                        {Object.entries(selectedVisit.vitals).map(([k, v]) => v ? (
                                            <div key={k} className="bg-gray-50 border border-gray-200 px-5 py-2.5 rounded-2xl flex items-center gap-3 shadow-sm hover:border-gray-300 transition-all">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{k}</span>
                                                <span className="text-sm font-black text-gray-800">{v as string}</span>
                                            </div>
                                        ) : null)}
                                    </div>
                                </div>
                            )}

                            {/* Complaints & Diagnosis Split */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-2 mt-4">
                                <div className="bg-orange-50/50 border border-orange-100 p-6 rounded-3xl relative overflow-hidden group hover:border-orange-200 transition-all shadow-sm">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-100 rounded-bl-[3rem] flex items-start justify-end p-4"><i className="fas fa-comment-medical text-orange-200 text-xl"></i></div>
                                    <h5 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3 relative z-10 flex items-center gap-2"><i className="fas fa-clipboard-list"></i> Chief Complaints & Symptoms</h5>
                                    <p className="text-sm font-bold text-gray-800 italic leading-relaxed relative z-10 break-words">{selectedVisit?.complaints || "No specific complaints recorded."}</p>
                                </div>
                                
                                <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-3xl relative overflow-hidden group hover:border-blue-200 transition-all shadow-sm">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-bl-[3rem] flex items-start justify-end p-4"><i className="fas fa-stethoscope text-blue-200 text-xl"></i></div>
                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 relative z-10 flex items-center gap-2"><i className="fas fa-microscope text-blue-500"></i> Provisional Diagnosis</h5>
                                    <p className="text-[15px] font-black text-blue-900 leading-relaxed relative z-10 uppercase break-words">{prescriptionForm.diagnosis || "Pending diagnostic confirmation."}</p>
                                </div>
                            </div>

                            {/* Prescribed Medicines */}
                            {prescriptionForm.medicines && prescriptionForm.medicines.length > 0 && prescriptionForm.medicines.some((m:any) => m.name) && (
                                <div className="px-2 mt-6">
                                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="fas fa-pills text-indigo-400"></i> Prescribed Medication</h5>
                                    <div className="bg-white border border-gray-200 rounded-[2rem] shadow-sm overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left table-auto">
                                            <thead className="bg-gray-50 border-b border-gray-100">
                                                <tr>
                                                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest w-12 text-center whitespace-nowrap">#</th>
                                                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap min-w-[150px]">Medicine Name</th>
                                                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Dosage / Freq</th>
                                                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Duration</th>
                                                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Instructions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {prescriptionForm.medicines.map((med: any, idx: number) => med.name ? (
                                                    <tr key={idx} className="hover:bg-blue-50/20 transition-colors group">
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-[10px] font-black mx-auto group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">{idx + 1}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-black text-gray-900 uppercase tracking-tighter">{med.name}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1 items-start">
                                                                <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 whitespace-nowrap">{med.dosage || '-'}</span>
                                                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">{med.frequency || '-'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-[11px] font-black text-indigo-700 uppercase whitespace-nowrap">{med.duration || '-'}</td>
                                                        <td className="px-6 py-4 text-[10px] font-bold text-gray-500 italic max-w-[200px] truncate" title={med.instructions}>{med.instructions || '-'}</td>
                                                    </tr>
                                                ) : null)}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Patient Advice & Next Visit */}
                            <div className="mx-2 mt-6 flex flex-col md:flex-row gap-6">
                                <div className="flex-[2] bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 p-6 rounded-[2rem] flex gap-5 items-start relative overflow-hidden group shadow-sm">
                                     <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center shrink-0 border border-teal-100 relative z-10">
                                        <i className="fas fa-leaf text-2xl text-teal-500"></i>
                                     </div>
                                     <i className="fas fa-shield-virus absolute -right-4 -top-4 text-7xl text-teal-600/5 rotate-12"></i>
                                     <div className="relative z-10 flex-1">
                                        <h5 className="text-[10px] font-black text-teal-700 uppercase tracking-widest mb-2 flex items-center gap-2">Lifestyle & Medical Advice</h5>
                                        <div className="space-y-1.5 mt-1">
                                            {(prescriptionForm.advice || "Standard medical precautions and rest are advised.")
                                                .split('\n')
                                                .filter(line => line.trim())
                                                .map((line, idx) => (
                                                <p key={idx} className="text-sm font-bold text-teal-900 leading-relaxed italic flex gap-2.5 items-start">
                                                    <span className="shrink-0 text-[10px] text-teal-500 mt-1"><i className="fas fa-check-circle"></i></span>
                                                    <span>{line.replace(/^[-*•\d.]+\s*/, '')}</span>
                                                </p>
                                            ))}
                                        </div>
                                     </div>
                                </div>

                                <div className="flex-1 bg-amber-50/50 border border-amber-100 p-6 rounded-[2rem] flex flex-col justify-center relative overflow-hidden group shadow-sm border-b-4 border-amber-200">
                                     <i className="fas fa-calendar-check absolute -right-4 -bottom-4 text-7xl text-amber-500/5 rotate-12"></i>
                                     <div className="relative z-10">
                                        <h5 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2"><i className="fas fa-calendar-alt"></i> Follow-Up Visit</h5>
                                        <p className="text-lg font-black text-amber-900 uppercase">
                                            {selectedVisit?.prescription?.followUpDate ? new Date(selectedVisit.prescription.followUpDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "As Required"}
                                        </p>
                                     </div>
                                </div>
                            </div>
                            
                            {/* Action Buttons (Footer) */}
                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-8 mb-2 mx-2">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        if (selectedVisit) {
                                            try { localStorage.setItem(`print_cache_opd_${selectedVisit.id}`, JSON.stringify(selectedVisit)); } catch(e) {}
                                            window.open(`/print/opd/${selectedVisit.id}`, '_blank');
                                        }
                                    }}
                                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center gap-2 border-b-4 border-indigo-900 group"
                                >
                                    <i className="fas fa-print group-hover:rotate-12 transition-transform"></i>
                                    Print Official Prescription
                                </button>
                                
                                <button 
                                    type="button"
                                    onClick={() => setShowPrescriptionModal(false)}
                                    className="px-8 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 border-b-4 border-gray-950 flex items-center gap-2"
                                >
                                    <i className="fas fa-times"></i> Close Record
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
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

                        {/* Prescription Templates Section (DOCTOR ONLY & ACTIVE ONLY) */}
                        {userProfile?.role === 'doctor' && (selectedVisit?.status === 'pending' || selectedVisit?.status === 'in-consultation') && (
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 mb-4 backdrop-blur-sm shadow-sm">
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 space-y-1.5 w-full">
                                        <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                                            <i className="fas fa-file-import"></i> Load Standard Protocol
                                        </label>
                                        <select 
                                            onChange={(e) => {
                                                const t = prescTemplates.find(x => x.id === e.target.value);
                                                if (t) handleLoadTemplate(t);
                                            }}
                                            className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                        >
                                            <option value="">-- Apply Rx Template --</option>
                                            {prescTemplates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-[1.2] space-y-1.5 w-full">
                                        <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                                            <i className="fas fa-save"></i> Create New Template
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="Ex: Viral Fever Pack" 
                                                value={templateName}
                                                onChange={e => setTemplateName(e.target.value)}
                                                className="flex-1 p-2.5 bg-white border border-blue-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={handleSaveTemplate}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-100"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">Clinical Evidence & Diagnosis</label>
                            </div>
                            {selectedVisit?.status === 'completed' || selectedVisit?.status === 'referred' ? (
                                <div className="relative p-6 bg-white border-2 border-dashed border-blue-100 rounded-3xl text-[15px] font-bold text-gray-800 shadow-sm leading-relaxed italic border-l-8 border-l-blue-600 overflow-hidden group">
                                    <i className="fas fa-file-medical absolute -right-6 -bottom-6 text-9xl text-blue-50/30 -rotate-12 group-hover:scale-110 transition-transform"></i>
                                    <span className="relative z-10">{prescriptionForm.diagnosis || "Provisional diagnosis recorded."}</span>
                                </div>
                            ) : (
                                <textarea 
                                    value={prescriptionForm.diagnosis}
                                    onChange={(e) => setPrescriptionForm({...prescriptionForm, diagnosis: e.target.value})}
                                    required
                                    className="w-full p-4 border rounded-2xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium leading-relaxed shadow-inner"
                                    placeholder="Consultation notes, symptoms, and provisional diagnosis..."
                                    rows={3}
                                ></textarea>
                            )}
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">Prescribed Medication</label>
                                {userProfile?.role === 'doctor' && (selectedVisit?.status === 'pending' || selectedVisit?.status === 'in-consultation') && (
                                    <button type="button" onClick={() => setPrescriptionForm({...prescriptionForm, medicines: [...prescriptionForm.medicines, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]})} className="text-xs font-black text-blue-600 hover:text-blue-800 flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl transition-all shadow-sm border border-blue-100">
                                        <i className="fas fa-plus"></i> ADD DRUG
                                    </button>
                                )}
                            </div>
                            <div className="space-y-4">
                                {selectedVisit?.status === 'completed' || selectedVisit?.status === 'referred' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {prescriptionForm.medicines.map((med: any, idx: number) => (
                                            <div key={idx} className="bg-white p-5 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden ring-1 ring-blue-50">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/30 rounded-bl-[4rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                                                <div className="flex items-start gap-4 relative z-10">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-lg shadow-blue-200">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-tighter truncate leading-none mb-1 group-hover:text-blue-700 transition-colors uppercase">{med.name || 'Unnamed Drug'}</h4>
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100" title="Frequency">
                                                                <i className="fas fa-clock text-[9px] text-blue-500"></i>
                                                                <span className="text-[10px] font-black text-slate-600 tracking-tighter">{med.frequency}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100" title="Dosage">
                                                                <i className="fas fa-prescription-bottle text-[9px] text-blue-500"></i>
                                                                <span className="text-[10px] font-black text-slate-600 tracking-tighter">{med.dosage}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 rounded-lg border border-indigo-100" title="Duration">
                                                                <i className="fas fa-calendar-day text-[9px] text-indigo-500"></i>
                                                                <span className="text-[10px] font-black text-indigo-700 tracking-tighter">{med.duration}</span>
                                                            </div>
                                                        </div>
                                                        {med.instructions && (
                                                            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-100 shadow-sm">
                                                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                                                                <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">{med.instructions}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    prescriptionForm.medicines.map((med: any, idx: number) => (
                                        <div key={idx} className="p-5 bg-gray-50/50 rounded-2xl border border-gray-200 relative group animate-in fade-in slide-in-from-top-2 shadow-sm">
                                            <button type="button" onClick={() => {
                                                const newM = [...prescriptionForm.medicines];
                                                newM.splice(idx, 1);
                                                setPrescriptionForm({...prescriptionForm, medicines: newM});
                                            }} className="absolute -top-2 -right-2 w-7 h-7 bg-white text-red-600 rounded-full flex items-center justify-center border border-red-100 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white"><i className="fas fa-times text-xs"></i></button>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Molecule / Brand</label>
                                                    <div className="relative">
                                                        <i className="fas fa-capsules absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                                                        <input 
                                                            type="text" placeholder="Search drug..." 
                                                            value={med.name}
                                                            onChange={e => {
                                                                const newM = [...prescriptionForm.medicines];
                                                                newM[idx].name = e.target.value;
                                                                setPrescriptionForm({...prescriptionForm, medicines: newM});
                                                            }}
                                                            onBlur={(e) => handleMedDosagePredict(idx, e.target.value)}
                                                            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dosage Logic</label>
                                                    <div className="relative">
                                                        <i className="fas fa-vial absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs"></i>
                                                        <input 
                                                            type="text" placeholder="e.g. 500mg (BID)" 
                                                            value={med.dosage}
                                                            onChange={e => {
                                                                const newM = [...prescriptionForm.medicines];
                                                                newM[idx].dosage = e.target.value;
                                                                setPrescriptionForm({...prescriptionForm, medicines: newM});
                                                            }}
                                                            className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                            <i className="fas fa-robot text-[11px] text-blue-500 animate-pulse bg-blue-50 p-1 rounded" title="AI Assisted Dosage"></i>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter ml-1">Frequency</label>
                                                    <input type="text" placeholder="1-0-1" value={med.frequency} onChange={e => {
                                                        const newM = [...prescriptionForm.medicines];
                                                        newM[idx].frequency = e.target.value;
                                                        setPrescriptionForm({...prescriptionForm, medicines: newM});
                                                    }} className="w-full p-2.5 text-[11px] border border-gray-100 rounded-xl bg-white font-bold outline-none focus:ring-1 focus:ring-blue-300" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter ml-1">Duration</label>
                                                    <input type="text" placeholder="5 Days" value={med.duration} onChange={e => {
                                                        const newM = [...prescriptionForm.medicines];
                                                        newM[idx].duration = e.target.value;
                                                        setPrescriptionForm({...prescriptionForm, medicines: newM});
                                                    }} className="w-full p-2.5 text-[11px] border border-gray-100 rounded-xl bg-white font-bold outline-none focus:ring-1 focus:ring-blue-300" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter ml-1">Usage</label>
                                                    <input type="text" placeholder="After Food" value={med.instructions} onChange={e => {
                                                        const newM = [...prescriptionForm.medicines];
                                                        newM[idx].instructions = e.target.value;
                                                        setPrescriptionForm({...prescriptionForm, medicines: newM});
                                                    }} className="w-full p-2.5 text-[11px] border border-gray-100 rounded-xl bg-white font-bold outline-none focus:ring-1 focus:ring-blue-300" />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Lab Referral Engine */}
                        {(selectedVisit?.status === 'completed' || selectedVisit?.status === 'referred') ? (
                            <div className="bg-orange-50/30 p-5 rounded-2xl border border-orange-100 flex flex-col gap-3">
                                <h5 className="text-[10px] font-black text-orange-700 uppercase tracking-widest flex items-center gap-2">
                                    <i className="fas fa-vial"></i> Laboratory Referrals
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                    {prescriptionForm.referredTests.map((test: string, idx: number) => (
                                        <span key={idx} className="bg-white text-orange-700 px-3 py-1 rounded-full text-[10px] font-black border border-orange-200 shadow-sm">{test}</span>
                                    ))}
                                    {prescriptionForm.referredTests.length === 0 && <span className="text-[10px] text-gray-400 italic">No lab tests referred.</span>}
                                </div>
                            </div>
                        ) : (
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
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Advice & Lifestyle Modifications</label>
                            {(selectedVisit?.status === 'completed' || selectedVisit?.status === 'referred') ? (
                                <div className="p-6 bg-gradient-to-br from-teal-50/50 to-emerald-50/30 border border-teal-100 rounded-[2.5rem] shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center gap-6">
                                    <i className="fas fa-shield-virus absolute -right-4 -top-4 text-7xl text-teal-600/5 rotate-12"></i>
                                    <div className="shrink-0 flex items-center gap-3 bg-white p-3 rounded-2xl border border-teal-100 shadow-sm self-start">
                                        <div className="w-10 h-10 bg-teal-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-teal-100">
                                            <i className="fas fa-user-shield"></i>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Physician's</p>
                                            <p className="text-xs font-black text-gray-900 uppercase tracking-tighter leading-none">Lifestyle Guidance</p>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-teal-900 leading-relaxed italic">
                                            {prescriptionForm.advice || "Standard medical precautions and rest are advised for optimal recovery."}
                                        </p>
                                    </div>
                                    <div className="shrink-0 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-teal-100 md:pl-6 text-center md:text-right">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Follow-up Recommendation</p>
                                        <p className="text-sm font-black text-gray-800 uppercase tracking-tighter">
                                            {prescriptionForm.nextVisit ? new Date(prescriptionForm.nextVisit).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "AS REQUIRED"}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <textarea 
                                    value={prescriptionForm.advice}
                                    onChange={(e) => setPrescriptionForm({...prescriptionForm, advice: e.target.value})}
                                    className="w-full p-4 border rounded-2xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    placeholder="Rest, diet plan, etc..."
                                    rows={2}
                                ></textarea>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest ml-1">Next Visit Recommendation</label>
                                {(selectedVisit?.status === 'completed' || selectedVisit?.status === 'referred') ? (
                                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black text-gray-700 uppercase">
                                        {prescriptionForm.nextVisit ? new Date(prescriptionForm.nextVisit).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "As required"}
                                    </div>
                                ) : (
                                    <input 
                                        type="date"
                                        value={prescriptionForm.nextVisit}
                                        onChange={(e) => setPrescriptionForm({...prescriptionForm, nextVisit: e.target.value})}
                                        className="w-full p-3 border rounded-xl bg-gray-50 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                            {(selectedVisit?.status === 'completed' || selectedVisit?.status === 'referred') && (
                                <button 
                                    type="button"
                                    onClick={() => window.open(`/print/opd/${selectedVisit.id}`, '_blank')}
                                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-3 border-b-4 border-indigo-900 group"
                                >
                                    <i className="fas fa-print group-hover:rotate-12 transition-transform"></i>
                                    Print Official Prescription
                                </button>
                            )}
                            
                            <button 
                                type="button"
                                onClick={() => setShowPrescriptionModal(false)}
                                className="px-8 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 border-b-4 border-gray-950 flex items-center justify-center gap-2"
                            >
                                <i className="fas fa-portal-exit mr-2"></i> {(selectedVisit?.status === 'pending' || selectedVisit?.status === 'in-consultation') ? 'Cancel' : 'Close Verification Portal'}
                            </button>
                            
                            {(selectedVisit?.status === 'pending' || selectedVisit?.status === 'in-consultation') && userProfile?.role === 'doctor' && (
                                <>
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
                                </>
                            )}
                        </div>
                    </form>

                    {/* Right: AI Clinical Assistant & History (DOCTOR ONLY & ACTIVE ONLY) */}
                    {userProfile?.role === 'doctor' && (selectedVisit?.status === 'pending' || selectedVisit?.status === 'in-consultation') && (
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

                        {/* 2. Patient Clinical Timeline */}
                        <div className="flex-1 flex flex-col min-h-0 bg-white/50 rounded-2xl border border-gray-100 p-1 shadow-inner">
                            <div className="flex items-center justify-between mb-4 px-3 pt-3">
                                <div className="flex items-center gap-2">
                                    <i className="fas fa-history text-blue-600 text-xs"></i>
                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Clinical History</h3>
                                </div>
                                <span className="text-[8px] font-bold bg-white text-gray-400 px-2 py-0.5 rounded-full border">{patientHistory.length} EVENTS</span>
                            </div>
                            
                            <div className="space-y-4 overflow-y-auto flex-1 px-3 pb-4 custom-scrollbar relative before:absolute before:left-[21px] before:top-2 before:bottom-4 before:w-0.5 before:bg-blue-100">
                                {patientHistory.map((h, i) => (
                                    <div key={h.id} className="relative pl-8 animate-in fade-in slide-in-from-right-3" style={{ animationDelay: `${i * 100}ms` }}>
                                        <div className="absolute left-0 top-1 w-6 h-6 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center z-10 shadow-md">
                                            <i className="fas fa-prescription text-[9px] text-blue-600"></i>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all group cursor-default">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{new Date(h.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleLoadTemplate(h)}
                                                    className="text-[9px] font-black text-blue-600 hover:underline"
                                                >
                                                    REUSE RX
                                                </button>
                                            </div>
                                            <p className="text-[11px] font-extrabold text-gray-800 line-clamp-1 mb-2">"{h.diagnosis || 'Follow-up'}"</p>
                                            <div className="flex flex-wrap gap-1">
                                                {h.medicines?.slice(0, 3).map((m:any, j:number) => (
                                                    <span key={j} className="text-[8px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md border border-gray-100 font-bold">{m.name}</span>
                                                ))}
                                                {h.medicines?.length > 3 && <span className="text-[8px] text-gray-400 font-extrabold">+{h.medicines.length-3}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {reports.filter(r => r.patientId === selectedVisit?.patientId).slice(0, 3).map((r, i) => (
                                    <div key={r.id} className="relative pl-8 animate-in fade-in slide-in-from-right-3">
                                        <div className="absolute left-0 top-1 w-6 h-6 bg-white border-2 border-orange-500 rounded-full flex items-center justify-center z-10 shadow-md">
                                            <i className="fas fa-flask text-[9px] text-orange-600"></i>
                                        </div>
                                        <div onClick={() => window.open(`/print/report/${r.id}`, '_blank')} className="bg-orange-50/30 p-4 rounded-2xl border border-orange-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[9px] font-black text-orange-600">{new Date(r.createdAt || '').toLocaleDateString()}</span>
                                                <i className="fas fa-external-link-alt text-[8px] text-orange-300"></i>
                                            </div>
                                            <p className="text-[11px] font-black text-orange-950 truncate">{r.testName || 'Lab Investigation'}</p>
                                            <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 mt-2 inline-block rounded-md ${r.threatLevel === 'Critical' ? 'bg-red-500 text-white animate-pulse' : 'bg-green-500 text-white'}`}>
                                                {r.threatLevel || 'Normal'}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {patientHistory.length === 0 && reports.filter(r => r.patientId === selectedVisit?.patientId).length === 0 && (
                                    <div className="py-20 text-center flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                                            <i className="fas fa-folder-open text-3xl"></i>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No Prior Data</p>
                                            <p className="text-[9px] text-gray-300 italic">Patient visiting for the first time.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                        </>
                    )}
            </div>
        </Modal>
    </div>
);
}
