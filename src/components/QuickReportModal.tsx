'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, onValue, push, set, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { generateSequentialId } from '@/lib/idGenerator';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import AIReportAnalysis from './AIReportAnalysis';
import { defaultTemplates } from '@/lib/defaultTemplates';

interface QuickReportModalProps {
    onClose: () => void;
    ownerId: string;
    patients?: any[];
    doctors?: any[];
    initialSampleId?: string;
}

import { useSubscription } from '@/contexts/SubscriptionContext';

export default function QuickReportModal({ onClose, ownerId, initialSampleId }: QuickReportModalProps) {
    const { user } = useAuth();
    const { isPremium } = useSubscription();
    const router = useRouter();
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [selectedSampleId, setSelectedSampleId] = useState('');
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [selectedExternalDoctorId, setSelectedExternalDoctorId] = useState('');
    const [selectedTests, setSelectedTests] = useState<string[]>([]);
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);



    const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [patients, setPatients] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [templates, setTemplates] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [samples, setSamples] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [doctors, setDoctors] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [externalDoctors, setExternalDoctors] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [testResults, setTestResults] = useState<any>({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [branding, setBranding] = useState<any>({});

    useEffect(() => {
        if (!user || !ownerId) return;

        const patientsRef = ref(database, `patients/${ownerId}`);
        const templatesRef = ref(database, `templates/${ownerId}`);
        const samplesRef = ref(database, `samples/${ownerId}`);
        const doctorsRef = ref(database, `doctors/${ownerId}`);
        const externalDoctorsRef = ref(database, `externalDoctors/${ownerId}`);
        const brandingRef = ref(database, `branding/${ownerId}`);

        const unsubscribes = [
            onValue(patientsRef, (snapshot) => {
                const data: any[] = [];
                snapshot.forEach(child => { data.push({ id: child.key, ...child.val() }); });
                setPatients(data);
            }),
            onValue(templatesRef, (snapshot) => {
                const userTemplates: any[] = [];
                snapshot.forEach(child => { userTemplates.push({ id: child.key, ...child.val() }); });

                // Merge with local defaultTemplates using consistent ID generation
                const formattedDefaults = defaultTemplates.map((t, idx) => ({
                    ...t,
                    id: `SYS-${idx}-${t.name.replace(/\s+/g, '-')}`,
                    isSystem: true
                }));

                const combined = [...userTemplates, ...formattedDefaults];
                setTemplates(combined);
            }),
            onValue(samplesRef, (snapshot) => {
                const data: any[] = [];
                snapshot.forEach(child => { data.push({ id: child.key, ...child.val() }); });
                setSamples(data.filter(s => s.status !== 'Completed'));
            }),
            onValue(doctorsRef, (snapshot) => {
                const data: any[] = [];
                snapshot.forEach(child => { data.push({ id: child.key, ...child.val() }); });
                setDoctors(data);
                const defaultDoctor = data.find(d => d.isDefault);
                if (defaultDoctor) setSelectedDoctorId(defaultDoctor.id);
            }),
            onValue(externalDoctorsRef, (snapshot) => {
                const data: any[] = [];
                snapshot.forEach(child => { data.push({ id: child.key, ...child.val() }); });
                setExternalDoctors(data);
            }),
            onValue(brandingRef, (snapshot) => {
                setBranding(snapshot.val() || {});
            })
        ];

        return () => unsubscribes.forEach(unsub => unsub());
    }, [user, ownerId]);

    // Auto-load tests when sample is selected with ROBUST ID/NAME Matching
    useEffect(() => {
        if (selectedSampleId && templates.length > 0) {
            const sample = samples.find(s => s.id === selectedSampleId);
            if (sample) {
                let idsToUse: string[] = [];
                const sampleTestIds = sample.testIds || [];
                const sampleTestNames = sample.tests || [];

                // 1. First, check if saved IDs are valid in current templates
                if (Array.isArray(sampleTestIds)) {
                    const validIds = sampleTestIds.filter((id: string) => templates.some(t => t.id === id));
                    idsToUse = [...validIds];
                }

                // 2. If IDs didn't match (or were missing), try matching by Name (Fallback)
                if (Array.isArray(sampleTestNames)) {
                    // Find templates where name matches AND id isn't already added
                    const templatesByName = templates.filter(t =>
                        sampleTestNames.includes(t.name) && !idsToUse.includes(t.id)
                    );
                    const nameBasedIds = templatesByName.map(t => t.id);
                    idsToUse = [...idsToUse, ...nameBasedIds];
                }

                // 3. Fallback for legacy "testTemplates" object structure if exists
                if (idsToUse.length === 0 && sample.testTemplates && Array.isArray(sample.testTemplates)) {
                    const fromObj = sample.testTemplates
                        .map((tt: any) => templates.find(t => t.name === tt.name)?.id)
                        .filter((id: any) => id); // filter undefined
                    idsToUse = [...fromObj];
                }

                // Deduplicate
                idsToUse = Array.from(new Set(idsToUse));

                console.log('Sample matched templates:', idsToUse);
                setSelectedTests(idsToUse);
            }
        }
    }, [selectedSampleId, samples, templates]);

    // Auto-select initial sample if provided
    useEffect(() => {
        if (initialSampleId && samples.length > 0) {
            const sample = samples.find(s => s.id === initialSampleId);
            if (sample) {
                setSelectedSampleId(sample.id);
                if (sample.patientId) {
                    setSelectedPatientId(sample.patientId);
                }
            }
        }
    }, [initialSampleId, samples]);



    const handleResultChange = (testId: string, subtestIndex: number, value: string) => {
        setTestResults((prev: any) => {
            const updated = {
                ...prev,
                [testId]: {
                    ...prev[testId],
                    [subtestIndex]: value
                }
            };

            // Trigger auto-calculation after state update
            setTimeout(() => calculateDependencies(updated), 0);

            return updated;
        });
    };

    // Auto-calculate dependent test parameters based on formulas
    const calculateDependencies = (currentResults: any) => {
        const updatedResults = { ...currentResults };
        let hasChanges = false;

        selectedTests.forEach(testId => {
            const template = templates.find(t => t.id === testId);
            if (!template) return;

            // Build a map of parameter names to values for this test
            const values: Record<string, number> = {};
            template.subtests.forEach((subtest: any, index: number) => {
                const value = parseFloat(updatedResults[testId]?.[index]);
                if (!isNaN(value)) {
                    values[subtest.name] = value;
                }
            });

            // Process inputs with formulas
            template.subtests.forEach((subtest: any, index: number) => {
                const formula = subtest.formula;
                if (!formula) return; // Skip if no formula

                let calculatedFormula = formula;
                let canCalculate = true;

                // Replace all {Parameter Name} placeholders with actual values
                const paramMatches = formula.match(/\{([^}]+)\}/g);
                if (paramMatches) {
                    paramMatches.forEach((match: string) => {
                        const paramName = match.replace(/[{}]/g, '');
                        if (values[paramName] !== undefined) {
                            calculatedFormula = calculatedFormula.replace(match, values[paramName].toString());
                        } else {
                            canCalculate = false;
                        }
                    });
                }

                // Calculate if all required parameters are available
                if (canCalculate) {
                    try {
                        // eslint-disable-next-line no-eval
                        const result = eval(calculatedFormula);
                        if (!isNaN(result) && isFinite(result)) {
                            const roundedResult = result.toFixed(2);
                            if (updatedResults[testId]?.[index] !== roundedResult) {
                                updatedResults[testId] = updatedResults[testId] || {};
                                updatedResults[testId][index] = roundedResult;
                                hasChanges = true;
                            }
                        }
                    } catch (error) {
                        console.error('Formula calculation error:', error);
                    }
                } else {
                    // Clear the field if dependencies are not met
                    if (updatedResults[testId]?.[index]) {
                        updatedResults[testId][index] = '';
                        hasChanges = true;
                    }
                }
            });
        });

        if (hasChanges) {
            setTestResults(updatedResults);
        }
    };

    const handleSubmit = async () => {
        if (!user || !ownerId) return;

        if (!selectedPatientId) {
            alert('⚠️ Please select a patient first!');
            return;
        }

        if (!selectedSampleId) {
            alert('⚠️ Please select a sample first!');
            return;
        }

        if (selectedTests.length === 0) {
            alert('No tests found in the selected sample.');
            return;
        }

        const patientData = patients.find(p => p.id === selectedPatientId);
        const sampleData = samples.find(s => s.id === selectedSampleId);
        const doctorData = selectedDoctorId
            ? doctors.find(d => d.id === selectedDoctorId)
            : selectedExternalDoctorId
                ? externalDoctors.find(d => d.id === selectedExternalDoctorId)
                : null;

        if (!patientData) {
            alert('Patient not found');
            return;
        }

        setLoading(true);

        try {
            // Generate sequential IDs with premium status from subscription
            const reportId = await generateSequentialId(
                ownerId, // Use ownerId
                'report',
                branding.labName,
                isPremium
            );

            // We use the existing sample ID
            const sampleId = sampleData?.sampleNumber || 'UNKNOWN';

            const reportData = {
                reportId,
                patientId: selectedPatientId,
                patientName: patientData.name,
                patientAge: patientData.age,
                patientGender: patientData.gender,
                patientMobile: patientData.mobile,
                patientAddress: patientData.address || '',
                refDoctor: doctorData?.name || patientData.refDoctor || '',
                refDoctorId: selectedDoctorId || '',
                testName: selectedTests.map(id => templates.find(t => t.id === id)?.name).join(', '),
                tests: selectedTests.map(id => templates.find(t => t.id === id)?.name),
                testDetails: selectedTests.map(testId => {
                    const template = templates.find(t => t.id === testId);
                    if (!template) return null;

                    return {
                        testId,
                        testName: template.name,
                        category: template.category,
                        subtests: template.subtests.map((subtest: any, index: number) => {
                            const value = testResults[testId]?.[index] || '';
                            const ranges = patientData.gender === 'Male' ? subtest.ranges.male : subtest.ranges.female;

                            // Calculate threat level (Corrected Logic)
                            let threatLevel = 'Normal';
                            const numValue = parseFloat(value);

                            // Only calculate if value is a number and ranges exist
                            if (!isNaN(numValue) && ranges && ranges.min !== undefined && ranges.max !== undefined) {
                                const min = parseFloat(ranges.min);
                                const max = parseFloat(ranges.max);

                                // Check Critical First (30% deviation)
                                // Use 0.7 for min and 1.3 for max as critical boundaries? 
                                // Actually, typical lab logic:
                                // Low: < Min
                                // High: > Max
                                // Critical: < Min*0.7 OR > Max*1.3 (Example)

                                // Let's simplify to: warning if out of range, critical if significantly out
                                if (numValue < min || numValue > max) {
                                    threatLevel = 'warning';

                                    // Check if it's REALLY bad (e.g. 20% off)
                                    const rangeSpan = max - min;
                                    if (numValue < min - (rangeSpan * 0.5) || numValue > max + (rangeSpan * 0.5)) {
                                        threatLevel = 'critical';
                                    }
                                }
                            }

                            return {
                                name: subtest.name,
                                unit: subtest.unit,
                                value,
                                ranges,
                                threatLevel // Pass the calculated threat level to the PDF
                            };
                        })
                    };
                }).filter(Boolean),
                reportDate,
                createdAt: new Date().toISOString(),
                sampleId,
                sampleType: sampleData?.sampleType || 'Other',
                sampleCollectionTime: sampleData?.date ? new Date(sampleData.date).toTimeString().slice(0, 5) : '',
                fastingStatus: 'Not Specified',
                labName: branding.labName || 'Spotnet MedOS',
                labBranding: branding,
                aiAnalysis: aiAnalysisResult // Include Captured AI Analysis
            };

            await set(ref(database, `reports/${ownerId}/${reportId}`), reportData);

            // Update sample status to Completed
            await update(ref(database, `samples/${ownerId}/${selectedSampleId}`), {
                status: 'Completed',
                completedAt: new Date().toISOString(),
                reportId: reportId
            });

            alert('Report generated successfully!');
            onClose();

            // Open print view
            setTimeout(() => {
                window.open(`/print/report/${reportId}?ownerId=${ownerId}`, '_blank');
            }, 500);

        } catch (error) {
            console.error('Error generating report:', error);
            alert('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };



    return (
        <Modal isOpen={true} onClose={onClose}>
            <h3 className="text-2xl font-bold mb-6">
                <i className="fas fa-plus-circle text-blue-600 mr-2"></i>
                Quick Report Generation
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

            {/* Sample Selection - Only Samples for Selected Patient */}
            <div className="mb-6">
                <label className="block font-semibold mb-2">Select Sample: *</label>
                {selectedPatientId ? (
                    samples.filter(s => s.patientId === selectedPatientId).length === 0 ? (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-yellow-800 text-sm">
                                <i className="fas fa-info-circle mr-2"></i>
                                No pending samples found for this patient. Please <strong
                                    className="cursor-pointer underline text-blue-700 hover:text-blue-900"
                                    onClick={() => {
                                        onClose();
                                        router.push(`/dashboard/samples?action=add&patientId=${selectedPatientId}`);
                                    }}
                                >
                                    add a sample
                                </strong> in the <strong>Samples Tab</strong> first.
                            </p>
                        </div>
                    ) : (
                        <select
                            value={selectedSampleId}
                            onChange={(e) => setSelectedSampleId(e.target.value)}
                            className="w-full p-3 border rounded-lg"
                            required
                        >
                            <option value="">Choose a sample to report</option>
                            {samples
                                .filter(s => s.patientId === selectedPatientId)
                                .map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.sampleNumber} - {s.sampleType} ({new Date(s.date).toLocaleDateString()})
                                    </option>
                                ))}
                        </select>
                    )
                ) : (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm">
                        Select a patient first to see available samples.
                    </div>
                )}
            </div>

            {/* Referring Doctor Selection - Two Separate Dropdowns */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Internal Doctor */}
                <div>
                    <label className="block font-semibold mb-2">Internal Doctor:</label>
                    {doctors.length === 0 ? (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-blue-800 text-xs">
                                <i className="fas fa-info-circle mr-1"></i>
                                No internal doctors found.
                            </p>
                        </div>
                    ) : (
                        <select
                            value={selectedDoctorId}
                            onChange={(e) => {
                                setSelectedDoctorId(e.target.value);
                                if (e.target.value) setSelectedExternalDoctorId(''); // Clear external if internal selected
                            }}
                            className="w-full p-3 border rounded-lg"
                        >
                            <option value="">Select Internal Doctor</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>
                                    Dr. {d.name} - {d.specialization || 'General'}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* External Referring Doctor */}
                <div>
                    <label className="block font-semibold mb-2">External Referring Doctor:</label>
                    {externalDoctors.length === 0 ? (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-yellow-800 text-xs">
                                <i className="fas fa-info-circle mr-1"></i>
                                No external doctors found.
                            </p>
                        </div>
                    ) : (
                        <select
                            value={selectedExternalDoctorId}
                            onChange={(e) => {
                                setSelectedExternalDoctorId(e.target.value);
                                if (e.target.value) setSelectedDoctorId(''); // Clear internal if external selected
                            }}
                            className="w-full p-3 border rounded-lg"
                        >
                            <option value="">Select External Doctor</option>
                            {externalDoctors.map(d => (
                                <option key={d.id} value={d.id}>
                                    Dr. {d.name} {d.clinicInfo ? `- ${d.clinicInfo}` : ''}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Report Date */}
            <div className="mb-6">
                <label className="block font-semibold mb-2">Report Date:</label>
                <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                />
            </div>

            {/* Test Results Entry */}
            {selectedTests.length > 0 && (
                <div className="mb-6">
                    <h4 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">Enter Test Results:</h4>
                    <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {selectedTests.map(testId => {
                            const template = templates.find(t => t.id === testId);
                            if (!template) return null;

                            return (
                                <div key={testId} className="mb-6 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                        <h5 className="font-bold text-gray-800 text-md">{template.name}</h5>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-700 uppercase font-semibold text-xs">
                                                <tr>
                                                    <th className="px-4 py-2 border-r border-gray-200 w-1/3">Test Parameter</th>
                                                    <th className="px-4 py-2 border-r border-gray-200">Result Value</th>
                                                    <th className="px-4 py-2 text-gray-500 w-1/4">Unit</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {template.subtests.map((subtest: any, index: number) => {
                                                    const hasFormula = subtest.formula ? true : false;
                                                    const isTextType = subtest.type === 'text' || !subtest.unit;

                                                    return (
                                                        <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                                                            <td className="px-4 py-2 font-medium text-gray-700 border-r border-gray-100">
                                                                {subtest.name}
                                                            </td>
                                                            <td className="px-4 py-2 border-r border-gray-100 p-0">
                                                                {!hasFormula ? (
                                                                    <textarea
                                                                        rows={1}
                                                                        value={testResults[testId]?.[index] || ''}
                                                                        onChange={(e) => handleResultChange(testId, index, e.target.value)}
                                                                        placeholder=""
                                                                        className="w-full px-4 py-2 bg-transparent focus:bg-blue-50 outline-none transition font-semibold text-blue-900 resize-none overflow-y-auto block leading-normal"
                                                                        style={{ minHeight: '42px', maxHeight: '96px' }}
                                                                        onInput={(e) => {
                                                                            const target = e.target as HTMLTextAreaElement;
                                                                            target.style.height = 'auto';
                                                                            target.style.height = `${target.scrollHeight}px`;
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        value={testResults[testId]?.[index] || ''}
                                                                        readOnly={true}
                                                                        title={`Auto-calculated: ${subtest.formula}`}
                                                                        placeholder="Calculated"
                                                                        className="w-full h-full px-4 py-2 bg-gray-50 text-gray-400 font-mono text-xs cursor-not-allowed outline-none"
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2 text-gray-400 text-xs">
                                                                {subtest.unit || '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* AI Report Analysis */}
            {selectedTests.length > 0 && selectedPatientId && (
                <AIReportAnalysis
                    testResults={selectedTests.flatMap(testId => {
                        const template = templates.find(t => t.id === testId);
                        if (!template) return [];
                        return template.subtests.map((subtest: any, index: number) => ({
                            test: subtest.name,
                            value: testResults[testId]?.[index] || '',
                            unit: subtest.unit || '',
                            normalRange: subtest.ranges ? `${subtest.ranges.male?.min || subtest.ranges.female?.min}-${subtest.ranges.male?.max || subtest.ranges.female?.max}` : undefined
                        }));
                    })}
                    patientAge={patients.find(p => p.id === selectedPatientId)?.age || 0}
                    patientGender={patients.find(p => p.id === selectedPatientId)?.gender || 'M'}
                    onAnalysisComplete={(analysis) => setAiAnalysisResult(analysis)}
                />
            )
            }

            {/* Action Buttons */}
            <div className="flex gap-3 mt-8">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-blue-800 font-semibold shadow-md transition-all disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <i className="fas fa-spinner fa-spin mr-2"></i> Generating...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-check-circle mr-2"></i> Generate Report
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
