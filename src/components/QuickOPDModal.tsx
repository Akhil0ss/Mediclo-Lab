'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, onValue, push, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { generateSequentialId } from '@/lib/idGenerator';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface QuickOPDModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Medicine {
    name: string;
    dosage: string;
    duration: string;
}

export default function QuickOPDModal({ isOpen, onClose }: QuickOPDModalProps) {
    const { user } = useAuth();
    const { isPremium } = useSubscription();
    const router = useRouter();
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [loading, setLoading] = useState(false);

    // OPD Details
    const [opdDetails, setOpdDetails] = useState({
        bp: '',
        pulse: '',
        weight: '',
        temperature: '',
        complaints: '',
        diagnosis: '',
        advice: ''
    });

    const [medicines, setMedicines] = useState<Medicine[]>([
        { name: '', dosage: '', duration: '' }
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [patients, setPatients] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [doctors, setDoctors] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [branding, setBranding] = useState<any>({});

    useEffect(() => {
        if (!user) return;

        const patientsRef = ref(database, `patients/${user.uid}`);
        const doctorsRef = ref(database, `doctors/${user.uid}`);
        const brandingRef = ref(database, `branding/${user.uid}`);

        const unsubscribes = [
            onValue(patientsRef, (snapshot) => {
                const data: any[] = [];
                snapshot.forEach(child => { data.push({ id: child.key, ...child.val() }); });
                setPatients(data);
            }),
            onValue(doctorsRef, (snapshot) => {
                const data: any[] = [];
                snapshot.forEach(child => { data.push({ id: child.key, ...child.val() }); });
                setDoctors(data);
                // Auto-select default doctor
                const defaultDoctor = data.find(d => d.isDefault);
                if (defaultDoctor) setSelectedDoctorId(defaultDoctor.id);
            }),
            onValue(brandingRef, (snapshot) => {
                setBranding(snapshot.val() || {});
            })
        ];

        return () => unsubscribes.forEach(unsub => unsub());
    }, [user]);

    const addMedicineField = () => {
        setMedicines([...medicines, { name: '', dosage: '', duration: '' }]);
    };

    const removeMedicineField = (index: number) => {
        setMedicines(medicines.filter((_, i) => i !== index));
    };

    const updateMedicine = (index: number, field: keyof Medicine, value: string) => {
        const updated = [...medicines];
        updated[index][field] = value;
        setMedicines(updated);
    };

    const handleSubmit = async () => {
        if (!user) return;

        if (!selectedPatientId) {
            alert('⚠️ Please select a patient first!\n\nTip: Add patients from the Patients tab.');
            return;
        }

        const patientData = patients.find(p => p.id === selectedPatientId);
        if (!patientData) {
            alert('Patient not found');
            return;
        }

        const doctorData = selectedDoctorId ? doctors.find(d => d.id === selectedDoctorId) : null;

        setLoading(true);

        try {
            // Generate sequential ID with premium status from subscription
            const rxId = await generateSequentialId(
                user.uid,
                'rx',
                branding.labName,
                isPremium
            );

            const opdData = {
                rxId,
                patientId: selectedPatientId,
                patientName: patientData.name,
                patientAge: patientData.age,
                patientGender: patientData.gender,
                patientMobile: patientData.mobile,
                patientAddress: patientData.address || '',
                consultingDoctor: doctorData?.name || '',
                consultingDoctorId: selectedDoctorId || '',
                doctorQualification: doctorData?.qualification || '',
                doctorSpecialization: doctorData?.specialization || '',
                vitals: {
                    bp: opdDetails.bp,
                    pulse: opdDetails.pulse,
                    weight: opdDetails.weight,
                    temperature: opdDetails.temperature
                },
                complaints: opdDetails.complaints,
                diagnosis: opdDetails.diagnosis,
                medicines: medicines.filter(m => m.name.trim() !== ''),
                advice: opdDetails.advice,
                visitDate: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                labName: branding.labName || 'Spotnet MedOS',
                labBranding: branding
            };

            await set(ref(database, `opd/${user.uid}/${rxId}`), opdData);

            alert('Prescription generated successfully!');
            onClose();

            // Open print view
            setTimeout(() => {
                window.open(`/print/opd/${rxId}`, '_blank');
            }, 500);

        } catch (error) {
            console.error('Error generating prescription:', error);
            alert('Failed to generate prescription');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h3 className="text-2xl font-bold mb-6">
                <i className="fas fa-file-prescription text-green-600 mr-2"></i>
                Quick OPD Prescription
            </h3>

            {/* Patient Selection - Only Existing Patients */}
            <div className="mb-6">
                <label className="block font-semibold mb-2">Select Patient: *</label>
                {patients.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800 text-sm">
                            <i className="fas fa-info-circle mr-2"></i>
                            No patients found. Please add patients from the <strong>Patients Tab</strong> first.
                        </p>
                    </div>
                ) : (
                    <select
                        value={selectedPatientId}
                        onChange={(e) => setSelectedPatientId(e.target.value)}
                        className="w-full p-3 border rounded-lg"
                        required
                    >
                        <option value="">Choose a patient</option>
                        {patients.map(p => (
                            <option key={p.id} value={p.id}>{p.name} - {p.mobile}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Consulting Doctor Selection */}
            <div className="mb-6">
                <label className="block font-semibold mb-2">Consulting Doctor:</label>
                {doctors.length === 0 ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-blue-800 text-sm">
                            <i className="fas fa-info-circle mr-2"></i>
                            No doctors found. Add doctors from the <strong>Doctors Tab</strong> for better prescriptions.
                        </p>
                    </div>
                ) : (
                    <select
                        value={selectedDoctorId}
                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                        className="w-full p-3 border rounded-lg"
                    >
                        <option value="">Select Doctor (Optional)</option>
                        {doctors.map(d => (
                            <option key={d.id} value={d.id}>
                                {d.name} - {d.specialization || 'General'}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Vitals */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block font-semibold mb-2">Blood Pressure (BP):</label>
                    <input
                        type="text"
                        placeholder="e.g. 120/80"
                        value={opdDetails.bp}
                        onChange={(e) => setOpdDetails({ ...opdDetails, bp: e.target.value })}
                        className="w-full p-3 border rounded-lg"
                    />
                </div>
                <div>
                    <label className="block font-semibold mb-2">Pulse Rate:</label>
                    <input
                        type="text"
                        placeholder="e.g. 72"
                        value={opdDetails.pulse}
                        onChange={(e) => setOpdDetails({ ...opdDetails, pulse: e.target.value })}
                        className="w-full p-3 border rounded-lg"
                    />
                </div>
                <div>
                    <label className="block font-semibold mb-2">Weight (kg):</label>
                    <input
                        type="text"
                        placeholder="e.g. 70"
                        value={opdDetails.weight}
                        onChange={(e) => setOpdDetails({ ...opdDetails, weight: e.target.value })}
                        className="w-full p-3 border rounded-lg"
                    />
                </div>
                <div>
                    <label className="block font-semibold mb-2">Temperature (°F):</label>
                    <input
                        type="text"
                        placeholder="e.g. 98.6"
                        value={opdDetails.temperature}
                        onChange={(e) => setOpdDetails({ ...opdDetails, temperature: e.target.value })}
                        className="w-full p-3 border rounded-lg"
                    />
                </div>
            </div>

            {/* Chief Complaints */}
            <div className="mb-6">
                <label className="block font-semibold mb-2">Chief Complaints:</label>
                <textarea
                    placeholder="Patient's complaints..."
                    value={opdDetails.complaints}
                    onChange={(e) => setOpdDetails({ ...opdDetails, complaints: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    rows={3}
                />
            </div>

            {/* Clinical Diagnosis */}
            <div className="mb-6">
                <label className="block font-semibold mb-2">Clinical Diagnosis:</label>
                <textarea
                    placeholder="Provisional diagnosis..."
                    value={opdDetails.diagnosis}
                    onChange={(e) => setOpdDetails({ ...opdDetails, diagnosis: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    rows={3}
                />
            </div>

            {/* Medicines */}
            <div className="mb-6">
                <label className="block font-semibold mb-2">Medicines / Rx:</label>
                <div className="space-y-2 mb-2">
                    {medicines.map((medicine, index) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Medicine Name"
                                value={medicine.name}
                                onChange={(e) => updateMedicine(index, 'name', e.target.value)}
                                className="flex-1 p-2 border rounded"
                            />
                            <input
                                type="text"
                                placeholder="Dosage (e.g. 1-0-1)"
                                value={medicine.dosage}
                                onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                                className="w-1/4 p-2 border rounded"
                            />
                            <input
                                type="text"
                                placeholder="Duration"
                                value={medicine.duration}
                                onChange={(e) => updateMedicine(index, 'duration', e.target.value)}
                                className="w-1/4 p-2 border rounded"
                            />
                            {index > 0 && (
                                <button
                                    onClick={() => removeMedicineField(index)}
                                    className="text-red-500 hover:text-red-700 px-2"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <button
                    onClick={addMedicineField}
                    className="text-sm text-blue-600 hover:underline"
                >
                    <i className="fas fa-plus mr-1"></i> Add Medicine
                </button>
            </div>

            {/* Advice */}
            <div className="mb-6">
                <label className="block font-semibold mb-2">Advice / Instructions:</label>
                <textarea
                    placeholder="Diet, rest, follow-up..."
                    value={opdDetails.advice}
                    onChange={(e) => setOpdDetails({ ...opdDetails, advice: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    rows={3}
                />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-8">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-4 rounded-lg hover:from-green-700 hover:to-green-800 font-semibold shadow-md transition-all disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <i className="fas fa-spinner fa-spin mr-2"></i> Generating...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-print mr-2"></i> Print Prescription
                        </>
                    )}
                </button>
                <button
                    onClick={onClose}
                    className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 font-semibold transition-all"
                >
                    <i className="fas fa-times mr-2"></i> Cancel
                </button>
            </div>
        </Modal>
    );
}
