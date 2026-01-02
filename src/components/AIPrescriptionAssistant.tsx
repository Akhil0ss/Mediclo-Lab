/**
 * AI Prescription Assistant Component
 * 
 * Features:
 * - Drug interaction checker
 * - Prescription suggestions based on diagnosis
 * - Safety warnings
 * - Alternative medicine recommendations
 */

'use client';

import { useState } from 'react';
import { checkDrugInteractions, suggestPrescription } from '@/lib/groqAI';

interface AIPrescriptionAssistantProps {
    medicines: Array<{ name: string; dosage: string }>;
    diagnosis?: string;
    symptoms?: string;
    patientAge?: number;
    onSuggestionAccept?: (medicines: any[]) => void;
}

export default function AIPrescriptionAssistant({
    medicines,
    diagnosis,
    symptoms,
    patientAge,
    onSuggestionAccept
}: AIPrescriptionAssistantProps) {
    const [checking, setChecking] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [interactions, setInteractions] = useState<any>(null);
    const [suggestions, setSuggestions] = useState<any>(null);

    const handleCheckInteractions = async () => {
        if (medicines.length === 0) return;

        setChecking(true);
        try {
            const result = await checkDrugInteractions(medicines);
            setInteractions(result);
        } catch (err) {
            console.error(err);
        } finally {
            setChecking(false);
        }
    };

    const handleGetSuggestions = async () => {
        if (!diagnosis || !patientAge) return;

        setSuggesting(true);
        try {
            const result = await suggestPrescription(diagnosis, symptoms || '', patientAge);
            setSuggestions(result);
        } catch (err) {
            console.error(err);
        } finally {
            setSuggesting(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Drug Interaction Checker */}
            {medicines.length > 0 && (
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 border border-orange-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-orange-600 to-red-600 rounded-lg flex items-center justify-center">
                                <i className="fas fa-shield-alt text-white text-sm"></i>
                            </div>
                            <h3 className="font-bold text-gray-800">Drug Interaction Check</h3>
                        </div>

                        <button
                            onClick={handleCheckInteractions}
                            disabled={checking}
                            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                        >
                            {checking ? (
                                <>
                                    <i className="fas fa-spinner fa-spin mr-2"></i>
                                    Checking...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-check-double mr-2"></i>
                                    Check Safety
                                </>
                            )}
                        </button>
                    </div>

                    {interactions && (
                        <div className="space-y-2">
                            {interactions.hasInteractions ? (
                                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-3">
                                    <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                                        <i className="fas fa-exclamation-triangle"></i>
                                        ⚠️ Interactions Detected
                                    </h4>
                                    <ul className="space-y-1">
                                        {interactions.warnings.map((warning: string, idx: number) => (
                                            <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                                                <i className="fas fa-times-circle mt-0.5"></i>
                                                <span>{warning}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <div className="bg-green-100 border-2 border-green-300 rounded-lg p-3">
                                    <p className="text-green-800 font-semibold flex items-center gap-2">
                                        <i className="fas fa-check-circle"></i>
                                        ✓ No critical interactions detected
                                    </p>
                                </div>
                            )}

                            {interactions.suggestions && interactions.suggestions.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <h4 className="font-bold text-blue-800 mb-2 text-sm">Suggestions:</h4>
                                    <ul className="space-y-1">
                                        {interactions.suggestions.map((sug: string, idx: number) => (
                                            <li key={idx} className="text-sm text-blue-700">• {sug}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* AI Prescription Suggestions */}
            {diagnosis && patientAge && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                                <i className="fas fa-prescription text-white text-sm"></i>
                            </div>
                            <h3 className="font-bold text-gray-800">AI Prescription Suggestions</h3>
                        </div>

                        <button
                            onClick={handleGetSuggestions}
                            disabled={suggesting}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                        >
                            {suggesting ? (
                                <>
                                    <i className="fas fa-spinner fa-spin mr-2"></i>
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-magic mr-2"></i>
                                    Get Suggestions
                                </>
                            )}
                        </button>
                    </div>

                    {suggestions && (
                        <div className="space-y-3">
                            {/* Suggested Medicines */}
                            {suggestions.medicines && suggestions.medicines.length > 0 && (
                                <div className="bg-white rounded-lg p-3 border border-purple-200">
                                    <h4 className="font-bold text-purple-800 mb-2 text-sm">Suggested Medicines:</h4>
                                    <div className="space-y-2">
                                        {suggestions.medicines.map((med: any, idx: number) => (
                                            <div key={idx} className="bg-purple-50 rounded p-2 text-sm">
                                                <div className="font-semibold text-gray-800">{idx + 1}. {med.name}</div>
                                                <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-2">
                                                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{med.dosage}</span>
                                                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">{med.frequency}</span>
                                                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded">{med.duration}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {onSuggestionAccept && (
                                        <button
                                            onClick={() => onSuggestionAccept(suggestions.medicines)}
                                            className="mt-3 w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition"
                                        >
                                            <i className="fas fa-plus-circle mr-2"></i>
                                            Add to Prescription
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Advice */}
                            {suggestions.advice && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <h4 className="font-bold text-yellow-800 mb-1 text-sm">Patient Advice:</h4>
                                    <p className="text-sm text-gray-700">{suggestions.advice}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
