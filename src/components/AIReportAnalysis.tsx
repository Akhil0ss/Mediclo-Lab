/**
 * AI-Powered Report Analysis Component
 * 
 * Automatically analyzes lab reports and provides:
 * - Abnormal value detection
 * - Medical insights
 * - Recommendations
 * - Risk assessment
 */

'use client';

import { useState } from 'react';
import { analyzeLabReport } from '@/lib/groqAI';

interface AIReportAnalysisProps {
    testResults: Array<{ test: string; value: string; unit: string; normalRange?: string }>;
    patientAge: number;
    patientGender: string;
    onAnalysisComplete?: (analysis: any) => void;
}

export default function AIReportAnalysis({
    testResults,
    patientAge,
    patientGender,
    onAnalysisComplete
}: AIReportAnalysisProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<any>(null);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        setAnalyzing(true);
        setError('');

        try {
            const result = await analyzeLabReport(testResults, patientAge, patientGender);
            setAnalysis(result);
            onAnalysisComplete?.(result);
        } catch (err) {
            setError('AI analysis failed. Please try again.');
            console.error(err);
        } finally {
            setAnalyzing(false);
        }
    };

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'high': return 'bg-red-100 text-red-800 border-red-300';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            default: return 'bg-green-100 text-green-800 border-green-300';
        }
    };

    return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                        <i className="fas fa-brain text-white text-sm"></i>
                    </div>
                    <h3 className="font-bold text-gray-800">AI Analysis</h3>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                        Powered by Groq
                    </span>
                </div>

                {!analysis && (
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing || testResults.length === 0}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {analyzing ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i>
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-magic"></i>
                                Analyze Report
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

            {/* Analysis Results */}
            {analysis && (
                <div className="space-y-3">
                    {/* Risk Level */}
                    <div className={`${getRiskColor(analysis.riskLevel)} border-2 rounded-lg p-3`}>
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-sm">Risk Level</span>
                            <span className="uppercase font-bold text-lg">{analysis.riskLevel}</span>
                        </div>
                    </div>

                    {/* Abnormal Values */}
                    {analysis.abnormals && analysis.abnormals.length > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-orange-200">
                            <h4 className="font-bold text-sm text-orange-800 mb-2 flex items-center gap-2">
                                <i className="fas fa-exclamation-triangle"></i>
                                Abnormal Values
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {analysis.abnormals.map((test: string, idx: number) => (
                                    <span key={idx} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold">
                                        {test}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Insights */}
                    {analysis.insights && (
                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                            <h4 className="font-bold text-sm text-blue-800 mb-2 flex items-center gap-2">
                                <i className="fas fa-lightbulb"></i>
                                Medical Insights
                            </h4>
                            <p className="text-sm text-gray-700">{analysis.insights}</p>
                        </div>
                    )}

                    {/* Recommendations */}
                    {analysis.recommendations && analysis.recommendations.length > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-green-200">
                            <h4 className="font-bold text-sm text-green-800 mb-2 flex items-center gap-2">
                                <i className="fas fa-clipboard-check"></i>
                                Recommendations
                            </h4>
                            <ul className="space-y-1">
                                {analysis.recommendations.map((rec: string, idx: number) => (
                                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                        <i className="fas fa-check-circle text-green-600 mt-0.5"></i>
                                        <span>{rec}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Re-analyze Button */}
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                        <i className="fas fa-redo mr-2"></i>
                        Re-analyze
                    </button>
                </div>
            )}
        </div>
    );
}
