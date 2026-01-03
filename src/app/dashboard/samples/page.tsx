'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ref, onValue, push, update, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import { generateSampleId } from '@/lib/idGenerator';
import { useRouter, useSearchParams } from 'next/navigation';
import Modal from '@/components/Modal';
import { defaultTemplates } from '@/lib/defaultTemplates';
import { useSubscription } from '@/contexts/SubscriptionContext';

export default function SamplesPage() {
    const { user, userProfile } = useAuth();
    const { showToast } = useToast();
    const { isPremium } = useSubscription();
    const searchParams = useSearchParams();
    const router = useRouter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [samples, setSamples] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [filteredSamples, setFilteredSamples] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [patients, setPatients] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [templates, setTemplates] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [branding, setBranding] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [testSearch, setTestSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedSample, setSelectedSample] = useState<any>(null);

    const sampleTypeOptions = [
        'Whole Blood', 'Serum', 'Plasma', 'Urine', 'Stool',
        'Sputum', 'Swab', 'CSF', 'Fluid', 'Tissue', 'Other', 'Semen'
    ];

    // Form states
    const [formData, setFormData] = useState({
        sampleNumber: '',
        patientId: '',
        sampleType: '',
        date: '',
        status: 'Pending',
        collectionCondition: 'Random',
        containerType: 'Plain Vial',
        priority: 'Routine',
        collectedBy: '',
        remarks: '',
        selectedTests: [] as string[]
    });

    useEffect(() => {
        if (!user || !userProfile) return;

        const dataSourceId = userProfile.ownerId || user.uid;
        const samplesRef = ref(database, `samples/${dataSourceId}`);
        const patientsRef = ref(database, `patients/${dataSourceId}`);
        const templatesRef = ref(database, `templates/${dataSourceId}`);
        const commonTemplatesRef = ref(database, 'common_templates');
        const brandingRef = ref(database, `branding/${dataSourceId}`);

        const unsubSamples = onValue(samplesRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
            data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setSamples(data);
            setFilteredSamples(data);
        });

        const unsubPatients = onValue(patientsRef, (snapshot) => {
            const data: any[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
            setPatients(data);
        });

        const unsubTemplates = onValue(templatesRef, (snapshot) => {
            const userTemplates: any[] = [];
            snapshot.forEach((child) => {
                userTemplates.push({ id: child.key, ...child.val() });
            });

            // Merge with local default templates
            const formattedDefaults = defaultTemplates.map((t, idx) => ({
                ...t,
                id: `SYS-${idx}-${t.name.replace(/\s+/g, '-')}`,
                isSystem: true
            }));

            // Combine: User templates first (could override system ones if we had name collision logic, but for now just appending)
            const combined = [...userTemplates, ...formattedDefaults];
            setTemplates(combined);
        });

        const unsubBranding = onValue(brandingRef, (snapshot) => {
            setBranding(snapshot.val());
        });

        return () => {
            unsubSamples();
            unsubPatients();
            unsubTemplates();
            unsubBranding();
        };
    }, [user, userProfile]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredSamples(samples);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredSamples(
                samples.filter(s => {
                    const patient = patients.find(p => p.id === s.patientId);
                    const patientName = patient ? patient.name.toLowerCase() : '';
                    const mobile = patient ? String(patient.mobile).toLowerCase() : '';
                    return (
                        s.sampleNumber.toLowerCase().includes(query) ||
                        patientName.includes(query) ||
                        mobile.includes(query) ||
                        s.sampleType.toLowerCase().includes(query)
                    );
                })
            );
        }
        setCurrentPage(1);
    }, [searchQuery, samples, patients]);


    const handleAddSample = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (patients.length === 0) {
            showToast('Please add patients first', 'warning');
            return;
        }

        if (formData.selectedTests.length === 0) {
            showToast('Please select at least one test', 'warning');
            return;
        }

        const patient = patients.find(p => p.id === formData.patientId);
        const selectedTemplates = templates.filter(t => formData.selectedTests.includes(t.id));

        // Generate Auto Sample ID
        const dataSourceId = userProfile?.ownerId || user.uid;
        const sampleId = await generateSampleId(dataSourceId, userProfile?.labName || 'CLINIC');

        const sampleData = {
            sampleId, // Auto-generated Sample ID
            sampleNumber: sampleId, // Keep for backward compatibility
            patientId: formData.patientId,
            patientName: patient?.name || '',
            sampleType: formData.sampleType,
            date: formData.date,
            status: formData.status,
            tests: selectedTemplates.map(t => t.name),
            testIds: formData.selectedTests,
            // Don't store full template objects - they can cause circular reference errors
            // Templates will be loaded from the templates collection when needed
            createdAt: new Date().toISOString()
        };

        await push(ref(database, `samples/${dataSourceId}`), sampleData);
        setShowAddModal(false);
        resetForm();
        showToast(`Sample collected!\n\nSample ID: ${sampleId}`, 'success', 5000);
    };

    const handleTestToggle = (testId: string) => {
        setFormData(prev => {
            const currentTests = prev.selectedTests || [];
            if (currentTests.includes(testId)) {
                return { ...prev, selectedTests: currentTests.filter(id => id !== testId) };
            } else {
                return { ...prev, selectedTests: [...currentTests, testId] };
            }
        });
    };

    const handleSampleTypeToggle = (type: string) => {
        setFormData(prev => {
            const current = prev.sampleType ? prev.sampleType.split(', ').filter(Boolean) : [];
            let updated;
            if (current.includes(type)) {
                updated = current.filter(t => t !== type);
            } else {
                updated = [...current, type];
            }
            return { ...prev, sampleType: updated.join(', ') };
        });
    };

    const handleUpdateSample = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedSample) return;
        if (!confirm('Are you sure you want to update this sample?')) return;

        const selectedTemplates = templates.filter(t => formData.selectedTests.includes(t.id));

        await update(ref(database, `samples/${userProfile?.ownerId || user.uid}/${selectedSample.id}`), {
            sampleNumber: formData.sampleNumber,
            patientId: formData.patientId,
            sampleType: formData.sampleType,
            date: formData.date,
            status: formData.status,
            tests: selectedTemplates.map(t => t.name),
            testIds: formData.selectedTests,
            updatedAt: new Date().toISOString()
        });

        setShowEditModal(false);
        resetForm();
        showToast('Sample updated!', 'success');
    };

    const handleUpdateStatus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedSample) return;
        if (!confirm('Are you sure you want to update the sample status?')) return;

        await update(ref(database, `samples/${userProfile?.ownerId || user.uid}/${selectedSample.id}`), {
            status: formData.status,
            updatedAt: new Date().toISOString()
        });

        setShowStatusModal(false);
        resetForm();
        showToast('Sample status updated!', 'success');
    };

    const handleDeleteSample = async (sampleId: string) => {
        if (!user) return;
        if (!confirm('Delete this sample?')) return;

        await remove(ref(database, `samples/${userProfile?.ownerId || user.uid}/${sampleId}`));
        showToast('Sample deleted!', 'success');
    };

    const openAddModal = async () => {
        if (!user) return;

        const dataSourceId = userProfile?.ownerId || user.uid;
        // Generate Auto Sample ID
        const sampleId = await generateSampleId(dataSourceId, userProfile?.labName || 'CLINIC');

        setTestSearch('');
        setFormData({
            sampleNumber: sampleId,
            patientId: '',
            sampleType: '',
            containerType: 'Plain Vial',
            priority: 'Routine',
            collectedBy: '',
            remarks: '',
            date: new Date().toISOString().slice(0, 16),
            status: 'Pending',
            collectionCondition: 'Random',
            selectedTests: []
        });
        setShowAddModal(true);
    };

    useEffect(() => {
        const action = searchParams.get('action');
        const paramPatientId = searchParams.get('patientId');

        if (action === 'add' && !showAddModal) {
            openAddModal().then(() => {
                if (paramPatientId) {
                    setFormData(prev => ({ ...prev, patientId: paramPatientId }));
                }
            });
        }
    }, [searchParams]);

    const openEditModal = (sample: any) => {
        setTestSearch('');
        setSelectedSample(sample);
        setFormData({
            sampleNumber: sample.sampleNumber,
            patientId: sample.patientId,
            sampleType: sample.sampleType,
            collectionCondition: sample.collectionCondition || 'Random',
            containerType: sample.containerType || 'Plain Vial',
            priority: sample.priority || 'Routine',
            collectedBy: sample.collectedBy || '',
            remarks: sample.remarks || '',
            date: sample.date.replace('Z', '').slice(0, 16),
            status: sample.status,
            selectedTests: sample.testIds || [] // Preserve existing selected tests if any
        });
        setShowEditModal(true);
    };

    const openStatusModal = (sample: any) => {
        setSelectedSample(sample);
        setFormData(prev => ({
            ...prev,
            status: sample.status
        }));
        setShowStatusModal(true);
    };

    const resetForm = () => {
        setFormData({
            sampleNumber: '',
            patientId: '',
            sampleType: '',
            containerType: 'Plain Vial',
            priority: 'Routine',
            collectedBy: '',
            remarks: '',
            date: '',
            status: 'Pending',
            collectionCondition: 'Random',
            selectedTests: []
        });
    };

    // Pagination
    const totalPages = Math.ceil(filteredSamples.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedSamples = filteredSamples.slice(startIndex, startIndex + itemsPerPage);

    const statusColors = {
        'Pending': 'bg-orange-100 text-orange-800',
        'Processing': 'bg-blue-100 text-blue-800',
        'Completed': 'bg-green-100 text-green-800'
    };

    return (
        <div>
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                    <h2 className="text-xl font-bold text-gray-800">Sample Collection</h2>
                    <div className="flex gap-2 flex-wrap">
                        <input
                            type="text"
                            placeholder="Search samples..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="px-4 py-2 border rounded-lg"
                        />
                        <button
                            onClick={openAddModal}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-lg"
                        >
                            <i className="fas fa-plus mr-2"></i>Add Sample
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-full">
                        <thead className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Sample ID</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Patient Name</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Mobile</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Sample Type</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Collection Date</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedSamples.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                        <i className="fas fa-flask text-4xl mb-2 opacity-20"></i>
                                        <p>No samples found</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedSamples.map(sample => {
                                    const patient = patients.find(p => p.id === sample.patientId);
                                    const patientName = patient ? patient.name : 'Unknown Patient';

                                    return (
                                        <tr key={sample.id} className="border-b hover:bg-gray-50 transition">
                                            <td className="px-4 py-3 text-sm font-semibold text-purple-600">
                                                {sample.sampleNumber}
                                                {sample.priority && sample.priority !== 'Routine' && (
                                                    <span className={`block mt-1 text-xs w-fit px-1.5 py-0.5 rounded ${sample.priority === 'Emergency' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {sample.priority}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold">{patientName}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-600">{patient?.mobile || 'N/A'}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-medium">{sample.sampleType}</div>
                                                <div className="text-xs text-gray-500">{sample.containerType}</div>
                                                <div className="text-xs text-blue-500">{sample.collectionCondition}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {new Date(sample.date).toLocaleString('en-IN')}
                                                {sample.collectedBy && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        <i className="fas fa-user-nurse mr-1"></i>{sample.collectedBy}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`status-badge ${statusColors[sample.status as keyof typeof statusColors]}`}>
                                                    {sample.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm flex items-center">
                                                <button
                                                    onClick={() => openEditModal(sample)}
                                                    className="text-green-600 hover:text-green-800 transition-colors mr-3"
                                                    title="Edit"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button
                                                    onClick={() => openStatusModal(sample)}
                                                    className="text-blue-600 hover:text-blue-800 transition-colors mr-3"
                                                    title="Update Status"
                                                >
                                                    <i className="fas fa-sync"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSample(sample.id)}
                                                    className="text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Delete"
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
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

            {/* Add Sample Modal */}
            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
                <h3 className="text-xl font-bold mb-4">
                    <i className="fas fa-flask text-blue-600 mr-2"></i>Add Sample
                </h3>
                {/* Debug log removed */}
                <form onSubmit={handleAddSample} className="space-y-3">
                    <div>
                        <label className="block text-sm font-semibold mb-1">Sample ID (Auto-generated)</label>
                        <input
                            type="text"
                            value={formData.sampleNumber}
                            readOnly
                            required
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-gray-600"
                        />
                    </div>
                    <select
                        value={formData.patientId}
                        onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                        required
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                    >
                        <option value="">Choose Patient</option>
                        {patients.map(p => (
                            <option key={p.id} value={p.id}>{p.name} - {p.mobile}</option>
                        ))}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold mb-2 text-gray-700">Sample Types (Multi-select)</label>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-1 mb-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                                {sampleTypeOptions.map(type => (
                                    <label key={type} className="flex items-center space-x-1 text-[10px] font-semibold cursor-pointer hover:bg-gray-100 p-1 rounded transition">
                                        <input
                                            type="checkbox"
                                            checked={formData.sampleType ? formData.sampleType.split(', ').includes(type) : false}
                                            onChange={() => handleSampleTypeToggle(type)}
                                            className="form-checkbox h-3 w-3 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                                        />
                                        <span className="truncate">{type}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                            value={(formData as any).collectionCondition || 'Random'}
                            onChange={(e) => setFormData({ ...formData, collectionCondition: e.target.value } as any)}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg md:col-span-2"
                        >
                            <option value="Random">Random</option>
                            <option value="Fasting">Fasting</option>
                            <option value="Post-Prandial">Post-Prandial (PP)</option>
                            <option value="Pre-Meal">Pre-Meal</option>
                            <option value="Early Morning">Early Morning</option>
                        </select>

                        <select
                            value={(formData as any).containerType || 'Plain Vial'}
                            onChange={(e) => setFormData({ ...formData, containerType: e.target.value } as any)}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        >
                            <option value="Plain Vial">Plain Vial (Red)</option>
                            <option value="EDTA">EDTA (Purple)</option>
                            <option value="Fluoride">Fluoride (Grey)</option>
                            <option value="Citrate">Citrate (Blue)</option>
                            <option value="Heparin">Heparin (Green)</option>
                            <option value="Urine Container">Urine Container</option>
                            <option value="Sterile Container">Sterile Container</option>
                            <option value="Slide">Slide</option>
                            <option value="Swab Stick">Swab Stick</option>
                            <option value="Other">Other</option>
                        </select>

                        <select
                            value={(formData as any).priority || 'Routine'}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value } as any)}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        >
                            <option value="Routine">Routine</option>
                            <option value="Urgent">Urgent (STAT)</option>
                            <option value="Emergency">Emergency</option>
                        </select>

                        <input
                            type="datetime-local"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        />
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        >
                            <option value="Pending">Pending</option>
                            <option value="Processing">Processing</option>
                            <option value="Completed">Completed</option>
                        </select>

                        <input
                            type="text"
                            placeholder="Collected By (Phlebotomist Name) *"
                            value={(formData as any).collectedBy || ''}
                            onChange={(e) => setFormData({ ...formData, collectedBy: e.target.value } as any)}
                            required
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        />
                        <input
                            type="text"
                            placeholder="Clinical Remarks / Notes"
                            value={(formData as any).remarks || ''}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value } as any)}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        />
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <label className="block text-sm font-semibold mb-2 text-gray-700">Select Tests Requirements</label>
                        <input
                            type="text"
                            placeholder="Search tests..."
                            value={testSearch}
                            onChange={(e) => setTestSearch(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg mb-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <div className="h-48 max-h-48 overflow-y-auto space-y-1 bg-white border rounded-lg p-2 text-xs">
                            {templates.length === 0 ? (
                                <p className="text-xs text-gray-500 text-center py-2">No templates found</p>
                            ) : (
                                templates
                                    .filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase()))
                                    .map(t => (
                                        <label key={t.id} className="flex items-center gap-2 p-2 hover:bg-blue-50 rounded cursor-pointer transition">
                                            <input
                                                type="checkbox"
                                                checked={formData.selectedTests?.includes(t.id)}
                                                onChange={() => handleTestToggle(t.id)}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">{t.name}</span>
                                            {t.isCommon && <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">Common</span>}
                                        </label>
                                    ))
                            )}
                        </div>
                        <div className="mt-2 text-xs text-blue-600 font-semibold text-right">
                            {formData.selectedTests?.length || 0} tests selected
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="flex-1 bg-blue-600 text-white py-2 rounded-lg"
                        >
                            <i className="fas fa-plus mr-2"></i>Add Sample
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAddModal(false)}
                            className="px-6 bg-gray-300 py-2 rounded-lg"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit Sample Modal */}
            <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
                <h3 className="text-xl font-bold mb-4">
                    <i className="fas fa-edit text-green-600 mr-2"></i>Edit Sample
                </h3>
                <form onSubmit={handleUpdateSample} className="space-y-3">
                    <input
                        type="text"
                        value={formData.sampleNumber}
                        onChange={(e) => setFormData({ ...formData, sampleNumber: e.target.value })}
                        required
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                    />
                    <select
                        value={formData.patientId}
                        onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                        required
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                    >
                        <option value="">Choose Patient</option>
                        {patients.map(p => (
                            <option key={p.id} value={p.id}>{p.name} - {p.mobile}</option>
                        ))}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                        <select
                            value={formData.sampleType}
                            onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
                            required
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        >
                            <option value="Whole Blood">Whole Blood</option>
                            <option value="Serum">Serum</option>
                            <option value="Plasma">Plasma</option>
                            <option value="Urine">Urine</option>
                            <option value="Stool">Stool</option>
                            <option value="Sputum">Sputum</option>
                            <option value="Swab">Swab</option>
                            <option value="CSF">CSF</option>
                            <option value="Fluid">Fluid</option>
                            <option value="Tissue">Tissue</option>
                            <option value="Other">Other</option>
                        </select>

                        <select
                            value={(formData as any).collectionCondition || 'Random'}
                            onChange={(e) => setFormData({ ...formData, collectionCondition: e.target.value } as any)}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        >
                            <option value="Random">Random</option>
                            <option value="Fasting">Fasting</option>
                            <option value="Post-Prandial">Post-Prandial (PP)</option>
                            <option value="Pre-Meal">Pre-Meal</option>
                            <option value="Early Morning">Early Morning</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <select
                            value={(formData as any).containerType || 'Plain Vial'}
                            onChange={(e) => setFormData({ ...formData, containerType: e.target.value } as any)}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        >
                            <option value="Plain Vial">Plain Vial (Red)</option>
                            <option value="EDTA">EDTA (Purple)</option>
                            <option value="Fluoride">Fluoride (Grey)</option>
                            <option value="Citrate">Citrate (Blue)</option>
                            <option value="Heparin">Heparin (Green)</option>
                            <option value="Urine Container">Urine Container</option>
                            <option value="Sterile Container">Sterile Container</option>
                            <option value="Slide">Slide</option>
                            <option value="Swab Stick">Swab Stick</option>
                            <option value="Other">Other</option>
                        </select>

                        <select
                            value={(formData as any).priority || 'Routine'}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value } as any)}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        >
                            <option value="Routine">Routine</option>
                            <option value="Urgent">Urgent (STAT)</option>
                            <option value="Emergency">Emergency</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="datetime-local"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        />
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                        >
                            <option value="Pending">Pending</option>
                            <option value="Processing">Processing</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>

                    <input
                        type="text"
                        placeholder="Collected By (Phlebotomist Name)"
                        value={(formData as any).collectedBy || ''}
                        onChange={(e) => setFormData({ ...formData, collectedBy: e.target.value } as any)}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                    />

                    <textarea
                        placeholder="Clinical Remarks / Notes"
                        rows={2}
                        value={(formData as any).remarks || ''}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value } as any)}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                    />

                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <label className="block text-sm font-semibold mb-2 text-gray-700">Select Tests Requirements</label>
                        <input
                            type="text"
                            placeholder="Search tests..."
                            value={testSearch}
                            onChange={(e) => setTestSearch(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg mb-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <div className="h-96 max-h-96 overflow-y-auto space-y-1 bg-white border rounded-lg p-2">
                            {templates.length === 0 ? (
                                <p className="text-xs text-gray-500 text-center py-4">No templates found</p>
                            ) : (
                                templates
                                    .filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase()))
                                    .map(t => (
                                        <label key={t.id} className="flex items-center gap-2 p-2 hover:bg-blue-50 rounded cursor-pointer transition">
                                            <input
                                                type="checkbox"
                                                checked={formData.selectedTests?.includes(t.id)}
                                                onChange={() => handleTestToggle(t.id)}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">{t.name}</span>
                                            {t.isCommon && <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">Common</span>}
                                        </label>
                                    ))
                            )}
                        </div>
                        <div className="mt-2 text-xs text-blue-600 font-semibold text-right">
                            {formData.selectedTests?.length || 0} tests selected
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="flex-1 bg-green-600 text-white py-2 rounded-lg"
                        >
                            <i className="fas fa-save mr-2"></i>Update Sample
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

            {/* Update Status Modal */}
            <Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)}>
                <h3 className="text-xl font-bold mb-4">Update Sample Status</h3>
                <form onSubmit={handleUpdateStatus} className="space-y-3">
                    <input
                        type="text"
                        value={selectedSample?.sampleNumber || ''}
                        disabled
                        className="w-full px-4 py-2 border rounded-lg bg-gray-100"
                    />
                    <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        required
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                    >
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Completed">Completed</option>
                    </select>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="flex-1 bg-blue-600 text-white py-2 rounded-lg"
                        >
                            Update
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowStatusModal(false)}
                            className="px-6 bg-gray-300 py-2 rounded-lg"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
