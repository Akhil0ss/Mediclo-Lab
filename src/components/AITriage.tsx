/**
 * AI Patient Triage Component
 * 
 * Automatically assigns priority and suggests doctor specialty
 * based on symptoms and vitals
 */

'use client';

import { useState, useEffect } from 'react';
import { triagePatient } from '@/lib/groqAI';

interface AITriageProps {
    complaints: string;
    vitals: { bp?: string; pulse?: string; temp?: string; spo2?: string };
    age: number;
    onTriageComplete?: (result: any) => void;
    autoTriage?: boolean;
}

export default function AITriage({
    complaints,
    vitals,
    age,
    onTriageComplete,
    autoTriage = false
}: AITriageProps) {
    const [triaging, setTriaging] = useState(false);
    const [triage, setTriage] = useState<any>(null);

    useEffect(() => {
        if (autoTriage && complaints && !triage) {
            handleTriage();
        }
    }, [autoTriage, complaints]);

    const handleTriage = async () => {
        if (!complaints) return;

        setTriaging(true);
        try {
            const result = await triagePatient(complaints, vitals, age);
            setTriage(result);
            onTriageComplete?.(result);
        } catch (err) {
            console.error(err);
        } finally {
            setTriaging(false);
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'emergency': return 'bg-red-600 text-white';
            case 'high': return 'bg-orange-500 text-white';
            case 'medium': return 'bg-yellow-500 text-white';
            default: return 'bg-green-500 text-white';
        }
    };

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case 'emergency': return 'fa-ambulance';
            case 'high': return 'fa-exclamation-circle';
            case 'medium': return 'fa-clock';
            default: return 'fa-check-circle';
        }
    };

    return (
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-4 border border-cyan-200">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg flex items-center justify-center">
                        <i className="fas fa-stethoscope text-white text-sm"></i>
                    </div>
                    <h3 className="font-bold text-gray-800">AI Triage</h3>
                </div>

                {!autoTriage && (
                    <button
                        onClick={handleTriage}
                        disabled={triaging || !complaints}
                        className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                    >
                        {triaging ? (
                            <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-user-md mr-2"></i>
                                Assess Priority
                            </>
                        )}
                    </button>
                )}
            </div>

            {triaging && (
                <div className="text-center py-4">
                    <i className="fas fa-spinner fa-spin text-cyan-600 text-2xl"></i>
                    <p className="text-sm text-gray-600 mt-2">Analyzing patient condition...</p>
                </div>
            )}

            {triage && !triaging && (
                <div className="space-y-3">
                    {/* Priority Badge */}
                    <div className={`${getPriorityColor(triage.priority)} rounded-lg p-4 text-center`}>
                        <i className={`fas ${getPriorityIcon(triage.priority)} text-3xl mb-2`}></i>
                        <div className="font-bold text-lg uppercase">{triage.priority} Priority</div>
                    </div>

                    {/* Reason */}
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <h4 className="font-bold text-sm text-gray-800 mb-1">Assessment:</h4>
                        <p className="text-sm text-gray-700">{triage.reason}</p>
                    </div>

                    {/* Suggested Doctor */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h4 className="font-bold text-sm text-blue-800 mb-1">Recommended Specialist:</h4>
                        <div className="flex items-center gap-2">
                            <i className="fas fa-user-md text-blue-600"></i>
                            <span className="text-sm font-semibold text-gray-800 capitalize">{triage.suggestedDoctor}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
