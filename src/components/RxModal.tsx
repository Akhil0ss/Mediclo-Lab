'use client';

import { useState, useEffect } from 'react';
import { ref, push, update, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import Modal from './Modal';
import AIPrescriptionAssistant from './AIPrescriptionAssistant';
import AIDiagnosisAssistant from './AIDiagnosisAssistant';
import { generatePatientSummary } from '@/lib/groqAI';

interface RxModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: any;
    dataSourceId: string;
    onSuccess?: () => void;
}

export default function RxModal({ isOpen, onClose, token, dataSourceId, onSuccess }: RxModalProps) {
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [visitData, setVisitData] = useState({
        visitDate: new Date().toISOString().split('T')[0],
        visitType: 'New',
        bp: '',
        pulse: '',
        temp: '',
        weight: '',
        height: '',
        spo2: '',
        complaints: '',
        history: '',
        examination: '',
        diagnosis: '',
        investigations: '',
        advice: '',
        followUpDate: ''
    });
    const [medicines, setMedicines] = useState([
        { name: '', dosage: '', frequency: 'BD', duration: '', timing: 'After food', instructions: '' }
    ]);
    const [loading, setLoading] = useState(false);

    // Patient history states
    const [showHistory, setShowHistory] = useState(false);
    const [patientHistory, setPatientHistory] = useState<any>(null);
    const [opdHistory, setOpdHistory] = useState<any[]>([]);
    const [samplesHistory, setSamplesHistory] = useState<any[]>([]);
    const [historySummary, setHistorySummary] = useState('');
    const [generatingSummary, setGeneratingSummary] = useState(false);

    // Load doctors and preload vitals
    useEffect(() => {
        if (!isOpen || !dataSourceId) return;

        // Fetch doctors
        const doctorsRef = ref(database, `doctors/${dataSourceId}`);
        get(doctorsRef).then((snapshot) => {
            if (snapshot.exists()) {
                const data: any[] = [];
                snapshot.forEach((child) => {
                    data.push({ id: child.key, ...child.val() });
                });
                setDoctors(data);
                const defaultDoctor = data.find(d => d.isDefault);
                if (defaultDoctor) setSelectedDoctorId(defaultDoctor.id);
            }
        });

        // Preload vitals from token
        if (token?.vitals) {
            setVisitData(prev => ({
                ...prev,
                bp: token.vitals.bp || '',
                pulse: token.vitals.pulse || '',
                temp: token.vitals.temperature || '',
                weight: token.vitals.weight || '',
                spo2: token.vitals.spo2 || '',
                complaints: token.complaints || ''
            }));
        }
    }, [isOpen, token, dataSourceId]);

    const addMedicineRow = () => {
        setMedicines([...medicines, {
            name: '', dosage: '', frequency: 'BD', duration: '', timing: 'After food', instructions: ''
        }]);
    };

    const removeMedicineRow = (index: number) => {
        setMedicines(medicines.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent, finalize: boolean = false) => {
        e.preventDefault();
        if (!token || !selectedDoctorId) return;

        setLoading(true);
        try {
            const doctor = doctors.find(d => d.id === selectedDoctorId);
            if (!doctor) {
                alert('Please select a doctor');
                setLoading(false);
                return;
            }

            // Generate RX ID
            const rxIdRef = ref(database, `counters/${dataSourceId}/rxId`);
            const rxIdSnapshot = await get(rxIdRef);
            const currentRxId = rxIdSnapshot.exists() ? rxIdSnapshot.val() : 0;
            const newRxId = currentRxId + 1;
            await update(ref(database, `counters/${dataSourceId}`), { rxId: newRxId });
            const rxId = `RX${newRxId.toString().padStart(5, '0')}`;

            // Fetch patient data for complete info
            const patientRef = ref(database, `patients/${dataSourceId}/${token.patientId}`);
            const patientSnapshot = await get(patientRef);
            const patientData = patientSnapshot.exists() ? patientSnapshot.val() : null;

            // Create OPD record
            const opdData = {
                rxId,
                patientId: token.patientId,
                patientName: token.patientName,
                patientAge: patientData?.age || 0,
                patientGender: patientData?.gender || 'Unknown',
                patientMobile: token.patientMobile || patientData?.mobile || '',
                patientToken: token.tokenNumber || patientData?.token || '',
                doctorId: selectedDoctorId,
                doctorName: doctor.name,
                assignedDoctorId: selectedDoctorId,
                visitDate: visitData.visitDate,
                visitType: visitData.visitType,
                vitals: {
                    bp: visitData.bp || '-',
                    pulse: visitData.pulse || '-',
                    temp: visitData.temp || '-',
                    weight: visitData.weight || '-',
                    height: visitData.height || '-',
                    spo2: visitData.spo2 || '-'
                },
                complaints: visitData.complaints,
                history: visitData.history,
                examination: visitData.examination,
                diagnosis: visitData.diagnosis,
                investigations: visitData.investigations,
                advice: visitData.advice,
                followUpDate: visitData.followUpDate,
                medicines: medicines.filter(m => m.name.trim() !== ''),
                isFinal: finalize,
                finalizedAt: finalize ? new Date().toISOString() : null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await push(ref(database, `opd/${dataSourceId}`), opdData);

            // Update queue token status if finalized
            if (finalize && token.id) {
                const dateKey = new Date().toISOString().split('T')[0].replace(/-/g, '');
                const updates: any = {};

                // 1. Mark Queue Item as Completed
                updates[`opd_queue/${dataSourceId}/${dateKey}/${token.id}/status`] = 'completed';
                updates[`opd_queue/${dataSourceId}/${dateKey}/${token.id}/completedAt`] = new Date().toISOString();

                // 2. Mark Appointment as Completed (if linked) - SYNC FIX
                if (token.appointmentId && token.appointmentDate) {
                    updates[`appointments/${dataSourceId}/${token.appointmentDate}/${token.appointmentId}/status`] = 'completed';
                }

                await update(ref(database), updates);
            }

            alert(finalize ? 'RX Finalized Successfully!' : 'RX Saved as Draft!');
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error saving RX:', error);
            alert('Error saving RX');
        } finally {
            setLoading(false);
        }
    };

    if (!token) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="max-h-[80vh] overflow-y-auto">
                <h3 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-3">
                    <i className="fas fa-prescription mr-2 text-blue-600"></i>
                    Create Prescription
                </h3>

                {/* Patient Info */}
                <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>Patient:</strong> {token.patientName}</div>
                        <div><strong>Token:</strong> #{token.tokenNumber}</div>
                        <div><strong>Mobile:</strong> {token.patientMobile}</div>
                    </div>
                    {/* View History Button */}
                    <button
                        type="button"
                        onClick={async () => {
                            if (!token.patientId) return;
                            // Fetch patient history
                            const opdRef = ref(database, `opd/${dataSourceId}`);
                            const samplesRef = ref(database, `samples/${dataSourceId}`);
                            const patientRef = ref(database, `patients/${dataSourceId}/${token.patientId}`);

                            const [opdSnap, samplesSnap, patientSnap] = await Promise.all([
                                get(opdRef),
                                get(samplesRef),
                                get(patientRef)
                            ]);

                            const opdData: any[] = [];
                            if (opdSnap.exists()) {
                                opdSnap.forEach((child) => {
                                    const data = child.val();
                                    if (data.patientId === token.patientId) {
                                        opdData.push({ id: child.key, ...data });
                                    }
                                });
                            }

                            const samplesData: any[] = [];
                            if (samplesSnap.exists()) {
                                samplesSnap.forEach((child) => {
                                    const data = child.val();
                                    if (data.patientId === token.patientId) {
                                        samplesData.push({ id: child.key, ...data });
                                    }
                                });
                            }

                            setPatientHistory(patientSnap.exists() ? patientSnap.val() : null);
                            const sortedHistory = opdData.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
                            setOpdHistory(sortedHistory);
                            setSamplesHistory(samplesData);
                            setShowHistory(true);

                            // Generate AI Summary
                            if (opdData.length > 0 || samplesData.length > 0) {
                                setGeneratingSummary(true);
                                setHistorySummary('');

                                const visits = sortedHistory.map(v => ({
                                    date: v.visitDate,
                                    diagnosis: v.diagnosis || 'No diagnosis',
                                    medicines: v.medicines?.map((m: any) => m.name) || []
                                }));

                                const reports = samplesData.map(s => ({
                                    date: s.date,
                                    type: s.sampleType,
                                    findings: s.status === 'Completed' ? 'Report Available' : 'Pending'
                                }));

                                generatePatientSummary(visits, reports)
                                    .then(summary => setHistorySummary(summary))
                                    .catch(console.error)
                                    .finally(() => setGeneratingSummary(false));
                            }
                        }}
                        className="w-full bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 py-2 px-4 rounded-lg hover:from-purple-200 hover:to-blue-200 transition flex items-center justify-center gap-2 mb-4 border border-purple-300"
                    >
                        <i className="fas fa-history"></i>
                        View Patient History
                    </button>
                </div>

                <form onSubmit={(e) => handleSubmit(e, false)}>
                    {/* Doctor Selection */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold mb-2">Doctor *</label>
                        <select
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg"
                            required
                        >
                            <option value="">Select Doctor</option>
                            {doctors.map(doc => (
                                <option key={doc.id} value={doc.id}>
                                    Dr. {doc.name} - {doc.specialization}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Vitals */}
                    <div className="mb-4">
                        <h4 className="font-semibold mb-2">Vitals</h4>
                        <div className="grid grid-cols-3 gap-3">
                            <input
                                type="text"
                                placeholder="BP"
                                value={visitData.bp}
                                onChange={(e) => setVisitData({ ...visitData, bp: e.target.value })}
                                className="px-3 py-2 border rounded-lg text-sm"
                            />
                            <input
                                type="text"
                                placeholder="Pulse"
                                value={visitData.pulse}
                                onChange={(e) => setVisitData({ ...visitData, pulse: e.target.value })}
                                className="px-3 py-2 border rounded-lg text-sm"
                            />
                            <input
                                type="text"
                                placeholder="Temp"
                                value={visitData.temp}
                                onChange={(e) => setVisitData({ ...visitData, temp: e.target.value })}
                                className="px-3 py-2 border rounded-lg text-sm"
                            />
                            <input
                                type="text"
                                placeholder="Weight"
                                value={visitData.weight}
                                onChange={(e) => setVisitData({ ...visitData, weight: e.target.value })}
                                className="px-3 py-2 border rounded-lg text-sm"
                            />
                            <input
                                type="text"
                                placeholder="SpO2"
                                value={visitData.spo2}
                                onChange={(e) => setVisitData({ ...visitData, spo2: e.target.value })}
                                className="px-3 py-2 border rounded-lg text-sm"
                            />
                        </div>
                    </div>

                    {/* Complaints & Diagnosis */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold mb-2">Complaints *</label>
                        <textarea
                            value={visitData.complaints}
                            onChange={(e) => setVisitData({ ...visitData, complaints: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg"
                            rows={2}
                            required
                        />
                    </div>

                    {/* AI Diagnosis Assistant */}
                    {visitData.complaints && patientHistory && (
                        <div className="mb-4">
                            <AIDiagnosisAssistant
                                complaints={visitData.complaints}
                                vitals={{
                                    bp: visitData.bp,
                                    pulse: visitData.pulse,
                                    temp: visitData.temp,
                                    spo2: visitData.spo2,
                                    weight: visitData.weight
                                }}
                                age={patientHistory.age || 0}
                                gender={patientHistory.gender || 'Male'}
                                onDiagnosisSelect={(diagnosis: string) => {
                                    setVisitData({ ...visitData, diagnosis });
                                }}
                            />
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-sm font-semibold mb-2">Diagnosis *</label>
                        <textarea
                            value={visitData.diagnosis}
                            onChange={(e) => setVisitData({ ...visitData, diagnosis: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg"
                            rows={2}
                            required
                        />
                    </div>

                    {/* Medicines */}
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold">Medicines</h4>
                            <button
                                type="button"
                                onClick={addMedicineRow}
                                className="text-blue-600 text-sm hover:underline"
                            >
                                + Add Medicine
                            </button>
                        </div>
                        {medicines.map((med, index) => (
                            <div key={index} className="grid grid-cols-6 gap-2 mb-2">
                                <input
                                    type="text"
                                    placeholder="Medicine"
                                    value={med.name}
                                    onChange={(e) => {
                                        const newMeds = [...medicines];
                                        newMeds[index].name = e.target.value;
                                        setMedicines(newMeds);
                                    }}
                                    className="col-span-2 px-2 py-1 border rounded text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="Dosage"
                                    value={med.dosage}
                                    onChange={(e) => {
                                        const newMeds = [...medicines];
                                        newMeds[index].dosage = e.target.value;
                                        setMedicines(newMeds);
                                    }}
                                    className="px-2 py-1 border rounded text-sm"
                                />
                                <select
                                    value={med.frequency}
                                    onChange={(e) => {
                                        const newMeds = [...medicines];
                                        newMeds[index].frequency = e.target.value;
                                        setMedicines(newMeds);
                                    }}
                                    className="px-2 py-1 border rounded text-sm"
                                >
                                    <option value="OD">OD</option>
                                    <option value="BD">BD</option>
                                    <option value="TDS">TDS</option>
                                    <option value="QID">QID</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Duration"
                                    value={med.duration}
                                    onChange={(e) => {
                                        const newMeds = [...medicines];
                                        newMeds[index].duration = e.target.value;
                                        setMedicines(newMeds);
                                    }}
                                    className="px-2 py-1 border rounded text-sm"
                                />
                                {medicines.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeMedicineRow(index)}
                                        className="text-red-600 text-sm"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* AI Prescription Assistant */}
                    <div className="mb-4">
                        <AIPrescriptionAssistant
                            medicines={medicines}
                            diagnosis={visitData.diagnosis}
                            symptoms={visitData.complaints}
                            patientAge={patientHistory?.age || 0}
                            onSuggestionAccept={(suggestedMeds: any[]) => {
                                const currentMeds = medicines.filter(m => m.name.trim() !== '');
                                setMedicines([...currentMeds, ...suggestedMeds]);
                            }}
                        />
                    </div>

                    {/* Advice */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold mb-2">Advice</label>
                        <textarea
                            value={visitData.advice}
                            onChange={(e) => setVisitData({ ...visitData, advice: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg"
                            rows={2}
                        />
                    </div>

                    {/* Follow-up Date */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold mb-2">Follow-up Date</label>
                        <input
                            type="date"
                            value={visitData.followUpDate}
                            onChange={(e) => setVisitData({ ...visitData, followUpDate: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-lg font-semibold transition"
                        >
                            <i className="fas fa-save mr-2"></i>
                            {loading ? 'Saving...' : 'Save as Draft'}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleSubmit(e, true)}
                            disabled={loading}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
                        >
                            <i className="fas fa-check-circle mr-2"></i>
                            {loading ? 'Finalizing...' : 'Finalize RX'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 bg-gray-300 hover:bg-gray-400 text-gray-700 py-3 rounded-lg font-semibold transition"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>

            {/* Patient History Modal */}
            {showHistory && (
                <Modal isOpen={showHistory} onClose={() => setShowHistory(false)}>
                    <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">
                        <i className="fas fa-user-circle mr-2 text-purple-600"></i>
                        Patient History
                    </h3>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {/* Patient Basic Info */}
                        {patientHistory && (
                            <div className="bg-purple-50 p-3 rounded-lg mb-4">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><strong>Name:</strong> {patientHistory.name}</div>
                                    <div><strong>Age/Gender:</strong> {patientHistory.age} / {patientHistory.gender}</div>
                                    <div><strong>Mobile:</strong> {patientHistory.mobile}</div>
                                    <div><strong>Address:</strong> {patientHistory.address || 'N/A'}</div>
                                </div>
                            </div>
                        )}

                        {/* AI Summary */}
                        {(historySummary || generatingSummary) && (
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg mb-4 border border-indigo-100">
                                <h4 className="font-bold text-indigo-800 mb-2 flex items-center">
                                    <i className="fas fa-magic mr-2"></i>
                                    AI History Summary
                                </h4>
                                {generatingSummary ? (
                                    <div className="text-sm text-indigo-600 flex items-center">
                                        <i className="fas fa-spinner fa-spin mr-2"></i>
                                        Analyzing history...
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-700 leading-relaxed italic">
                                        "{historySummary}"
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Previous Visits */}
                        <div className="mb-4">
                            <h4 className="font-bold text-lg mb-2 text-green-700 flex items-center">
                                <i className="fas fa-stethoscope mr-2"></i>
                                Previous Visits ({opdHistory.length})
                            </h4>
                            {opdHistory.length === 0 ? (
                                <p className="text-gray-500 text-sm italic pl-6">No previous visits</p>
                            ) : (
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {opdHistory.map((visit) => (
                                        <div key={visit.id} className="bg-white border border-green-200 rounded-lg p-3">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <div className="font-semibold text-green-600">RX: {visit.rxId}</div>
                                                    <div className="text-sm text-gray-600">Dr. {visit.doctorName}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {new Date(visit.visitDate).toLocaleDateString('en-IN')}
                                                    </div>
                                                </div>
                                                <a
                                                    href={`/print/opd/${visit.rxId}?ownerId=${dataSourceId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-sm"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <i className="fas fa-file-pdf"></i>
                                                    View PDF
                                                </a>
                                            </div>

                                            {/* Vitals */}
                                            {visit.vitals && (
                                                <div className="bg-blue-50 p-2 rounded mb-2">
                                                    <div className="text-xs font-semibold text-blue-700 mb-1">Vitals:</div>
                                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                                        {visit.vitals.bp && <div><strong>BP:</strong> {visit.vitals.bp}</div>}
                                                        {visit.vitals.pulse && <div><strong>Pulse:</strong> {visit.vitals.pulse}</div>}
                                                        {visit.vitals.temp && <div><strong>Temp:</strong> {visit.vitals.temp}</div>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Complaints & Diagnosis */}
                                            {visit.complaints && (
                                                <div className="mb-2">
                                                    <div className="text-xs font-semibold text-gray-700">Complaints:</div>
                                                    <div className="text-sm text-gray-600">{visit.complaints}</div>
                                                </div>
                                            )}
                                            {visit.diagnosis && (
                                                <div className="mb-2">
                                                    <div className="text-xs font-semibold text-gray-700">Diagnosis:</div>
                                                    <div className="text-sm text-gray-600">{visit.diagnosis}</div>
                                                </div>
                                            )}

                                            {/* Medicines */}
                                            {visit.medicines && visit.medicines.length > 0 && (
                                                <div className="mb-2">
                                                    <div className="text-xs font-semibold text-gray-700 mb-1">Medicines:</div>
                                                    <div className="space-y-1">
                                                        {visit.medicines.slice(0, 3).map((med: any, idx: number) => (
                                                            <div key={idx} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                                                {idx + 1}. {med.name} - {med.dosage} {med.frequency}
                                                            </div>
                                                        ))}
                                                        {visit.medicines.length > 3 && (
                                                            <div className="text-xs text-gray-500 italic">
                                                                +{visit.medicines.length - 3} more medicines
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Lab Samples */}
                        <div className="mb-4">
                            <h4 className="font-bold text-lg mb-2 text-orange-700 flex items-center">
                                <i className="fas fa-vial mr-2"></i>
                                Lab Samples ({samplesHistory.length})
                            </h4>
                            {samplesHistory.length === 0 ? (
                                <p className="text-gray-500 text-sm italic pl-6">No samples found</p>
                            ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {samplesHistory.map((sample) => (
                                        <div key={sample.id} className="bg-white border border-orange-200 rounded-lg p-3 hover:border-orange-400 transition">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <div className="font-semibold text-orange-600">Sample: {sample.sampleNumber}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {new Date(sample.createdAt).toLocaleDateString('en-IN')}
                                                    </div>
                                                    <div className="text-xs text-gray-600 mt-1">
                                                        Type: {sample.sampleType || 'N/A'}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sample.status === 'Completed'
                                                        ? 'bg-green-100 text-green-800 border border-green-200'
                                                        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                                        }`}>
                                                        {sample.status || 'Pending'}
                                                    </span>
                                                    {sample.status === 'Completed' && sample.id && (
                                                        <a
                                                            href={`/print/report/${sample.id}?ownerId=${dataSourceId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded text-xs font-semibold transition flex items-center gap-1 shadow-sm"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <i className="fas fa-file-medical"></i>
                                                            View Report
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setShowHistory(false)}
                        className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg transition font-semibold mt-4"
                    >
                        <i className="fas fa-times mr-2"></i>
                        Close
                    </button>
                </Modal>
            )}
        </Modal>
    );
}
