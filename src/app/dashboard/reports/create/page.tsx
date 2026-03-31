'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, onValue, push, get, update, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { generateReportId } from '@/lib/idGenerator';
import { calculateBilling } from '@/lib/billingCalculator';
import { createReportReadyNotification } from '@/lib/notificationManager';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AIReportAnalysis from '@/components/AIReportAnalysis';
import { defaultTemplates } from '@/lib/defaultTemplates';
import { mergeTemplates } from '@/lib/templateUtils';

interface Patient {
    id: string;
    patientId?: string; // Readable ID
    name: string;
    age: number;
    gender: string;
    mobile: string;
    refDoctor?: string;
}

interface Parameter {
    id: string;
    name: string;
    unit: string;
    refRange: string;
}

interface Template {
    id: string;
    name: string;
    category?: string;
    rate?: string;
    price?: number | string;
    totalPrice?: number;
    parameters?: Parameter[];
    subtests?: any[];
}

export default function CreateReportPage() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const sampleIdQuery = searchParams.get('sampleId');

    const [patients, setPatients] = useState<Patient[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);

    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [referredBy, setReferredBy] = useState('Self');
    const [loadedSample, setLoadedSample] = useState<any>(null);

    const [results, setResults] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!user || !userProfile) return;

        const allowedRoles = ['owner', 'lab'];
        if (!allowedRoles.includes(userProfile.role)) {
            router.push('/dashboard/reports');
            return;
        }

        const dataSourceId = userProfile.ownerId || user.uid;

        // Safety: If the user is staff but ownerId isn't loaded yet, wait.
        if (userProfile.role === 'lab' && !userProfile.ownerId) {
            console.log('⏳ Reports: Waiting for Laboratory Owner ID sync...');
            return;
        }

        // Fetch Patients
        const patientsUnsub = onValue(ref(database, `patients/${dataSourceId}`), (snapshot) => {
            const data: Patient[] = [];
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() } as Patient);
            });
            setPatients(data);
        });

        // Fetch Templates (user templates + default templates)
        const userTemplatesRef = ref(database, `templates/${dataSourceId}`);
        const templatesUnsub = onValue(userTemplatesRef, (snapshot) => {
            const userTemplates: any[] = [];
            snapshot.forEach((child) => {
                userTemplates.push({ id: child.key, ...child.val() });
            });

            // Use centralized mergeTemplates to prevent duplicates and prioritize overrides
            const combined = mergeTemplates(userTemplates);
            setTemplates(combined as unknown as Template[]);
        });

        return () => {
            patientsUnsub();
            templatesUnsub();
        };
    }, [user, userProfile]);

    // Handle Sample Pre-fill and Doctor Sync
    useEffect(() => {
        if (!user || !userProfile || patients.length === 0) return;

        // Auto-fill Doctor from selected patient
        if (selectedPatientId) {
            const patient = patients.find(p => p.id === selectedPatientId);
            if (patient?.refDoctor) {
                setReferredBy(patient.refDoctor);
            }
        }

        if (!sampleIdQuery) return;

        const loadSample = async () => {
            const dataSourceId = userProfile.ownerId || user.uid;
            const snapshot = await get(ref(database, `samples/${dataSourceId}/${sampleIdQuery}`));
            if (snapshot.exists()) {
                const sample = snapshot.val();
                setLoadedSample(sample);
                if (sample.patientId) setSelectedPatientId(sample.patientId);
                
                // Inherit doctor from sample if available
                if (sample.patientRefDoctor) {
                    setReferredBy(sample.patientRefDoctor);
                }
            }
        };
        loadSample();
    }, [sampleIdQuery, selectedPatientId, user, userProfile, patients]);

    // Helper function to calculate formulas
    const calculateFormula = (formula: string, resultsMap: Record<string, string>, parameters: any[] = []): string => {
        try {
            let expression = formula;
            let canCalculate = true;

            // Replace all {Parameter Name} placeholders
            const paramMatches = formula.match(/\{([^}]+)\}/g);
            if (paramMatches) {
                paramMatches.forEach(match => {
                    const paramName = match.replace(/[{}]/g, '');
                    const value = resultsMap[paramName];

                    if (value && !isNaN(parseFloat(value))) {
                        expression = expression.replace(match, value);
                    } else {
                        canCalculate = false;
                    }
                });
            }

            if (!canCalculate) return '';

            // Evaluate the expression safely
            // eslint-disable-next-line no-eval
            const result = eval(expression);
            return isNaN(result) || !isFinite(result) ? '' : Number.isInteger(result) ? result.toString() : result.toFixed(2);
        } catch (error) {
            return '';
        }
    };

    // Calculate threat level for a value
    const calculateThreatLevel = (value: string, ranges: any, type: string = 'numeric'): string => {
        if (type !== 'numeric' || !value || !ranges) return 'normal';

        const numValue = parseFloat(value);
        if (isNaN(numValue)) return 'normal';

        const min = parseFloat(ranges.min);
        const max = parseFloat(ranges.max);

        if (isNaN(min) || isNaN(max)) return 'normal';

        // Critical: 30% deviation from normal range extremes
        // Lower Critical: < 70% of min
        // Upper Critical: > 130% of max
        if (numValue < min * 0.7 || numValue > max * 1.3) {
            return 'critical';
        }

        // Warning: Outside normal range but not critical
        if (numValue < min || numValue > max) {
            return 'warning';
        }

        return 'normal';
    };

    const handleTemplateChange = (templateId: string) => {
        setSelectedTemplateId(templateId);
        setResults({}); // Reset results when template changes
    };

    const handleResultChange = (paramName: string, value: string) => {
        setResults(prev => ({
            ...prev,
            [paramName]: value
        }));
    };

    // Get selected template and patient
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    const selectedPatient = patients.find(p => p.id === selectedPatientId);

    // Real-time auto-calculation effect
    useEffect(() => {
        if (!selectedTemplate) return;

        const params = selectedTemplate.subtests || selectedTemplate.parameters || [];
        const newResults = { ...results };
        let hasChanges = false;

        params.forEach((param: any) => {
            if (param.formula) {
                // Determine dependencies - naive approach: calculate all formulas
                const calculated = calculateFormula(param.formula, results, params);

                // Only update if value changed and is not empty (or clear if it became invalid)
                if (calculated !== undefined && calculated !== (results[param.name] || '')) {
                    newResults[param.name] = calculated;
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            setResults(newResults);
        }
    }, [results, selectedTemplate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !userProfile) return;

        // Validation: Select Patient and Template
        if (!selectedPatientId || !selectedTemplateId) {
            alert('Please select BOTH a Patient and a Test Template before saving.');
            return;
        }

        const patient = patients.find(p => p.id === selectedPatientId);
        const template = templates.find(t => t.id === selectedTemplateId);

        if (!patient || !template) {
            alert('Invalid Patient or Template selected. Please try again.');
            return;
        }

        try {
            // Generate Auto Report ID
            const dataSourceId = userProfile?.ownerId || user.uid;
            
            // Wait for ID generation
            const reportId = await generateReportId(dataSourceId, userProfile?.labName || 'CLINIC');
            
            if (!reportId) {
                throw new Error('Could not generate a valid Report ID. Please check your connectivity.');
            }

            // Build testDetails array with proper structure for print page
            const params = template.subtests || template.parameters || [];

            const testDetails = [{
                testName: template.name,
                category: template.category || 'General',
                subtests: params.map((param: any) => {
                    // Ensure latest calculations are used
                    let value = results[param.name] || '';

                    if (param.formula && !value) {
                        value = calculateFormula(param.formula, results, params);
                    }

                    const numValue = parseFloat(value || 'NaN');

                    // Determine ranges based on patient gender
                    let ranges = param.ranges || {};
                    if (param.ranges?.male && param.ranges?.female) {
                        ranges = (patient.gender || 'Male').toLowerCase() === 'male' ? param.ranges.male : param.ranges.female;
                    }

                    // Calculate threat level (matching legacy app logic)
                    let threatLevel = 'normal';
                    if (param.type === 'numeric' && !isNaN(numValue) && ranges.min !== undefined && ranges.max !== undefined) {
                        const min = parseFloat(ranges.min);
                        const max = parseFloat(ranges.max);

                        // Critical: 30% beyond normal range extremes
                        if (numValue < min * 0.7 || numValue > max * 1.3) {
                            threatLevel = 'critical';
                        }
                        // Warning: Outside normal range but not critical
                        else if (numValue < min || numValue > max) {
                            threatLevel = 'warning';
                        }
                    }

                    return {
                        name: param.name || 'Unnamed Parameter',
                        value: value || '',
                        unit: param.unit || '',
                        ranges: {
                            min: ranges.min !== undefined ? ranges.min : '',
                            max: ranges.max !== undefined ? ranges.max : ''
                        },
                        type: param.type || 'numeric',
                        threatLevel: threatLevel
                    };
                })
            }];

            const reportData = {
                reportId,
                patientId: patient.id, // Firebase Key
                patientDisplayId: patient.patientId || '', // Readable ID
                patientName: patient.name || 'Unknown',
                patientAge: patient.age || 0,
                patientGender: patient.gender || 'Unknown',
                patientMobile: patient.mobile || '',
                patientRefDoctor: referredBy || patient.refDoctor || 'Self',
                testId: template.id,
                testName: template.name,
                sampleId: loadedSample?.sampleId || loadedSample?.sampleNumber || '',
                sampleType: loadedSample?.sampleType || 'Specimen',
                price: template.totalPrice || template.rate || 0,
                testDetails: testDetails,
                reportDate: reportDate || new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString(),
                status: 'Completed',
                labName: userProfile.labName || 'Clinic'
            };

            await push(ref(database, `reports/${dataSourceId}`), reportData);

            // ---------------------------------------------------------
            // AUTO-INVOICE GENERATION on Report Generation
            // ---------------------------------------------------------
            try {
                const today = new Date().toISOString().split('T')[0];
                const invoiceKey = `inv_${patient.id}_${today}`;
                const invRef = ref(database, `invoices/${dataSourceId}/${invoiceKey}`);
                const invSnapshot = await get(invRef);
                
                let newlyAddedPrice = 0;
                const newItemsToAdd = testDetails.map(td => {
                    // template is already found above as `template`
                    const price = parseFloat(String(template.totalPrice || template.price || template.rate || 0)) || 0;
                    newlyAddedPrice += price;
                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        name: td?.testName || template.name || 'Lab Test',
                        quantity: 1,
                        rate: price,
                        amount: price
                    };
                }).filter(Boolean);

                if (invSnapshot.exists()) {
                    const existingInv = invSnapshot.val();
                    const updatedItems = [...(existingInv.items || []), ...newItemsToAdd];
                    
                    const b = calculateBilling(
                        updatedItems,
                        existingInv.discountPercent || 0,
                        existingInv.gstPercent || 0,
                        existingInv.paid || 0
                    );
                    
                    await update(invRef, {
                        ...b,
                        items: updatedItems,
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    const invNum = `INV-${Math.floor(Date.now() / 1000) % 10000}`;
                    const b = calculateBilling(newItemsToAdd, 0, 0, 0);
                    
                    const invData = {
                        invoiceId: invoiceKey,
                        invoiceNumber: invNum,
                        patientId: patient.id,
                        patientName: patient.name,
                        ...b,
                        items: newItemsToAdd,
                        paymentMode: 'Cash',
                        includeGST: false,
                        visitDate: today,
                        createdAt: new Date().toISOString(),
                        createdBy: user.uid
                    };
                    await set(invRef, invData);
                }
            } catch (invErr) {
                console.error("Auto Invoice Error:", invErr);
            }
            // ---------------------------------------------------------

            // Update Sample status if applicable
            if (sampleIdQuery) {
                await update(ref(database, `samples/${dataSourceId}/${sampleIdQuery}`), {
                    reportGenerated: true,
                    status: 'Completed'
                });
            }

            // Trigger Notification for Patient
            await createReportReadyNotification(
                patient.id,
                reportId,
                template.name
            );

            router.push('/dashboard/reports');
        } catch (error) {
            console.error('Error creating report:', error);
            alert('Failed to create report. Details: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };



    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard/reports" className="text-gray-500 hover:text-gray-700">
                    <i className="fas fa-arrow-left text-xl"></i>
                </Link>
                <h1 className="text-3xl font-bold text-gray-800">Create New Lab Report</h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                {/* Linked Sample Banner */}
                {loadedSample && (
                    <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 animate-fade-in">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-100 p-3 rounded-full shrink-0">
                                <i className="fas fa-vial text-blue-600 text-lg"></i>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                    Linked Sample: <span className="text-blue-700 font-mono">{loadedSample.sampleNumber}</span>
                                </h4>
                                <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                    <span><i className="fas fa-calendar-alt text-gray-400 mr-1"></i> {new Date(loadedSample.date).toLocaleString()}</span>
                                    <span><i className="fas fa-flask text-gray-400 mr-1"></i> {loadedSample.sampleType}</span>
                                    {loadedSample.collectedBy && <span><i className="fas fa-user-nurse text-gray-400 mr-1"></i> {loadedSample.collectedBy}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-gray-500 mb-1 font-semibold uppercase">Sample Status</div>
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${loadedSample.status === 'Completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                                loadedSample.status === 'Processing' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                    'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                }`}>
                                {loadedSample.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                )}

                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Select Patient</label>
                        <select
                            value={selectedPatientId}
                            onChange={(e) => setSelectedPatientId(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            required
                        >
                            <option value="">-- Select Patient --</option>
                            {patients.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.age}/{p.gender}) - {p.mobile}</option>
                            ))}
                        </select>
                        <div className="mt-2 text-right">
                            <Link href="/dashboard/patients" className="text-sm text-purple-600 hover:underline">+ Add New Patient</Link>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Select Test Template</label>
                        <select
                            value={selectedTemplateId}
                            onChange={(e) => handleTemplateChange(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            required
                        >
                            <option value="">-- Select Template --</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <div className="mt-2 text-right">
                            <Link href="/dashboard/templates" className="text-sm text-purple-600 hover:underline">+ Manage Templates</Link>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Report Date</label>
                        <input
                            type="date"
                            value={reportDate}
                            onChange={(e) => setReportDate(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Referred By (Doctor)</label>
                        <input
                            type="text"
                            value={referredBy}
                            onChange={(e) => setReferredBy(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="Dr. Name or Self"
                        />
                    </div>
                </div>

                <hr className="my-8 border-gray-200" />

                {/* Test Parameters Input */}
                {selectedTemplate ? (
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                            <i className="fas fa-flask text-blue-500 mr-2"></i>
                            Enter Results for {selectedTemplate.name}
                        </h3>

                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="grid grid-cols-12 gap-4 mb-2 font-semibold text-gray-600 text-sm uppercase tracking-wide border-b pb-2">
                                <div className="col-span-5 md:col-span-4">Parameter</div>
                                <div className="col-span-4 md:col-span-4">Result Value</div>
                                <div className="col-span-3 md:col-span-4 text-center">Reference Range</div>
                            </div>

                            {(selectedTemplate.subtests || selectedTemplate.parameters || []).map((param: any, index: number) => {
                                const value = results[param.name] || '';

                                // Determine ranges based on patient gender
                                let ranges = param.ranges || {};
                                if (param.ranges?.male && param.ranges?.female && selectedPatient) {
                                    ranges = selectedPatient.gender === 'Male' ? param.ranges.male : param.ranges.female;
                                }

                                const threatLevel = calculateThreatLevel(value, ranges, param.type);
                                const hasFormula = !!param.formula;

                                // Threat level colors
                                let borderColor = 'border-gray-300';
                                let bgColor = 'bg-white';
                                let textColor = 'text-gray-900';

                                if (value) {
                                    if (threatLevel === 'critical') {
                                        borderColor = 'border-red-500';
                                        bgColor = 'bg-red-50';
                                        textColor = 'text-red-700';
                                    } else if (threatLevel === 'warning') {
                                        borderColor = 'border-yellow-500';
                                        bgColor = 'bg-yellow-50';
                                        textColor = 'text-yellow-700';
                                    } else if (threatLevel === 'normal') {
                                        borderColor = 'border-green-500';
                                        bgColor = 'bg-green-50';
                                        textColor = 'text-green-700';
                                    }
                                }

                                return (
                                    <div key={index} className="grid grid-cols-12 gap-4 items-center mb-4 last:mb-0">
                                        <div className="col-span-5 md:col-span-4 font-medium text-gray-700">
                                            {param.name}
                                            {param.unit && <span className="text-xs text-gray-500 ml-1">({param.unit})</span>}
                                            {hasFormula && <span className="ml-2 bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded border border-blue-200" title="Auto-calculated">AUTO</span>}
                                        </div>
                                        <div className="col-span-4 md:col-span-4">
                                            <input
                                                type="text"
                                                value={value}
                                                onChange={(e) => handleResultChange(param.name, e.target.value)}
                                                className={`w-full p-2 border-2 ${borderColor} ${hasFormula ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : bgColor + ' ' + textColor} rounded focus:border-purple-500 outline-none text-center font-bold transition-colors`}
                                                placeholder={hasFormula ? 'Calculating...' : 'Enter...'}
                                                readOnly={hasFormula}
                                                tabIndex={hasFormula ? -1 : 0}
                                            />
                                        </div>
                                        <div className="col-span-3 md:col-span-4 text-sm text-center">
                                            {ranges.min && ranges.max ? (
                                                <span className="text-gray-600">{ranges.min} - {ranges.max}</span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* AI Report Analysis */}
                        {selectedPatient && results && Object.keys(results).length > 0 && (
                            <div className="mt-6">
                                <AIReportAnalysis
                                    testResults={(selectedTemplate.subtests || selectedTemplate.parameters || []).map((param: any) => ({
                                        test: param.name,
                                        value: results[param.name] || '',
                                        unit: param.unit || '',
                                        normalRange: param.ranges?.min && param.ranges?.max
                                            ? `${param.ranges.min} - ${param.ranges.max}`
                                            : undefined
                                    })).filter((t: any) => t.value)}
                                    patientAge={selectedPatient.age}
                                    patientGender={selectedPatient.gender}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
                        <i className="fas fa-flask-vial text-4xl mb-3"></i>
                        <p>Select a Test Template above to enter results</p>
                    </div>
                )}

                <div className="mt-8 flex justify-end gap-4">
                    <Link href="/dashboard/reports" className="px-6 py-3 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={!selectedTemplate}
                        className={`px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition transform hover:-translate-y-0.5 ${!selectedTemplate ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <i className="fas fa-save mr-2"></i> Save Report
                    </button>
                </div>
            </form>
        </div>
    );
}
