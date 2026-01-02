'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, push, set } from 'firebase/database';
import { database } from '@/lib/firebase';

interface FollowUpModalProps {
    isOpen: boolean;
    userId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function FollowUpModal({ isOpen, userId, onClose, onSuccess }: FollowUpModalProps) {
    const [patients, setPatients] = useState<any[]>([]);
    const [previousVisits, setPreviousVisits] = useState<any[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [selectedVisit, setSelectedVisit] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'select-patient' | 'select-visit' | 'confirm'>('select-patient');

    const dateKey = new Date().toISOString().split('T')[0].replace(/-/g, '');

    useEffect(() => {
        if (!isOpen || !userId) return;

        // Fetch all patients
        const patientsRef = ref(database, `patients/${userId}`);
        onValue(patientsRef, (snapshot) => {
            if (snapshot.exists()) {
                const patientsData = snapshot.val();
                const patientsList: any[] = [];

                for (const patId in patientsData) {
                    patientsList.push({
                        id: patId,
                        ...patientsData[patId]
                    });
                }

                patientsList.sort((a, b) => a.name.localeCompare(b.name));
                setPatients(patientsList);
            }
        });
    }, [isOpen, userId]);

    const handleSelectPatient = (patient: any) => {
        setSelectedPatient(patient);

        // Fetch previous visits for this patient
        const opdRef = ref(database, `opd/${userId}`);
        onValue(opdRef, (snapshot) => {
            if (snapshot.exists()) {
                const opdData = snapshot.val();
                const visits: any[] = [];

                for (const opdId in opdData) {
                    if (opdData[opdId].patientId === patient.id && opdData[opdId].isFinalized) {
                        visits.push({
                            id: opdId,
                            ...opdData[opdId]
                        });
                    }
                }

                visits.sort((a, b) =>
                    new Date(b.visitDate || b.createdAt).getTime() -
                    new Date(a.visitDate || a.createdAt).getTime()
                );

                setPreviousVisits(visits);
                setStep('select-visit');
            }
        });
    };

    const handleSelectVisit = (visit: any) => {
        setSelectedVisit(visit);
        setStep('confirm');
    };

    const createFollowUpToken = async () => {
        if (!selectedPatient || !selectedVisit || !userId) return;

        setLoading(true);
        try {
            // Get next token number
            const queueRef = ref(database, `opd_queue/${userId}/${dateKey}`);
            let nextToken = 1;

            const snapshot = await new Promise<any>((resolve) => {
                onValue(queueRef, (snap) => resolve(snap), { onlyOnce: true });
            });

            if (snapshot.exists()) {
                const queue = snapshot.val();
                const tokens = Object.values(queue).map((t: any) => parseInt(t.tokenNumber || 0));
                nextToken = Math.max(...tokens) + 1;
            }

            // Create follow-up token
            const tokenId = push(queueRef).key;
            const tokenData = {
                tokenNumber: nextToken.toString(),
                patientId: selectedPatient.id,
                patientName: selectedPatient.name,
                patientMobile: selectedPatient.mobile,
                uhid: selectedPatient.uhid || '',
                appointmentId: null,
                status: 'waiting',
                priority: 'normal',
                vitals: {
                    bp: '',
                    pulse: '',
                    weight: '',
                    temperature: ''
                },
                complaints: '',
                assignedDoctorId: selectedVisit.consultingDoctorId || '',
                assignedDoctorName: selectedVisit.consultingDoctor || '',
                isFollowUp: true,
                previousVisitId: selectedVisit.id,
                previousDiagnosis: selectedVisit.diagnosis || '',
                previousMedicines: selectedVisit.medicines || [],
                previousAdvice: selectedVisit.advice || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'reception'
            };

            await set(ref(database, `opd_queue/${userId}/${dateKey}/${tokenId}`), tokenData);

            alert(`Follow-up Token #${nextToken} created successfully!`);
            onSuccess();
            onClose();
            resetModal();

        } catch (error) {
            console.error('Error creating follow-up:', error);
            alert('Failed to create follow-up token');
        } finally {
            setLoading(false);
        }
    };

    const resetModal = () => {
        setSelectedPatient(null);
        setSelectedVisit(null);
        setPreviousVisits([]);
        setSearchQuery('');
        setStep('select-patient');
    };

    const filteredPatients = patients.filter(p =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mobile?.includes(searchQuery) ||
        p.uhid?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold">
                                <i className="fas fa-redo mr-2"></i>
                                Create Follow-up Token
                            </h2>
                            <p className="text-purple-100 mt-1">Link to previous visit and create new consultation</p>
                        </div>
                        <button
                            onClick={() => {
                                onClose();
                                resetModal();
                            }}
                            className="text-white hover:bg-white/20 w-10 h-10 rounded-full transition"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    {/* Steps Indicator */}
                    <div className="flex gap-4 mt-6">
                        <div className={`flex-1 h-2 rounded-full ${step === 'select-patient' ? 'bg-white' : 'bg-white/30'}`}></div>
                        <div className={`flex-1 h-2 rounded-full ${step === 'select-visit' ? 'bg-white' : 'bg-white/30'}`}></div>
                        <div className={`flex-1 h-2 rounded-full ${step === 'confirm' ? 'bg-white' : 'bg-white/30'}`}></div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: Select Patient */}
                    {step === 'select-patient' && (
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Step 1: Select Patient</h3>

                            <input
                                type="text"
                                placeholder="Search by name, mobile, or UHID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none mb-4"
                            />

                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {filteredPatients.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">No patients found</p>
                                ) : (
                                    filteredPatients.map((patient) => (
                                        <button
                                            key={patient.id}
                                            onClick={() => handleSelectPatient(patient)}
                                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 hover:border-purple-400 hover:bg-purple-50 transition text-left flex justify-between items-center"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <span className="font-bold text-gray-800 truncate">{patient.name}</span>
                                                <span className="text-gray-400">•</span>
                                                <span className="text-sm text-gray-600">{patient.mobile}</span>
                                                {patient.uhid && (
                                                    <>
                                                        <span className="text-gray-400">•</span>
                                                        <span className="text-sm text-gray-500">{patient.uhid}</span>
                                                    </>
                                                )}
                                            </div>
                                            <i className="fas fa-chevron-right text-gray-400 flex-shrink-0"></i>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Select Previous Visit */}
                    {step === 'select-visit' && (
                        <div>
                            <div className="mb-4">
                                <button
                                    onClick={() => setStep('select-patient')}
                                    className="text-purple-600 hover:text-purple-700 text-sm font-semibold"
                                >
                                    <i className="fas fa-arrow-left mr-2"></i>
                                    Back to patient selection
                                </button>
                            </div>

                            <h3 className="text-lg font-bold text-gray-800 mb-2">Step 2: Select Previous Visit</h3>
                            <p className="text-gray-600 mb-4">Patient: <strong>{selectedPatient?.name}</strong></p>

                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {previousVisits.length === 0 ? (
                                    <div className="text-center py-8">
                                        <i className="fas fa-inbox text-4xl text-gray-300 mb-3"></i>
                                        <p className="text-gray-500">No previous visits found for this patient</p>
                                    </div>
                                ) : (
                                    previousVisits.map((visit) => (
                                        <button
                                            key={visit.id}
                                            onClick={() => handleSelectVisit(visit)}
                                            className="w-full border-2 border-gray-200 rounded-lg p-4 hover:border-purple-400 hover:bg-purple-50 transition text-left"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="text-sm font-semibold text-gray-700">
                                                        {new Date(visit.visitDate || visit.createdAt).toLocaleDateString('en-IN', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </span>
                                                    <p className="text-xs text-gray-500">RX: {visit.rxId}</p>
                                                </div>
                                                <i className="fas fa-chevron-right text-gray-400"></i>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                <p><strong>Doctor:</strong> {visit.consultingDoctor}</p>
                                                <p><strong>Diagnosis:</strong> {visit.diagnosis?.substring(0, 100)}</p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirm */}
                    {step === 'confirm' && (
                        <div>
                            <div className="mb-4">
                                <button
                                    onClick={() => setStep('select-visit')}
                                    className="text-purple-600 hover:text-purple-700 text-sm font-semibold"
                                >
                                    <i className="fas fa-arrow-left mr-2"></i>
                                    Back to visit selection
                                </button>
                            </div>

                            <h3 className="text-lg font-bold text-gray-800 mb-4">Step 3: Confirm Follow-up</h3>

                            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6 mb-6">
                                <h4 className="font-bold text-gray-800 mb-3">Follow-up Details</h4>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Patient</p>
                                        <p className="font-semibold text-gray-800">{selectedPatient?.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Mobile</p>
                                        <p className="font-semibold text-gray-800">{selectedPatient?.mobile}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Previous Visit</p>
                                        <p className="font-semibold text-gray-800">
                                            {new Date(selectedVisit?.visitDate || selectedVisit?.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Assigned Doctor</p>
                                        <p className="font-semibold text-gray-800">{selectedVisit?.consultingDoctor}</p>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <p className="text-sm text-gray-600 mb-2">Previous Diagnosis</p>
                                    <p className="text-gray-800">{selectedVisit?.diagnosis}</p>
                                </div>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-yellow-800">
                                    <i className="fas fa-info-circle mr-2"></i>
                                    This will create a new token with previous visit data pre-filled for the doctor's reference.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={createFollowUpToken}
                                    disabled={loading}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold transition disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin mr-2"></i>
                                            Creating Token...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-check mr-2"></i>
                                            Create Follow-up Token
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        onClose();
                                        resetModal();
                                    }}
                                    disabled={loading}
                                    className="px-6 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-bold transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
