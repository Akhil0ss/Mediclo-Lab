/**
 * AI Features Test Page
 * 
 * Test all AI features before deploying
 * Access at: /test-ai
 */

'use client';

import { useState } from 'react';
import {
    analyzeLabReport,
    checkDrugInteractions,
    triagePatient,
    explainMedicalTerm
} from '@/lib/groqAI';

export default function TestAIPage() {
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const testReportAnalysis = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await analyzeLabReport(
                [
                    { test: 'Hemoglobin', value: '10.5', unit: 'g/dL', normalRange: '12-16' },
                    { test: 'Blood Sugar', value: '180', unit: 'mg/dL', normalRange: '70-100' }
                ],
                35,
                'M'
            );
            setResult({ type: 'Report Analysis', data: res });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const testDrugInteraction = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await checkDrugInteractions([
                { name: 'Aspirin', dosage: '75mg' },
                { name: 'Warfarin', dosage: '5mg' }
            ]);
            setResult({ type: 'Drug Interaction', data: res });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const testTriage = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await triagePatient(
                'Severe chest pain, difficulty breathing',
                { bp: '160/100', pulse: '120', temp: '98.6' },
                55
            );
            setResult({ type: 'Triage', data: res });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const testExplain = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await explainMedicalTerm('Hypertension');
            setResult({ type: 'Medical Term', data: res });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">AI Features Test</h1>

                {/* Test Buttons */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                        onClick={testReportAnalysis}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg font-semibold disabled:opacity-50"
                    >
                        Test Report Analysis
                    </button>

                    <button
                        onClick={testDrugInteraction}
                        disabled={loading}
                        className="bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-lg font-semibold disabled:opacity-50"
                    >
                        Test Drug Interaction
                    </button>

                    <button
                        onClick={testTriage}
                        disabled={loading}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white p-4 rounded-lg font-semibold disabled:opacity-50"
                    >
                        Test Triage
                    </button>

                    <button
                        onClick={testExplain}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg font-semibold disabled:opacity-50"
                    >
                        Test Medical Term
                    </button>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <i className="fas fa-spinner fa-spin text-blue-600 text-2xl"></i>
                        <p className="text-blue-800 mt-2">Testing AI...</p>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h3 className="font-bold text-red-800 mb-2">Error:</h3>
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                {/* Result */}
                {result && !loading && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h3 className="font-bold text-lg mb-4">{result.type} Result:</h3>
                        <pre className="bg-gray-50 p-4 rounded overflow-auto text-sm">
                            {JSON.stringify(result.data, null, 2)}
                        </pre>
                    </div>
                )}

                {/* API Key Status */}
                <div className="mt-6 bg-gray-100 rounded-lg p-4">
                    <h3 className="font-bold mb-2">API Key Status:</h3>
                    <p className="text-sm">
                        {process.env.NEXT_PUBLIC_GROQ_API_KEY ? (
                            <span className="text-green-600">✓ API Key Configured</span>
                        ) : (
                            <span className="text-red-600">✗ API Key Missing</span>
                        )}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                        Model: llama-3.1-8b-instant (Fastest, Cheapest)
                    </p>
                </div>
            </div>
        </div>
    );
}
