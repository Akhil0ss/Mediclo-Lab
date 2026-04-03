'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ref, onValue, push, update, remove, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { generatePatientId, generateTokenNumber } from '@/lib/idGenerator';
import { calculateBilling, createBillingItem, formatCurrency, generateInvoiceNumber } from '@/lib/billingCalculator';
import { defaultTemplates } from '@/lib/defaultTemplates';
import { mergeTemplates } from '@/lib/templateUtils';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Modal from '@/components/Modal';
import PatientHistoryModal from '@/components/PatientHistoryModal';
import BillingModal from '@/components/BillingModal';

export default function PatientsPage() {
    const { user, userProfile } = useAuth();
    const { showToast } = useToast();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [patients, setPatients] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [filteredPatients, setFilteredPatients] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [templates, setTemplates] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [samples, setSamples] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [reports, setReports] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [visits, setVisits] = useState<any[]>([]);
    const [assignedPatientIds, setAssignedPatientIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [doctors, setDoctors] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [visitPurpose, setVisitPurpose] = useState('lab');
    const [currentPage, setCurrentPage] = useState(1);
    const searchParams = useSearchParams();
    const [expandedAddressRow, setExpandedAddressRow] = useState<string | null>(null);
    const itemsPerPage = 10;

    // Handle Quick Add from Dashboard / Patient Success Flow
    useEffect(() => {
        if (searchParams.get('add') === 'true') {
            const pId = searchParams.get('patientId');
            if (pId) {
                setFormData(prev => ({ ...prev, patientId: pId }));
            }
            setShowAddModal(true);
        }
    }, [searchParams]);

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [newPatientCreds, setNewPatientCreds] = useState<any>(null);
    const [historyPatient, setHistoryPatient] = useState<{ id: string, name: string } | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [externalDoctors, setExternalDoctors] = useState<any[]>([]);
    const [showExternalDoctorInput, setShowExternalDoctorInput] = useState(false);
    const [duplicatePatient, setDuplicatePatient] = useState<any>(null);

    const [formData, setFormData] = useState({
        patientId: '', // Added patientId for potential pre-fills
        title: 'Mr.', // Added title
        name: '',
        age: '',
        gender: '',
        mobile: '',
        address: '',
        refDoctor: '',
        externalDoctorClinic: ''
    });

    const resetForm = () => {
        setFormData({
            patientId: '',
            title: 'Mr.', // Reset title
            name: '',
            age: '',
            gender: '',
            mobile: '',
            address: '',
            refDoctor: '',
            externalDoctorClinic: ''
        });
        setVisitPurpose('lab');
        setShowExternalDoctorInput(false);
        setDuplicatePatient(null);
    };


    // Billing Modal states
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [billingPatient, setBillingPatient] = useState<any>(null);


    useEffect(() => {
        if (!user || !userProfile) return;

        const dataSourceId = userProfile.ownerId || user.uid;

        const patientsRef = ref(database, `patients/${dataSourceId}`);
        const reportsRef = ref(database, `reports/${dataSourceId}`);
        const commonTemplatesRef = ref(database, 'common_templates');
        const doctorsRef = ref(database, `users/${dataSourceId}/auth/staff`);
        const templatesRef = ref(database, `templates/${dataSourceId}`);
        const samplesRef = ref(database, `samples/${dataSourceId}`);
        const opdRef = ref(database, `opd/${dataSourceId}`);

        const unsubPatients = onValue(patientsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setPatients(data);
            setFilteredPatients(data);
        });

        const fetchTemplates = () => {
            get(templatesRef).then(userSnapshot => {
                get(commonTemplatesRef).then(commonSnapshot => {
                    const userTemplates: any[] = [];
                    userSnapshot.forEach(child => {
                        userTemplates.push({ id: child.key, ...child.val() });
                    });

                    const commonTemplates: any[] = [];
                    commonSnapshot.forEach(child => {
                        commonTemplates.push({ id: child.key, ...child.val() });
                    });

                    const combined = mergeTemplates(userTemplates, commonTemplates);
                    setTemplates(combined.sort((a, b) => a.name.localeCompare(b.name)));
                });
            });
        };

        fetchTemplates();
        const unsubTemplates = onValue(templatesRef, fetchTemplates);
        const unsubCommon = onValue(commonTemplatesRef, fetchTemplates);

        const unsubSamples = onValue(samplesRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => { data.push({ id: child.key, ...child.val() }); });
            data.sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
            setSamples(data);
        });

        const unsubVisits = onValue(opdRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
            setVisits(data);
        });

        const unsubReports = onValue(reportsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => { data.push({ id: child.key, ...child.val() }); });
            data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setReports(data);
        });

        const unsubDoctors = onValue(doctorsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => { 
                const val = child.val();
                if (['doctor', 'dr-staff'].includes(val.role)) {
                    data.push({ id: child.key, ...val }); 
                }
            });
            data.sort((a: any, b: any) => a.name.localeCompare(b.name));
            setDoctors(data);
        });

        // Fetch OPD visits to determine assigned patients for Doctor
        let unsubOPD = () => {};
        if (userProfile.role === 'doctor') {
            const opdRef = ref(database, `opd/${dataSourceId}`);
            unsubOPD = onValue(opdRef, (snapshot) => {
                const ids = new Set<string>();
                const doctorId = user.uid;
                snapshot.forEach((child) => {
                    const visit = child.val();
                    if (visit.doctorId === doctorId) {
                        ids.add(visit.patientId);
                    }
                });
                setAssignedPatientIds(ids);
            });
        }

        setLoading(false);

        return () => {
            unsubPatients();
            unsubTemplates();
            unsubCommon();
            unsubSamples();
            unsubVisits();
            unsubReports();
            unsubDoctors();
            unsubOPD();
        };
    }, [user, userProfile]);

    // Fetch External Doctors
    useEffect(() => {
        if (!user || !userProfile) return;
        const dataSourceId = userProfile.ownerId || user.uid;
        const externalDoctorsRef = ref(database, `externalDoctors/${dataSourceId}`);
        const unsub = onValue(externalDoctorsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => { data.push({ id: child.key, ...child.val() }); });
            data.sort((a: any, b: any) => a.name.localeCompare(b.name));
            setExternalDoctors(data);
        });
        return () => unsub();
    }, [user, userProfile]);

    useEffect(() => {
        // For doctors, filter to show only their assigned patients
        let basePatients = patients;

        if (userProfile?.role === 'doctor') {
            const doctorName = userProfile?.name;
            basePatients = patients.filter(p => 
                p.refDoctor === doctorName || 
                assignedPatientIds.has(p.id)
            );
        }

        if (!searchQuery.trim()) {
            setFilteredPatients(basePatients);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredPatients(
                basePatients.filter(p =>
                    p.name.toLowerCase().includes(query) ||
                    p.mobile.includes(query) ||
                    (p.address && p.address.toLowerCase().includes(query)) ||
                    (p.patientId && p.patientId.toLowerCase().includes(query))
                )
            );
        }
        setCurrentPage(1);
    }, [searchQuery, patients, userProfile, user, assignedPatientIds]);

    const handleFilterByDate = () => {
        if (!fromDate || !toDate) {
            showToast('Please select both dates', 'warning');
            return;
        }

        // Apply Date Filter
        const filtered = patients.filter(p => {
            if (!p.createdAt) return false;
            try {
                const patientDate = new Date(p.createdAt).toISOString().split('T')[0];
                return patientDate >= fromDate && patientDate <= toDate;
            } catch (e) {
                return false;
            }
        });

        // Maintain role restriction if Doctor
        let finalFiltered = filtered;
        if (userProfile?.role === 'doctor') {
            const doctorName = userProfile?.name;
            finalFiltered = filtered.filter(p => p.refDoctor === doctorName);
        }

        setFilteredPatients(finalFiltered);
        setCurrentPage(1);
    };

    const handleAddPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const dataSourceId = userProfile?.ownerId || user.uid;

        // If external doctor is provided AND new input mode is active, save it
        if (showExternalDoctorInput && formData.refDoctor) {
            const externalDoctorData = {
                name: formData.refDoctor,
                clinicInfo: formData.externalDoctorClinic || '',
                createdAt: new Date().toISOString()
            };
            await push(ref(database, `externalDoctors/${dataSourceId}`), externalDoctorData);
        }

        // Check for duplicate mobile (Compare last 10 digits)
        const cleanInput = formData.mobile.replace(/\D/g, '').slice(-10);
        const existingPatient = patients.find(p => {
            const cleanExisting = (p.mobile || '').replace(/\D/g, '').slice(-10);
            return cleanExisting === cleanInput;
        });

        if (existingPatient) {
            alert(`Patient with mobile ${formData.mobile} already exists: ${existingPatient.name}\n\nPlease use the existing patient record.`);
            setDuplicatePatient(existingPatient);
            return;
        }

        // Generate auto Patient ID and Token (using dataSourceId)
        const clinicName = userProfile?.labName || 'CLINIC';
        const patientId = await generatePatientId(dataSourceId, clinicName);
        const autoToken = await generateTokenNumber(dataSourceId);

        const patientData = {
            ...formData,
            patientId, // Auto-generated Patient ID
            age: parseInt(formData.age),
            registrationType: 'lab',
            token: autoToken, // Auto-generated Token
            createdAt: new Date().toISOString()
        };

        const newPatientRef = await push(ref(database, `patients/${dataSourceId}`), patientData);

        setShowAddModal(false);
        resetForm();

        // Show Success Modal with ID and flow option
        setNewPatientCreds({
            id: newPatientRef.key,
            patientId,
            token: autoToken
        });
        setShowSuccessModal(true);
        showToast('Patient added successfully!', 'success');
    };

    const handleUpdatePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedPatient) return;
        if (!confirm('Are you sure you want to update this patient details?')) return;
        const dataSourceId = userProfile?.ownerId || user.uid;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: any = {};

        // 1. Update patient record
        updates[`patients/${dataSourceId}/${selectedPatient.id}/title`] = formData.title;
        updates[`patients/${dataSourceId}/${selectedPatient.id}/name`] = formData.name;
        updates[`patients/${dataSourceId}/${selectedPatient.id}/age`] = parseInt(formData.age);
        updates[`patients/${dataSourceId}/${selectedPatient.id}/gender`] = formData.gender;
        updates[`patients/${dataSourceId}/${selectedPatient.id}/mobile`] = formData.mobile;
        updates[`patients/${dataSourceId}/${selectedPatient.id}/address`] = formData.address;
        updates[`patients/${dataSourceId}/${selectedPatient.id}/refDoctor`] = formData.refDoctor;
        updates[`patients/${dataSourceId}/${selectedPatient.id}/updatedAt`] = new Date().toISOString();

        // 2. Sync patient data to all related reports
        const relatedReports = reports.filter(r => r.patientId === selectedPatient.id);
        relatedReports.forEach(r => {
            updates[`reports/${dataSourceId}/${r.id}/patientName`] = formData.name;
            updates[`reports/${dataSourceId}/${r.id}/patientAge`] = parseInt(formData.age);
            updates[`reports/${dataSourceId}/${r.id}/patientGender`] = formData.gender;
            updates[`reports/${dataSourceId}/${r.id}/patientMobile`] = formData.mobile;
            updates[`reports/${dataSourceId}/${r.id}/patientRefDoctor`] = formData.refDoctor;
            updates[`reports/${dataSourceId}/${r.id}/refDoctor`] = formData.refDoctor;
        });

        // 3. Sync patient data to all related samples
        const relatedSamples = samples.filter(s => s.patientId === selectedPatient.id);
        relatedSamples.forEach(s => {
            updates[`samples/${dataSourceId}/${s.id}/patientName`] = formData.name;
            updates[`samples/${dataSourceId}/${s.id}/patientAge`] = parseInt(formData.age);
            updates[`samples/${dataSourceId}/${s.id}/patientGender`] = formData.gender;
            updates[`samples/${dataSourceId}/${s.id}/patientMobile`] = formData.mobile;
        });

        try {
            console.log('[PATIENT SYNC] Patient ID:', selectedPatient.id);
            console.log('[PATIENT SYNC] Total reports in state:', reports.length);
            console.log('[PATIENT SYNC] Related reports found:', relatedReports.length, relatedReports.map(r => ({id: r.id, patientId: r.patientId})));
            console.log('[PATIENT SYNC] Related samples found:', relatedSamples.length);
            console.log('[PATIENT SYNC] Update paths:', Object.keys(updates));
            await update(ref(database), updates);
            showToast(`Patient updated! ${relatedReports.length} reports & ${relatedSamples.length} samples synced.`, 'success');
        } catch (error) {
            console.error('Sync error:', error);
            showToast('Patient updated but sync failed. Try again.', 'error');
        }

        setShowEditModal(false);
        resetForm();
    };

    const handleDeletePatient = async (patientId: string, patientName: string) => {
        if (!user) return;

        // Find related records
        const relatedSamples = samples.filter(s => s.patientId === patientId);
        const relatedReports = reports.filter(r => r.patientId === patientId);
        const count = relatedSamples.length + relatedReports.length;

        let message = `Are you sure you want to delete patient "${patientName}"?`;

        if (count > 0) {
            message += `\n\n⚠️ CRITICAL WARNING: This patient has ${count} related records.\n` +
                `Deleting this patient will also PERMANENTLY DELETE:\n` +
                `   - ${relatedSamples.length} Laboratory Samples\n` +
                `   - ${relatedReports.length} Lab Reports\n` +
                `This action CANNOT be undone! Proceed?`;
        }

        if (!confirm(message)) return;

        try {
            const dataSourceId = userProfile?.ownerId || user.uid;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updates: any = {};

            // Delete patient
            updates[`patients/${dataSourceId}/${patientId}`] = null;

            // Delete related records
            relatedSamples.forEach(s => updates[`samples/${dataSourceId}/${s.id}`] = null);
            relatedReports.forEach(r => updates[`reports/${dataSourceId}/${r.id}`] = null);


            await update(ref(database), updates);
            alert('Patient and all related data deleted successfully.');
        } catch (error) {
            console.error(error);
            alert('Error deleting patient');
        }
    };

    const openAddModal = () => {
        resetForm();
        setShowAddModal(true);
    };

    const openEditModal = (patient: any) => {
        setSelectedPatient(patient);
        setFormData({
            patientId: patient.patientId || '',
            title: patient.title || 'Mr.',
            name: patient.name || '',
            age: patient.age?.toString() || '',
            gender: patient.gender || '',
            mobile: patient.mobile || '',
            address: patient.address || '',
            refDoctor: patient.refDoctor || '',
            externalDoctorClinic: patient.externalDoctorClinic || ''
        });
        setShowEditModal(true);
    };

    const openViewModal = (patient: any) => {
        setSelectedPatient(patient);
        setShowViewModal(true);
    };




    const exportToCSV = () => {
        if (patients.length === 0) {
            alert('No patients to export');
            return;
        }

        const csv = [
            ['Name', 'Age', 'Gender', 'Contact', 'Address', 'Ref. Doctor', 'Created Date'],
            ...patients.map(p => [
                `${p.title || ''} ${p.name}`,
                p.age,
                p.gender,
                p.mobile,
                p.address || '',
                p.refDoctor || '',
                new Date(p.createdAt).toLocaleString('en-IN')
            ])
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `patients_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert('Patients exported to CSV!');
    };

    // Pagination
    const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedPatients = filteredPatients.slice(startIndex, startIndex + itemsPerPage);

    // Role-based Access Control
    const isViewOnly = userProfile?.role === 'lab' || userProfile?.role === 'doctor';

    return (
        <div>
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="mb-4">
                    <div className="flex gap-2 flex-wrap items-center">
                        {userProfile?.role === 'lab' && (
                            <div className="mr-auto">
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <i className="fas fa-users text-blue-600"></i>
                                    Patients
                                </h2>
                            </div>
                        )}
                        {!isViewOnly && (
                            <button
                                onClick={openAddModal}
                                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-lg focus:outline-none"
                            >
                                <i className="fas fa-plus mr-2"></i>Add Patient
                            </button>
                        )}
                        <input
                            type="text"
                            placeholder="Search patients..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[200px]"
                        />
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                            onClick={handleFilterByDate}
                            className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-lg hover:shadow-lg"
                        >
                            <i className="fas fa-filter mr-2"></i>Filter
                        </button>
                        <button
                            onClick={exportToCSV}
                            className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-4 py-2 rounded-lg hover:shadow-lg ml-auto"
                        >
                            <i className="fas fa-download mr-2"></i>Export CSV
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-full">
                        <thead className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                            <tr>
                                <th className="px-4 py-2 text-left text-sm font-semibold">ID</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Age/Gender</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Contact</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Address</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Ref. Dr</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Created</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedPatients.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        <i className="fas fa-users text-4xl mb-2 opacity-20"></i>
                                        <p>No patients found</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedPatients.map(patient => (
                                    <tr key={patient.id} className="border-b hover:bg-gray-50 transition">
                                        <td className="px-4 py-2 text-sm">
                                            <span className="font-mono font-bold text-purple-600 text-xs">{patient.patientId || 'N/A'}</span>
                                        </td>
                                        <td className="px-4 py-2 text-sm font-semibold text-gray-800">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span>{patient.title} {patient.name}</span>
                                                {patient.source === 'WEB' && (
                                                    <span className="text-blue-500" title="Booked from Web">
                                                        <i className="fas fa-globe"></i>
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-sm">{patient.age} / {patient.gender ? patient.gender[0] : '?'}</td>
                                        <td className="px-4 py-2 text-sm">{patient.mobile}</td>
                                        <td className="px-4 py-2 text-sm">
                                            {(() => {
                                                const address = patient.address || 'N/A';
                                                if (address === 'N/A' || address.length <= 30) return address;

                                                const isExpanded = expandedAddressRow === patient.id;

                                                return (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={isExpanded ? '' : 'truncate max-w-[200px]'}>
                                                                {isExpanded ? address : `${address.substring(0, 30)}...`}
                                                            </span>
                                                            <button
                                                                onClick={() => setExpandedAddressRow(isExpanded ? null : patient.id)}
                                                                className="inline-block bg-gray-50 text-gray-700 px-2 py-0.5 rounded text-xs font-bold border border-gray-200 hover:bg-gray-100 transition-colors whitespace-nowrap flex-shrink-0"
                                                            >
                                                                {isExpanded ? '− Less' : '+ More'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-4 py-2 text-sm">{patient.refDoctor || 'N/A'}</td>
                                        <td className="px-4 py-2 text-sm text-gray-600">
                                            {patient.createdAt ? (
                                                <div>
                                                    <div className="flex items-center gap-1.5 font-medium text-gray-700" title={`Time: ${new Date(patient.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`}>
                                                        <span>{new Date(patient.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                                                        <i className="far fa-clock text-blue-400 cursor-help text-xs hover:text-blue-600 transition-colors"></i>
                                                    </div>
                                                </div>
                                            ) : 'N/A'}
                                        </td>
                                        <td className="px-4 py-2 text-sm">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setHistoryPatient({ id: patient.id, name: patient.name })}
                                                    className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                                                    title="View Clinical History"
                                                >
                                                    <i className="fas fa-eye"></i>
                                                </button>
                                                {!isViewOnly && (
                                                    <>
                                                        <button
                                                            onClick={() => openEditModal(patient)}
                                                            className="text-green-600 hover:text-green-800 transition-colors p-1"
                                                            title="Edit"
                                                        >
                                                            <i className="fas fa-edit"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setBillingPatient(patient);
                                                                setShowBillingModal(true);
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                                                            title="Generate Bill"
                                                        >
                                                            <i className="fas fa-file-invoice-dollar"></i>
                                                        </button>
                                                        <div className="border-l border-gray-300 h-5 mx-1"></div>
                                                        <button
                                                            onClick={() => handleDeletePatient(patient.id, patient.name)}
                                                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                            title="Delete"
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination mt-4">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                        >
                            <i className="fas fa-chevron-left"></i> Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                className={currentPage === page ? 'active' : ''}
                                onClick={() => setCurrentPage(page)}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(currentPage + 1)}
                        >
                            Next <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>
                )}
            </div>

            {/* Add Patient Modal */}
            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <i className="fas fa-user-plus text-purple-600"></i> Add New Patient
                </h3>
                <form onSubmit={handleAddPatient} className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1">Patient Name *</label>
                            <div className="flex gap-2">
                                <select
                                    value={formData.title}
                                    onChange={(e) => {
                                        const title = e.target.value;
                                        let gender = formData.gender;
                                        // Auto-set gender based on title
                                        if (['Mr.', 'Master'].includes(title)) gender = 'Male';
                                        if (['Mrs.', 'Ms.', 'Miss'].includes(title)) gender = 'Female';
                                        setFormData({ ...formData, title, gender });
                                    }}
                                    className="w-24 px-2 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 shadow-sm"
                                >
                                    <option value="Mr.">Mr.</option>
                                    <option value="Mrs.">Mrs.</option>
                                    <option value="Ms.">Ms.</option>
                                    <option value="Miss">Miss</option>
                                    <option value="Master">Master</option>
                                    <option value="Baby">Baby</option>
                                    <option value="Dr.">Dr.</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Patient Name"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 shadow-sm"
                                />
                            </div>
                        </div>
                        {/* Mobile Number - with duplicate detection */}
                        <div>
                            <label className="block text-sm font-semibold mb-1">Contact Number *</label>
                            <input
                                type="tel"
                                placeholder="Mobile Number"
                                required
                                value={formData.mobile}
                                onChange={(e) => {
                                    const mobile = e.target.value;
                                    setFormData({ ...formData, mobile });

                                    // Real-time duplicate check
                                    if (mobile.length >= 10) {
                                        const cleanInput = mobile.replace(/\D/g, '').slice(-10);
                                        const existing = patients.find(p => {
                                            const cleanExisting = (p.mobile || '').replace(/\D/g, '').slice(-10);
                                            return cleanExisting === cleanInput;
                                        });
                                        setDuplicatePatient(existing || null);
                                    } else {
                                        setDuplicatePatient(null);
                                    }
                                }}
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 shadow-sm"
                            />
                        </div>
                    </div>

                    {duplicatePatient && (
                        <div className="p-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-bold text-yellow-800 mb-1">⚠️ Patient Already Exists!</p>
                                    <p className="text-xs text-yellow-700"><strong>Name:</strong> {duplicatePatient.name} | <strong>ID:</strong> {duplicatePatient.patientId}</p>
                                    <p className="text-xs text-yellow-700"><strong>Age:</strong> {duplicatePatient.age} | <strong>Gender:</strong> {duplicatePatient.gender}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        resetForm();
                                    }}
                                    className="bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase hover:bg-yellow-700 shadow-sm"
                                >
                                    Use Existing
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold mb-1">Age *</label>
                            <input
                                type="number"
                                placeholder="Age"
                                required
                                min="1"
                                max="150"
                                value={formData.age}
                                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">Gender *</label>
                            <select
                                required
                                value={formData.gender}
                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1">Patient Address *</label>
                            <input
                                type="text"
                                placeholder="Locality, City"
                                required
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 shadow-sm"
                            />
                        </div>
                        {/* Referring Doctor Selection */}
                        <div className="flex flex-col">
                            <label className="block text-sm font-semibold mb-1">Referring Doctor</label>

                            {/* Internal + External Doctor Logic */}
                            <select
                                required
                                value={showExternalDoctorInput ? '__external__' : formData.refDoctor}
                                onChange={(e) => {
                                    if (e.target.value === '__external__') {
                                        setShowExternalDoctorInput(true);
                                        setFormData({ ...formData, refDoctor: '', externalDoctorClinic: '' });
                                    } else {
                                        setShowExternalDoctorInput(false);
                                        setFormData({ ...formData, refDoctor: e.target.value });
                                    }
                                }}
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 shadow-sm"
                            >
                                <option value="">Select Doctor</option>
                                {/* Merge and display all unique doctors alphabetically */}
                                {[...doctors, ...externalDoctors]
                                    .filter((d, index, self) =>
                                        index === self.findIndex((t) => t.name === d.name)
                                    )
                                    .sort((a, b) => a.name.localeCompare(b.name)) // Added explicit sort here too
                                    .map(d => (
                                        <option key={d.id} value={d.name}>Dr. {d.name}</option>
                                    ))
                                }
                                <option value="__external__" className="font-bold text-purple-600">➕ Add New Doctor</option>
                            </select>
                        </div>
                    </div>

                    {showExternalDoctorInput && (
                        <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="col-span-2"><p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">New Doctor Registration</p></div>
                            <input
                                type="text"
                                placeholder="Full Name *"
                                required
                                value={formData.refDoctor}
                                onChange={(e) => setFormData({ ...formData, refDoctor: e.target.value })}
                                className="w-full px-3 py-2 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                            />
                            <input
                                type="text"
                                placeholder="Clinic / Hospital *"
                                required
                                value={formData.externalDoctorClinic}
                                onChange={(e) => setFormData({ ...formData, externalDoctorClinic: e.target.value })}
                                className="w-full px-3 py-2 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                            />
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 rounded-lg hover:shadow-lg"
                        >
                            <i className="fas fa-plus mr-2"></i>Add Patient
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAddModal(false)}
                            className="px-6 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit Patient Modal */}
            <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
                <h3 className="text-xl font-bold mb-4">
                    <i className="fas fa-user-edit text-green-600 mr-2"></i>Edit Patient
                </h3>
                <form onSubmit={handleUpdatePatient} className="space-y-3">
                    <div>
                        <label className="block text-sm font-semibold mb-1">Patient Name</label>
                        <div className="flex gap-2">
                            <select
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-24 px-2 py-2 border-2 border-gray-300 rounded-lg"
                            >
                                <option value="Mr.">Mr.</option>
                                <option value="Mrs.">Mrs.</option>
                                <option value="Ms.">Ms.</option>
                                <option value="Miss">Miss</option>
                                <option value="Master">Master</option>
                                <option value="Baby">Baby</option>
                                <option value="Dr.">Dr.</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Name"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold mb-1">Age</label>
                            <input
                                type="number"
                                placeholder="Age"
                                required
                                min="1"
                                max="150"
                                value={formData.age}
                                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">Gender</label>
                            <select
                                required
                                value={formData.gender}
                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Contact Number</label>
                        <input
                            type="tel"
                            placeholder="Mobile"
                            required
                            value={formData.mobile}
                            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Address</label>
                        <textarea
                            rows={2}
                            placeholder="Address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Referring Doctor</label>
                        <input
                            type="text"
                            list="doctors-list"
                            placeholder="Select or type doctor name"
                            value={formData.refDoctor}
                            onChange={(e) => setFormData({ ...formData, refDoctor: e.target.value })}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        />
                        <datalist id="doctors-list">
                            {doctors.map(d => (
                                <option key={d.id} value={d.name}>Dr. {d.name} ({d.specialization})</option>
                            ))}
                        </datalist>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="flex-1 bg-green-600 text-white py-2 rounded-lg"
                        >
                            <i className="fas fa-save mr-2"></i>Update
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowEditModal(false)}
                            className="px-6 bg-gray-300 py-2 rounded-lg"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Patient History Modal */}
            {historyPatient && (
                <PatientHistoryModal 
                    isOpen={!!historyPatient} 
                    onClose={() => setHistoryPatient(null)} 
                    patientId={historyPatient.id} 
                    patientName={historyPatient.name} 
                    ownerId={userProfile?.ownerId || user?.uid || ''}
                    role={userProfile?.role}
                />
            )}

            {/* Billing Modal */}
            <BillingModal 
                isOpen={showBillingModal} 
                onClose={() => setShowBillingModal(false)}
                patient={billingPatient}
                ownerId={userProfile?.ownerId || user?.uid || ''}
                userId={user?.uid || ''}
            />
            {/* Success/Creds Modal */}
            <Modal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)}>
                <div className="text-center p-2">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                        <i className="fas fa-check text-2xl text-green-600"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Patient Added!</h3>
                    <p className="text-sm text-gray-500 mb-6">Patient registered successfully. Proceed to collect sample.</p>

                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-left mb-6">
                        <div className="grid grid-cols-2 gap-4 mb-4 border-b border-gray-200 pb-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-semibold">Patient ID</p>
                                <p className="font-mono font-bold text-lg text-blue-600">{newPatientCreds?.patientId}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-semibold">Token Number</p>
                                <p className="font-mono font-bold text-lg text-purple-600">{newPatientCreds?.token}</p>
                            </div>
                        </div>

                    </div>

                    <div className="flex flex-col gap-3">
                        <Link
                            href={`/dashboard/samples?add=true&patientId=${newPatientCreds?.id}`}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transition flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-vial"></i> Step 2: Add Sample
                        </Link>
                        <button
                            onClick={() => setShowSuccessModal(false)}
                            className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition"
                        >
                            Done / Close
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">Credentials also available on printed RX/Invoice.</p>
                </div>
            </Modal>
        </div>
    );
}
