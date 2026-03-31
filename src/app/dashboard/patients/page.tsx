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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
    const [billingItems, setBillingItems] = useState([createBillingItem('', 1, 0)]);
    const [discount, setDiscount] = useState(0);
    const [paid, setPaid] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [includeGST, setIncludeGST] = useState(false); // GST is optional, not pre-selected
    const [selectedTests, setSelectedTests] = useState<string[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [testSearch, setTestSearch] = useState('');
    const [customPrice, setCustomPrice] = useState('');
    const [doctorSearch, setDoctorSearch] = useState('');

    const updateBillingItem = (index: number, field: string, value: any) => {
        const newItems = [...billingItems];
        newItems[index] = { ...newItems[index], [field]: value };
        if (field === 'quantity' || field === 'rate') {
            newItems[index].amount = Math.round((newItems[index].quantity * newItems[index].rate) * 100) / 100;
        }
        setBillingItems(newItems);
    };

    const addTemplateToBilling = (template: any) => {
        const rate = parseFloat(template.totalPrice || template.price || 0);
        const newItem = createBillingItem(template.name, 1, rate);
        setBillingItems(prev => {
            const filtered = prev.filter(i => i.name && !['No tests', 'No reports found', 'No items found', ''].includes(i.name.trim()));
            return [...filtered, newItem];
        });
        setTestSearch('');
    };

    const addCustomBillingItem = () => {
        setBillingItems(prev => {
            const filtered = prev.filter(i => i.name && !['No tests', 'No reports found', 'No items found', ''].includes(i.name.trim()));
            const name = testSearch.trim() || '';
            const price = parseFloat(customPrice) || 0;
            return [...filtered, createBillingItem(name, 1, price)];
        });
        setTestSearch('');
        setCustomPrice('');
    };

    // Auto-load billing items when modal opens
    useEffect(() => {
        const loadBillingData = async () => {
            if (!showBillingModal || !billingPatient) return;

            const latestDate = new Date().toISOString().split('T')[0];
            setBillingDate(latestDate);

            // Attempt to load existing invoice first
            const dataSourceId = userProfile?.ownerId || user?.uid;
            if (dataSourceId) {
                try {
                    const invRef = ref(database, `invoices/${dataSourceId}/inv_${billingPatient.id}_${latestDate}`);
                    const invSnap = await get(invRef);
                    if (invSnap.exists()) {
                        const existInv = invSnap.val();
                        if (existInv.items && existInv.items.length > 0) {
                            setBillingItems(existInv.items);
                            setDiscount(existInv.discount || 0);
                            setPaid(existInv.paid || 0);
                            setPaymentMode(existInv.paymentMode || 'Cash');
                            setIncludeGST(existInv.includeGST || false);
                            return; 
                        }
                    }
                } catch (e) { console.error("Failed to load invoice:", e); }
            }

            // Get reports for this patient
            const patientReports = reports.filter(r => r.patientId === billingPatient.id);

            if (patientReports.length === 0) {
                setBillingItems([createBillingItem('No reports found', 1, 0)]);
            } else {
                // Robust Date Extraction
                const getDate = (r: any) => {
                    let d = r.createdAt || r.reportDate || r.date;
                    if (!d) return 'Unknown Date';
                    try {
                        if (typeof d === 'number') d = new Date(d).toISOString();
                        return d.split('T')[0];
                    } catch (e) { return 'Unknown Date'; }
                };

                const uniqueDates = Array.from(new Set(patientReports.map(getDate)));
                uniqueDates.sort((a, b) => {
                    if (a === 'Unknown Date') return 1;
                    if (b === 'Unknown Date') return -1;
                    return new Date(b).getTime() - new Date(a).getTime();
                });

                const rp = patientReports.filter(r => getDate(r) === latestDate);

                const ni: any[] = [];
                rp.forEach(r => {
                    // ROBUST MATCHING & PRICE DETECTION
                    // 1. Identify all tests listed in this report
                    const testNamesForThisReport = new Set<string>();
                    if (r.testName) {
                        r.testName.split(',').forEach((s: string) => testNamesForThisReport.add(s.trim()));
                    }
                    if (r.testDetails && Array.isArray(r.testDetails)) {
                        r.testDetails.forEach((td: any) => {
                            if (td.testName) testNamesForThisReport.add(td.testName.trim());
                        });
                    }
                    if (testNamesForThisReport.size === 0) testNamesForThisReport.add('Lab Report');

                    let finalItemName = Array.from(testNamesForThisReport).join(', ');
                    let finalItemPrice = 0;

                    // Strategy 1: Trust direct price in report if it exists
                    const reportPrice = parseFloat(String(r.price || r.amount || r.totalPrice || 0));

                    if (!isNaN(reportPrice) && reportPrice > 0) {
                        finalItemPrice = reportPrice;
                    } else {
                        // Strategy 2: Look up template prices for each test
                        let calculatedPrice = 0;
                        testNamesForThisReport.forEach(tn => {
                            const t = templates.find(tt =>
                                tt.name.toLowerCase().trim() === tn.toLowerCase() ||
                                (r.testId === tt.id || r.templateId === tt.id)
                            );
                            if (t) {
                                calculatedPrice += parseFloat(String(t.totalPrice || t.price || t.rate || 0));
                            } else if (r.testDetails) {
                                // Sub-strategy: check if testDetails has price for this specific test
                                const detail = r.testDetails.find((td: any) => td.testName === tn);
                                if (detail) {
                                    calculatedPrice += parseFloat(String(detail.price || detail.amount || 0));
                                }
                            }
                        });

                        // Strategy 3: Absolute fallback - sum ALL details price if calculation still 0
                        if (calculatedPrice === 0 && r.testDetails) {
                            calculatedPrice = r.testDetails.reduce((sum: number, td: any) => {
                                return sum + (parseFloat(String(td.price || td.amount || 0)) || 0);
                            }, 0);
                        }

                        finalItemPrice = calculatedPrice;
                    }

                    ni.push(createBillingItem(finalItemName, 1, finalItemPrice));
                });
                setBillingItems(ni.length > 0 ? ni : [createBillingItem('No items found', 1, 0)]);
            }
        };
        loadBillingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showBillingModal, billingPatient, reports, templates, userProfile, user]);

    useEffect(() => {
        if (!user || !userProfile) return;

        const dataSourceId = userProfile.ownerId || user.uid;

        const patientsRef = ref(database, `patients/${dataSourceId}`);
        const reportsRef = ref(database, `reports/${dataSourceId}`);
        const commonTemplatesRef = ref(database, 'common_templates');
        const doctorsRef = ref(database, `doctors/${dataSourceId}`);
        const templatesRef = ref(database, `templates/${dataSourceId}`); // Added templatesRef
        const samplesRef = ref(database, `samples/${dataSourceId}`); // Added samplesRef

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

        const unsubReports = onValue(reportsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => { data.push({ id: child.key, ...child.val() }); });
            data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setReports(data);
        });

        const unsubDoctors = onValue(doctorsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => { data.push({ id: child.key, ...child.val() }); });
            data.sort((a: any, b: any) => a.name.localeCompare(b.name));
            setDoctors(data);
        });

        return () => {
            unsubPatients();
            unsubTemplates();
            unsubCommon();
            unsubSamples();
            unsubReports();
            unsubDoctors();
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
            const doctorId = userProfile?.doctorId || user?.uid;
            const doctorName = userProfile?.name;

            basePatients = patients.filter(p => p.refDoctor === doctorName);
        }

        if (!searchQuery.trim()) {
            setFilteredPatients(basePatients);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredPatients(
                basePatients.filter(p =>
                    p.name.toLowerCase().includes(query) ||
                    p.mobile.includes(query) ||
                    (p.address && p.address.toLowerCase().includes(query))
                )
            );
        }
        setCurrentPage(1);
    }, [searchQuery, patients, userProfile, user]);

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

        await update(ref(database, `patients/${dataSourceId}/${selectedPatient.id}`), {
            title: formData.title,
            name: formData.name,
            age: parseInt(formData.age),
            gender: formData.gender,
            mobile: formData.mobile,
            address: formData.address,
            refDoctor: formData.refDoctor,
            updatedAt: new Date().toISOString()
        });

        setShowEditModal(false);
        resetForm();
        showToast('Patient updated!', 'success');
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
                                                    onClick={() => openViewModal(patient)}
                                                    className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                                                    title="View"
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
                                                                setBillingItems([createBillingItem('', 1, 0)]);
                                                                setDiscount(0);
                                                                setPaid(0);
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

            {/* View Patient History Modal */}
            <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)}>
                <h3 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-3">
                    <i className="fas fa-user-circle mr-2 text-blue-600"></i>
                    Patient Complete History
                </h3>
                {selectedPatient && (
                    <div className="max-h-[70vh] overflow-y-auto">
                        {/* Patient Basic Info */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-4 border border-blue-200">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                <div><strong className="text-gray-700">Name:</strong> <span className="text-gray-900">{selectedPatient.name}</span></div>
                                <div><strong className="text-gray-700">Age/Gender:</strong> <span className="text-gray-900">{selectedPatient.age} / {selectedPatient.gender}</span></div>
                                <div><strong className="text-gray-700">Contact:</strong> <span className="text-gray-900">{selectedPatient.mobile}</span></div>
                                <div><strong className="text-gray-700">Patient ID:</strong> <span className="font-mono text-purple-600">{selectedPatient.patientId || 'N/A'}</span></div>
                                <div><strong className="text-gray-700">Ref. Doctor:</strong> <span className="text-gray-900">{selectedPatient.refDoctor || 'N/A'}</span></div>
                                <div><strong className="text-gray-700">Address:</strong> <span className="text-gray-900">{selectedPatient.address || 'N/A'}</span></div>
                            </div>
                        </div>

                        {/* Lab Reports History */}
                        <div className="mb-4">
                            <h4 className="font-bold text-lg mb-2 text-purple-700 flex items-center">
                                <i className="fas fa-file-medical mr-2"></i>
                                Lab Reports ({reports.filter(r => r.patientId === selectedPatient.id).length})
                            </h4>
                            {reports.filter(r => r.patientId === selectedPatient.id).length === 0 ? (
                                <p className="text-gray-500 text-sm italic pl-6">No lab reports found</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {reports
                                        .filter(r => r.patientId === selectedPatient.id)
                                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                        .map(report => (
                                            <div key={report.id} className="bg-white border border-purple-200 rounded-lg p-3 hover:shadow-md transition">
                                                <div className="flex justify-between items-center text-sm gap-4">
                                                    <div className="flex-1 flex items-center gap-4 min-w-0">
                                                        <div className="font-semibold text-purple-600 truncate flex-shrink-0 max-w-[40%]" title={report.testName}>
                                                            {report.testName || 'Report'} <span className="text-gray-400 text-xs font-mono">({report.reportId})</span>
                                                        </div>
                                                        <div className="text-gray-600 truncate min-w-0" title={`Sample: ${report.sampleId}`}>
                                                            Smpl: {report.sampleId}
                                                        </div>
                                                        <div className="text-gray-500 text-xs whitespace-nowrap hidden sm:block">
                                                            {new Date(report.createdAt).toLocaleString('en-IN', {
                                                                day: '2-digit', month: 'short', year: '2-digit'
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${report.threatLevel === 'Critical' ? 'bg-red-100 text-red-700' :
                                                            report.threatLevel === 'High' ? 'bg-orange-100 text-orange-700' :
                                                                report.threatLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-green-100 text-green-700'
                                                            }`}>
                                                            {report.threatLevel || 'Normal'}
                                                        </span>
                                                        <button
                                                            onClick={() => window.open(`/print/report/${report.id}`, '_blank')}
                                                            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-2.5 py-1 rounded text-xs font-bold hover:shadow-lg transition flex items-center gap-1"
                                                            title="Print PDF"
                                                        >
                                                            <i className="fas fa-print"></i> <span className="hidden sm:inline">PDF</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Samples History */}
                        <div className="mb-4">
                            <h4 className="font-bold text-lg mb-2 text-orange-700 flex items-center">
                                <i className="fas fa-vial mr-2"></i>
                                Lab Samples ({samples.filter(s => s.patientId === selectedPatient.id).length})
                            </h4>
                            {samples.filter(s => s.patientId === selectedPatient.id).length === 0 ? (
                                <p className="text-gray-500 text-sm italic pl-6">No samples found</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {samples
                                        .filter(s => s.patientId === selectedPatient.id)
                                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                        .map(sample => (
                                            <div key={sample.id} className="bg-white border border-orange-200 rounded-lg p-2 hover:shadow-md transition text-sm">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                                        {/* Top Row: IDs & Secondary Details */}
                                                        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-[11px] text-gray-500">
                                                            <span className="font-bold text-orange-600 whitespace-nowrap text-sm">Smpl: {sample.sampleNumber}</span>
                                                            
                                                            {sample.sampleType && (
                                                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                    <i className="fas fa-vial mr-1"></i> {sample.sampleType}
                                                                </span>
                                                            )}
                                                            <span className="whitespace-nowrap"><i className="far fa-calendar-alt mr-1"></i>{new Date(sample.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                                                            {sample.collectedBy && <span className="whitespace-nowrap truncate max-w-[120px]"><i className="fas fa-user-nurse mr-1"></i>{sample.collectedBy}</span>}
                                                            {selectedPatient.refDoctor && <span className="whitespace-nowrap truncate max-w-[120px]"><i className="fas fa-user-md mr-1"></i>{selectedPatient.refDoctor}</span>}
                                                        </div>

                                                        {/* Bottom Row: Selected Tests */}
                                                        {sample.tests && Array.isArray(sample.tests) && sample.tests.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                                {sample.tests.map((t: string, i: number) => (
                                                                    <span key={i} className="bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-200 whitespace-nowrap">
                                                                        {t}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex items-center flex-shrink-0 mt-1">
                                                        <span className={`px-2 py-1 rounded text-[11px] font-semibold ${sample.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                            sample.status === 'Processing' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                            {sample.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <button
                    onClick={() => setShowViewModal(false)}
                    className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white py-3 rounded-lg hover:from-gray-600 hover:to-gray-700 transition font-semibold mt-4"
                >
                    <i className="fas fa-times mr-2"></i>
                    Close
                </button>
            </Modal>

            {/* Billing Modal */}
            <Modal isOpen={showBillingModal} onClose={() => setShowBillingModal(false)}>
                <h3 className="text-xl font-bold mb-4">Generate Bill - {billingPatient?.name}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold mb-1 block">Visit Date</label>
                        <select
                            className="w-full px-3 py-2 border rounded"
                            value={billingDate}
                            onChange={async (e) => {
                                const d = e.target.value;
                                setBillingDate(d);
                                
                                const dataSourceId = userProfile?.ownerId || user?.uid;
                                if (dataSourceId) {
                                    try {
                                        const invRef = ref(database, `invoices/${dataSourceId}/inv_${billingPatient.id}_${d}`);
                                        const invSnap = await get(invRef);
                                        if (invSnap.exists()) {
                                            const existInv = invSnap.val();
                                            if (existInv.items && existInv.items.length > 0) {
                                                setBillingItems(existInv.items);
                                                setDiscount(existInv.discount || 0);
                                                setPaid(existInv.paid || 0);
                                                setPaymentMode(existInv.paymentMode || 'Cash');
                                                setIncludeGST(existInv.includeGST || false);
                                                return;
                                            }
                                        }
                                    } catch (err) {}
                                }

                                const rp = reports.filter(r => r.patientId === billingPatient?.id && (r.createdAt?.startsWith(d) || r.reportDate?.startsWith(d)));
                                const ni = [];
                                rp.forEach(r => {
                                    // ROBUST MATCHING & PRICE DETECTION
                                    const testNamesForThisReport = new Set<string>();
                                    if (r.testName) {
                                        r.testName.split(',').forEach((s: string) => testNamesForThisReport.add(s.trim()));
                                    }
                                    if (r.testDetails && Array.isArray(r.testDetails)) {
                                        r.testDetails.forEach((td: any) => {
                                            if (td.testName) testNamesForThisReport.add(td.testName.trim());
                                        });
                                    }
                                    if (testNamesForThisReport.size === 0) testNamesForThisReport.add('Lab Report');

                                    let finalItemName = Array.from(testNamesForThisReport).join(', ');
                                    let finalItemPrice = 0;

                                    // Strategy 1: Trust direct price in report if it exists
                                    const reportPrice = parseFloat(String(r.price || r.amount || r.totalPrice || 0));

                                    if (!isNaN(reportPrice) && reportPrice > 0) {
                                        finalItemPrice = reportPrice;
                                    } else {
                                        // Strategy 2: Look up template prices for each test
                                        let calculatedPrice = 0;
                                        testNamesForThisReport.forEach(tn => {
                                            const t = templates.find(tt =>
                                                tt.name.toLowerCase().trim() === tn.toLowerCase() ||
                                                (r.testId === tt.id || r.templateId === tt.id)
                                            );
                                            if (t) {
                                                calculatedPrice += parseFloat(String(t.totalPrice || t.price || t.rate || 0));
                                            } else if (r.testDetails) {
                                                const detail = r.testDetails.find((td: any) => td.testName === tn);
                                                if (detail) {
                                                    calculatedPrice += parseFloat(String(detail.price || detail.amount || 0));
                                                }
                                            }
                                        });

                                        // Strategy 3: Absolute fallback - sum ALL details price
                                        if (calculatedPrice === 0 && r.testDetails) {
                                            calculatedPrice = r.testDetails.reduce((sum: number, td: any) => {
                                                return sum + (parseFloat(String(td.price || td.amount || 0)) || 0);
                                            }, 0);
                                        }

                                        finalItemPrice = calculatedPrice;
                                    }

                                    ni.push(createBillingItem(finalItemName, 1, finalItemPrice));
                                });
                                setBillingItems(ni.length > 0 ? ni : [createBillingItem('No tests', 1, 0)]);
                            }}
                        >
                            {(() => {
                                const vd = new Set<string>();
                                const today = new Date().toISOString().split('T')[0];
                                vd.add(today); // Always include today
                                reports.filter(r => r.patientId === billingPatient?.id).forEach(r => {
                                    const d = r.createdAt || r.reportDate;
                                    if (d) vd.add(d.split('T')[0]);
                                });
                                return Array.from(vd).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(dt => (
                                    <option key={dt} value={dt}>{dt === today ? `Today (${new Date(dt).toLocaleDateString('en-IN')})` : new Date(dt).toLocaleDateString('en-IN')}</option>
                                ));
                            })()}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">{billingItems.filter(i => i.name && i.name !== 'No tests').length} lab tests found for this date</p>
                    </div>
                    <div className="relative">
                        <label className="text-sm font-bold mb-1 block">Quick Add Item</label>
                        <div className="flex gap-2">
                            <div className="relative flex-[2]">
                                <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                                <input
                                    type="text"
                                    placeholder="Search template or type custom name..."
                                    value={testSearch}
                                    onChange={(e) => setTestSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div className="relative flex-1">
                                <i className="fas fa-tag absolute left-3 top-3 text-gray-400"></i>
                                <input
                                    type="number"
                                    placeholder="Price"
                                    value={customPrice}
                                    onChange={(e) => setCustomPrice(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                                />
                            </div>
                            <button
                                onClick={addCustomBillingItem}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold text-sm whitespace-nowrap shadow-md"
                            >
                                <i className="fas fa-plus mr-1"></i> Add Custom
                            </button>
                        </div>

                        {testSearch && (
                            <div className="absolute z-[60] w-full mt-1 bg-white border-2 border-blue-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                {templates
                                    .filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase()))
                                    .slice(0, 10)
                                    .map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => addTemplateToBilling(t)}
                                            className="w-full text-left px-4 py-3 hover:bg-blue-50 flex justify-between items-center border-b last:border-0 transition-colors"
                                        >
                                            <div>
                                                <div className="font-bold text-gray-800">{t.name}</div>
                                                <div className="text-xs text-gray-500">{t.category}</div>
                                            </div>
                                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold text-sm">
                                                ₹{t.totalPrice || t.price || 0}
                                            </span>
                                        </button>
                                    ))
                                }
                                {templates.filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase())).length === 0 && (
                                    <div className="px-4 py-4 text-center text-gray-500">
                                        <i className="fas fa-search mb-2 block opacity-20 text-2xl"></i>
                                        No matching templates found.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Service/Item</th>
                                    <th className="px-3 py-2 w-20 text-center font-semibold text-gray-600">Qty</th>
                                    <th className="px-3 py-2 w-28 text-right font-semibold text-gray-600">Rate</th>
                                    <th className="px-3 py-2 w-28 text-right font-semibold text-gray-600">Amount</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {billingItems.map((item, i) => {
                                    const isPlaceholder = ['No tests', 'No reports found', 'No items found', ''].includes((item.name || '').trim());
                                    return (
                                        <tr key={item.id || i} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => updateBillingItem(i, 'name', e.target.value)}
                                                    placeholder="e.g. CBC Test, Consultation..."
                                                    className={`w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 ${isPlaceholder ? 'text-gray-400 italic' : 'font-medium'}`}
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateBillingItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-full text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                                                    min="1"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    value={item.rate}
                                                    onChange={(e) => updateBillingItem(i, 'rate', parseFloat(e.target.value) || 0)}
                                                    className="w-full text-right bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 font-semibold"
                                                    min="0"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-gray-700">
                                                {formatCurrency(item.amount)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {billingItems.length > 1 && (
                                                    <button
                                                        onClick={() => setBillingItems(billingItems.filter((_, idx) => idx !== i))}
                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <i className="fas fa-trash-alt"></i>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div><label className="text-sm font-medium">Discount (%)</label><input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded" min="0" max="100" /></div>
                            <div><label className="text-sm font-medium">Payment Mode</label><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full px-3 py-2 border rounded"><option>Cash</option><option>Card</option><option>UPI</option><option>Cheque</option></select></div>
                            <div><label className="text-sm font-medium">Paid</label><input type="number" value={paid} onChange={(e) => setPaid(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded" min="0" /></div>
                            <div className="flex items-center gap-2 pt-2"><input type="checkbox" id="includeGST" checked={includeGST} onChange={(e) => setIncludeGST(e.target.checked)} className="w-4 h-4" /><label htmlFor="includeGST" className="text-sm font-medium cursor-pointer">Include GST (18%)</label></div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-sm">
                            {(() => {
                                const validItems = billingItems.filter(i => i.name && !['No tests', 'No reports found', 'No items found', ''].includes(i.name.trim()));
                                const b = calculateBilling(validItems, discount, includeGST ? 18 : 0, paid);
                                return (
                                    <>
                                        <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span>{formatCurrency(b.subtotal)}</span></div>
                                        {b.discount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Discount ({discount}%):</span><span>- {formatCurrency(b.discount)}</span></div>}
                                        {includeGST && <div className="flex justify-between text-gray-600"><span>GST (18%):</span><span>{formatCurrency(b.gst)}</span></div>}
                                        <div className="flex justify-between font-bold text-xl border-t border-gray-300 pt-2 mt-2 text-gray-900"><span>Total:</span><span>{formatCurrency(b.total)}</span></div>
                                        <div className="flex justify-between text-blue-600 font-medium"><span>Paid:</span><span>{formatCurrency(b.paid)}</span></div>
                                        {b.due > 0 && <div className="flex justify-between text-red-600 font-bold border-t border-red-100 pt-1 mt-1"><span>Due Amount:</span><span>{formatCurrency(b.due)}</span></div>}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <button onClick={() => setShowBillingModal(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                        <button onClick={async () => {
                            const validItems = billingItems.filter(i => i.name && !['No tests', 'No reports found', 'No items found', ''].includes(i.name.trim()));
                            if (validItems.length === 0) {
                                alert('Please add at least one valid item to the bill.');
                                return;
                            }
                            const dataSourceId = userProfile?.ownerId || user.uid;
                            const b = calculateBilling(validItems, discount, includeGST ? 18 : 0, paid);
                            const invoiceKey = `inv_${billingPatient.id}_${billingDate}`;
                            
                            // Check if invoice already exists to preserve its Original ID and Date
                            const invRef = ref(database, `invoices/${dataSourceId}/${invoiceKey}`);
                            const invSnap = await get(invRef);
                            
                            let invNum = generateInvoiceNumber('INV', Math.floor(Date.now() / 1000) % 10000);
                            let createdAt = new Date().toISOString();
                            
                            if (invSnap.exists()) {
                                const existingData = invSnap.val();
                                if (existingData.invoiceNumber) invNum = existingData.invoiceNumber;
                                if (existingData.createdAt) createdAt = existingData.createdAt;
                            }
                            
                            const invData = {
                                invoiceId: invoiceKey,
                                invoiceNumber: invNum,
                                patientId: billingPatient.patientId || billingPatient.id,
                                patientName: billingPatient.name,
                                ...b,
                                items: validItems, // Store items in invoice
                                paymentMode,
                                includeGST,
                                visitDate: billingDate,
                                createdAt: createdAt,
                                createdBy: user.uid
                            };
                            await update(invRef, invData);
                            window.open(`/print/invoice/${invNum}?data=${encodeURIComponent(JSON.stringify(invData))}`, '_blank');
                            setShowBillingModal(false);
                        }} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            <i className="fas fa-print mr-2"></i>Save & Print
                        </button>
                    </div>
                </div>
            </Modal>
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
