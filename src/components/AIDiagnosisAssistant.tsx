/**
 * AI Diagnosis Assistant Component
 * 
 * Suggests possible diagnoses based on:
 * - Patient complaints
 * - Vital signs
 * - Age and gender
 * 
 * Provides differential diagnosis with probability ratings
 */

'use client';

import { useState } from 'react';
import { suggestDiagnosis } from '@/lib/groqAI';

interface AIDiagnosisAssistantProps {
    complaints: string;
    vitals: { bp?: string; pulse?: string; temp?: string; spo2?: string; weight?: string };
    age: number;
    gender: string;
    onDiagnosisSelect?: (diagnosis: string) => void;
}

export default function AIDiagnosisAssistant({
    complaints,
    vitals,
    age,
    gender,
    onDiagnosisSelect
}: AIDiagnosisAssistantProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [diagnosis, setDiagnosis] = useState<any>(null);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        if (!complaints || !age) {
            setError('Please enter patient complaints and age');
            return;
        }

        setAnalyzing(true);
        setError('');

        try {
            const result = await suggestDiagnosis(complaints, vitals, age, gender);
            setDiagnosis(result);
        } catch (err) {
            setError('AI diagnosis failed. Please try again.');
            console.error(err);
        } finally {
            setAnalyzing(false);
        }
    };

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'emergency': return 'bg-red-600 text-white';
            case 'high': return 'bg-orange-500 text-white';
            case 'medium': return 'bg-yellow-500 text-white';
            default: return 'bg-green-500 text-white';
        }
    };

    const getProbabilityColor = (probability: string) => {
        switch (probability.toLowerCase()) {
            case 'high': return 'bg-red-100 text-red-800 border-red-300';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            default: return 'bg-blue-100 text-blue-800 border-blue-300';
        }
    };

    return (
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-4 border border-teal-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg flex items-center justify-center">
                        <i className="fas fa-diagnoses text-white text-sm"></i>
                    </div>
                    <h3 className="font-bold text-gray-800">AI Diagnosis Assistant</h3>
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
                        Differential Diagnosis
                    </span>
                </div>

                {!diagnosis && (
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing || !complaints}
                        className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {analyzing ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i>
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-brain"></i>
                                Suggest Diagnosis
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">
                    <i className="fas fa-exclamation-circle mr-2"></i>
                    {error}
                </div>
            )}

            {/* Diagnosis Results */}
            {diagnosis && (
                <div className="space-y-3">
                    {/* Urgency Level */}
                    <div className={`${getUrgencyColor(diagnosis.urgencyLevel)} rounded-lg p-3 text-center`}>
                        <div className="font-bold text-sm uppercase">Urgency: {diagnosis.urgencyLevel}</div>
                    </div>

                    {/* Possible Diagnoses */}
                    {diagnosis.possibleDiagnoses && diagnosis.possibleDiagnoses.length > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-teal-200">
                            <h4 className="font-bold text-sm text-teal-800 mb-2 flex items-center gap-2">
                                <i className="fas fa-list-ul"></i>
                                Differential Diagnosis
                            </h4>
                            <div className="space-y-2">
                                {diagnosis.possibleDiagnoses.map((dx: any, idx: number) => (
                                    <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-800 flex items-center gap-2">
                                                    {idx + 1}. {dx.name}
                                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getProbabilityColor(dx.probability)}`}>
                                                        {dx.probability} probability
                                                    </span>
                                                </div>
                                            </div>
                                            {onDiagnosisSelect && (
                                                <button
                                                    onClick={() => onDiagnosisSelect(dx.name)}
                                                    className="ml-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                                                    title="Use this diagnosis"
                                                >
                                                    <i className="fas fa-check"></i>
                                                    Accept
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-600 italic">
                                            <i className="fas fa-info-circle mr-1"></i>
                                            {dx.reasoning}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommended Tests */}
                    {diagnosis.recommendedTests && diagnosis.recommendedTests.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <h4 className="font-bold text-sm text-blue-800 mb-2 flex items-center gap-2">
                                <i className="fas fa-flask"></i>
                                Recommended Tests
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {diagnosis.recommendedTests.map((test: string, idx: number) => (
                                    <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                                        {test}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Clinical Note */}
                    {diagnosis.differentialNote && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <h4 className="font-bold text-sm text-purple-800 mb-1 flex items-center gap-2">
                                <i className="fas fa-notes-medical"></i>
                                Clinical Note
                            </h4>
                            <p className="text-sm text-gray-700">{diagnosis.differentialNote}</p>
                        </div>
                    )}

                    {/* Action Buttons - Accept or Cancel */}
                    <div className="flex gap-2">
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold transition"
                        >
                            <i className="fas fa-redo mr-2"></i>
                            Re-analyze
                        </button>
                        <button
                            onClick={() => setDiagnosis(null)}
                            className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg text-sm font-semibold transition"
                        >
                            <i className="fas fa-times mr-2"></i>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Disclaimer */}
            <div className="mt-3 text-xs text-gray-500 italic text-center border-t border-teal-100 pt-2">
                <i className="fas fa-exclamation-triangle mr-1"></i>
                AI suggestions are for reference only. Clinical judgment is essential.
            </div>
        </div>
    );
}
