'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ref, onValue, push, update, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import { generatePatientId, generateTokenNumber } from '@/lib/idGenerator';
import { calculateBilling, createBillingItem, formatCurrency, generateInvoiceNumber } from '@/lib/billingCalculator';
import Modal from '@/components/Modal';
import { defaultTemplates } from '@/lib/defaultTemplates';

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
    const [visitPurpose, setVisitPurpose] = useState('lab');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

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

    // Form states
    const [formData, setFormData] = useState({
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
    const [billingItems, setBillingItems] = useState([createBillingItem('', 1, 0)]);
    const [discount, setDiscount] = useState(0);
    const [paid, setPaid] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [includeGST, setIncludeGST] = useState(false); // GST is optional, not pre-selected
    const [selectedTests, setSelectedTests] = useState<string[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [testSearch, setTestSearch] = useState('');
    const [doctorSearch, setDoctorSearch] = useState('');

    // Auto-load billing items when modal opens
    useEffect(() => {
        if (showBillingModal && billingPatient) {
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

                const latestDate = uniqueDates[0];
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
        }
    }, [showBillingModal, billingPatient, reports, templates]);

    useEffect(() => {
        if (!user || !userProfile) return;

        const dataSourceId = userProfile.ownerId || user.uid;

        const patientsRef = ref(database, `patients/${dataSourceId}`);
        const templatesRef = ref(database, `templates/${dataSourceId}`);
        const samplesRef = ref(database, `samples/${dataSourceId}`);
        const reportsRef = ref(database, `reports/${dataSourceId}`);

        const doctorsRef = ref(database, `doctors/${dataSourceId}`);

        const unsubPatients = onValue(patientsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setPatients(data);
            setFilteredPatients(data);
        });

        const unsubTemplates = onValue(templatesRef, (snapshot) => {
            const userTemplates: any[] = [];
            snapshot.forEach((child) => {
                userTemplates.push({ id: child.key, ...child.val() });
            });

            // Merge with local defaultTemplates using consistent ID generation
            const formattedDefaults = defaultTemplates.map((t, idx) => ({
                ...t,
                id: `SYS-${idx}-${t.name.replace(/\s+/g, '-')}`,
                isSystem: true
            }));

            const combined = [...userTemplates, ...formattedDefaults];
            setTemplates(combined);
        });

        const unsubSamples = onValue(samplesRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => { data.push({ id: child.key, ...child.val() }); });
            setSamples(data);
        });

        const unsubReports = onValue(reportsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => { data.push({ id: child.key, ...child.val() }); });
            setReports(data);
        });

        const unsubDoctors = onValue(doctorsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => { data.push({ id: child.key, ...child.val() }); });
            setDoctors(data);
        });

        return () => {
            unsubPatients();
            unsubTemplates();
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

        // Generate patient portal credentials
        const { generatePatientUsername } = await import('@/lib/userUtils');
        // Generate auto Patient ID and Token (using dataSourceId from line 155)
        const clinicName = userProfile?.labName || 'CLINIC';
        const patientId = await generatePatientId(dataSourceId, clinicName);
        const autoToken = await generateTokenNumber(dataSourceId);

        const brandName = userProfile?.labName || 'spot';
        const cleanMobile = formData.mobile.replace(/\D/g, '').slice(-10);
        const username = generatePatientUsername(cleanMobile, brandName);
        const password = cleanMobile; // Password is Mobile Number

        const patientData = {
            ...formData,
            patientId, // Auto-generated Patient ID
            age: parseInt(formData.age),
            registrationType: 'lab',
            token: autoToken, // Auto-generated Token
            createdAt: new Date().toISOString(),
            // Store credentials for patient portal
            credentials: {
                username,
                password, // In production, this should be hashed
                createdAt: new Date().toISOString()
            }
        };

        await push(ref(database, `patients/${dataSourceId}`), patientData);

        setShowAddModal(false);
        resetForm();

        showToast('Patient added successfully!', 'success');
    };

    const handleUpdatePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedPatient) return;
        if (!confirm('Are you sure you want to update this patient details?')) return;
        const dataSourceId = userProfile?.ownerId || user.uid;

        await update(ref(database, `patients/${dataSourceId}/${selectedPatient.id}`), {
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
                p.name,
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
                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                    <h2 className="text-xl font-bold text-gray-800">Patient Management</h2>
                    <div className="flex gap-2 flex-wrap">
                        <input
                            type="text"
                            placeholder="Search patients..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="px-4 py-2 border rounded-lg"
                        />
                        <button
                            onClick={exportToCSV}
                            className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-4 py-2 rounded-lg hover:shadow-lg"
                        >
                            <i className="fas fa-download mr-2"></i>Export CSV
                        </button>
                        {!isViewOnly && (
                            <button
                                onClick={openAddModal}
                                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-lg"
                            >
                                <i className="fas fa-plus mr-2"></i>Add Patient
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-full">
                        <thead className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Age/Gender</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Contact</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Address</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Ref. Dr</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
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
                                        <td className="px-4 py-3 text-sm">
                                            <span className="font-mono font-bold text-purple-600 text-xs">{patient.patientId || 'N/A'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span>{patient.name}</span>
                                                {patient.source === 'WEB' && (
                                                    <span className="text-blue-500" title="Booked from Web">
                                                        <i className="fas fa-globe"></i>
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{patient.age} / {patient.gender ? patient.gender[0] : '?'}</td>
                                        <td className="px-4 py-3 text-sm">{patient.mobile}</td>
                                        <td className="px-4 py-3 text-sm">{patient.address || 'N/A'}</td>
                                        <td className="px-4 py-3 text-sm">{patient.refDoctor || 'N/A'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {patient.createdAt ? new Date(patient.createdAt).toLocaleString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <button
                                                onClick={() => openViewModal(patient)}
                                                className="text-blue-600 hover:underline mr-2"
                                                title="View"
                                            >
                                                <i className="fas fa-eye"></i>
                                            </button>
                                            {!isViewOnly && (
                                                <>
                                                    <button
                                                        onClick={() => openEditModal(patient)}
                                                        className="text-green-600 hover:underline mr-2"
                                                        title="Edit"
                                                    >
                                                        <i className="fas fa-edit"></i>
                                                    </button>
                                                    <button onClick={() => { setBillingPatient(patient); setShowBillingModal(true); setBillingItems([createBillingItem('', 1, 0)]); setDiscount(0); setPaid(0); }} className="text-blue-600 hover:underline mr-2" title="Generate Bill"><i className="fas fa-file-invoice-dollar"></i></button>
                                                    <button onClick={() => handleDeletePatient(patient.id, patient.name)} className="text-gray-400 hover:text-red-600 transition-colors" title="Delete"><i className="fas fa-trash"></i></button>
                                                </>
                                            )}
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
                    {/* Mobile Number First - with duplicate detection */}
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
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            autoFocus
                        />
                        {duplicatePatient && (
                            <div className="mt-2 p-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                                <p className="text-sm font-bold text-yellow-800 mb-1">⚠️ Patient Already Exists!</p>
                                <p className="text-xs text-yellow-700"><strong>Name:</strong> {duplicatePatient.name}</p>
                                <p className="text-xs text-yellow-700"><strong>Age:</strong> {duplicatePatient.age} | <strong>Gender:</strong> {duplicatePatient.gender}</p>
                                <p className="text-xs text-yellow-700 mt-1"><strong>Patient ID:</strong> {duplicatePatient.patientId}</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        resetForm();
                                        // You can optionally navigate to this patient or open their record
                                    }}
                                    className="mt-2 w-full bg-yellow-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-yellow-700"
                                >
                                    Use Existing Patient
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold mb-1">Patient Name *</label>
                            <input
                                type="text"
                                placeholder="Patient Name"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    </div>
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

                    <div className="grid grid-cols-1 gap-3 items-end">
                        <div>
                            <label className="block text-sm font-semibold mb-1">Address *</label>
                            <input
                                type="text"
                                placeholder="Patient Address"
                                required
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    </div>
                    {/* Referring Doctor Selection */}
                    <div className="mb-4">
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
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 mb-2"
                        >
                            <option value="">Select Doctor</option>
                            {/* Merge and display all unique doctors */}
                            {[...doctors, ...externalDoctors]
                                .filter((d, index, self) =>
                                    index === self.findIndex((t) => t.name === d.name)
                                )
                                .map(d => (
                                    <option key={d.id} value={d.name}>Dr. {d.name}</option>
                                ))
                            }
                            <option value="__external__">➕ Add New Doctor</option>
                        </select>

                        {showExternalDoctorInput && (
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 space-y-2 animate-fade-in">
                                <p className="text-xs font-semibold text-yellow-800 mb-2">New External Doctor Details:</p>
                                <input
                                    type="text"
                                    placeholder="Doctor Name *"
                                    required
                                    value={formData.refDoctor}
                                    onChange={(e) => setFormData({ ...formData, refDoctor: e.target.value })}
                                    className="w-full px-3 py-2 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Clinic Name / Address *"
                                    required
                                    value={formData.externalDoctorClinic}
                                    onChange={(e) => setFormData({ ...formData, externalDoctorClinic: e.target.value })}
                                    className="w-full px-3 py-2 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1">💡 Select internal/external doctor or add a new one.</p>
                    </div>

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
                        <input
                            type="text"
                            placeholder="Name"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        />
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
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-purple-600">Report ID: {report.reportId}</div>
                                                        <div className="text-sm text-gray-600">Sample: {report.sampleId}</div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {new Date(report.createdAt).toLocaleString('en-IN', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${report.threatLevel === 'Critical' ? 'bg-red-100 text-red-700' :
                                                        report.threatLevel === 'High' ? 'bg-orange-100 text-orange-700' :
                                                            report.threatLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-green-100 text-green-700'
                                                        }`}>
                                                        {report.threatLevel || 'Normal'}
                                                    </span>
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
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {samples
                                        .filter(s => s.patientId === selectedPatient.id)
                                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                        .map(sample => (
                                            <div key={sample.id} className="bg-white border border-orange-200 rounded-lg p-2 text-sm">
                                                <div className="flex justify-between">
                                                    <div>
                                                        <span className="font-semibold text-orange-600">Sample: {sample.sampleNumber}</span>
                                                        <div className="text-xs text-gray-500">
                                                            {new Date(sample.createdAt).toLocaleDateString('en-IN')}
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${sample.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {sample.status}
                                                    </span>
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
                            defaultValue={(() => {
                                const vd = new Set<string>();
                                reports.filter(r => r.patientId === billingPatient?.id).forEach(r => {
                                    const d = r.createdAt || r.reportDate;
                                    if (d) vd.add(d.split('T')[0]);
                                });
                                const dates = Array.from(vd).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
                                return dates[0] || new Date().toISOString().split('T')[0];
                            })()}
                            onChange={(e) => {
                                const d = e.target.value;
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
                                reports.filter(r => r.patientId === billingPatient?.id).forEach(r => {
                                    const d = r.createdAt || r.reportDate;
                                    if (d) vd.add(d.split('T')[0]);
                                });
                                return Array.from(vd).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(dt => (
                                    <option key={dt} value={dt}>{new Date(dt).toLocaleDateString('en-IN')}</option>
                                ));
                            })()}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">{billingItems.filter(i => i.name && i.name !== 'No tests').length} lab tests found for this date</p>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100"><tr><th className="px-2 py-2 text-left">Item</th><th className="px-2 py-2 w-16">Qty</th><th className="px-2 py-2 w-24">Rate</th><th className="px-2 py-2 w-24">Amount</th><th className="w-8"></th></tr></thead>
                        <tbody>
                            {billingItems.map((item, i) => (
                                <tr key={i} className="border-b"><td className="px-2 py-2"><span className="text-sm font-medium">{item.name}</span></td><td className="px-2 py-2 text-center"><span className="text-sm">{item.quantity}</span></td><td className="px-2 py-2 text-right"><span className="text-sm">{formatCurrency(item.rate)}</span></td><td className="px-2 py-2 text-right font-medium text-sm">{formatCurrency(item.amount)}</td><td className="px-2 py-2">{billingItems.length > 1 && <button onClick={() => setBillingItems(billingItems.filter((_, idx) => idx !== i))} className="text-red-500 text-sm"><i className="fas fa-trash"></i></button>}</td></tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div><label className="text-sm font-medium">Discount (%)</label><input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded" min="0" max="100" /></div>
                            <div><label className="text-sm font-medium">Payment Mode</label><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full px-3 py-2 border rounded"><option>Cash</option><option>Card</option><option>UPI</option><option>Cheque</option></select></div>
                            <div><label className="text-sm font-medium">Paid</label><input type="number" value={paid} onChange={(e) => setPaid(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded" min="0" /></div>
                            <div className="flex items-center gap-2 pt-2"><input type="checkbox" id="includeGST" checked={includeGST} onChange={(e) => setIncludeGST(e.target.checked)} className="w-4 h-4" /><label htmlFor="includeGST" className="text-sm font-medium cursor-pointer">Include GST (18%)</label></div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded space-y-1 text-sm">
                            {(() => { const b = calculateBilling(billingItems.filter(i => i.name), discount, includeGST ? 18 : 0, paid); return (<><div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(b.subtotal)}</span></div>{b.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount:</span><span>- {formatCurrency(b.discount)}</span></div>}{includeGST && <div className="flex justify-between"><span>GST (18%):</span><span>{formatCurrency(b.gst)}</span></div>}<div className="flex justify-between font-bold text-lg border-t pt-1"><span>Total:</span><span>{formatCurrency(b.total)}</span></div><div className="flex justify-between text-blue-600"><span>Paid:</span><span>{formatCurrency(b.paid)}</span></div>{b.due > 0 && <div className="flex justify-between text-red-600 font-bold"><span>Due:</span><span>{formatCurrency(b.due)}</span></div>}</>); })()}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <button onClick={() => setShowBillingModal(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                        <button onClick={async () => {
                            if (!user || !billingPatient) return;
                            const dataSourceId = userProfile?.ownerId || user.uid;
                            const b = calculateBilling(billingItems.filter(i => i.name && i.name !== 'No tests'), discount, includeGST ? 18 : 0, paid);
                            const invNum = generateInvoiceNumber('INV', Date.now() % 100000);
                            const invData = {
                                invoiceNumber: invNum,
                                patientId: billingPatient.patientId || billingPatient.id,
                                patientName: billingPatient.name,
                                ...b,
                                paymentMode,
                                includeGST,
                                createdAt: new Date().toISOString(),
                                createdBy: user.uid
                            };
                            await push(ref(database, `invoices/${dataSourceId}`), invData);
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
                    <p className="text-sm text-gray-500 mb-6">Patient registered successfully. Share these credentials.</p>

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

                        <div className="bg-white p-4 rounded-lg border border-purple-100 shadow-sm">
                            <p className="text-xs font-bold text-purple-800 mb-3 uppercase flex items-center">
                                <i className="fas fa-key mr-2"></i> Patient Portal Access
                            </p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                    <span className="text-sm text-gray-600">Username:</span>
                                    <span className="font-mono font-bold text-gray-900 select-all">{newPatientCreds?.username}</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                    <span className="text-sm text-gray-600">Password:</span>
                                    <span className="font-mono font-bold text-gray-900 select-all">{newPatientCreds?.password}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowSuccessModal(false)}
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transition transform active:scale-95"
                    >
                        Done
                    </button>
                    <p className="text-xs text-gray-400 mt-2">Credentials also available on printed RX/Invoice.</p>
                </div>
            </Modal>
        </div>
    );
}
