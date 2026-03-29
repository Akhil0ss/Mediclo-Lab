'use client';

import { useEffect, useState } from 'react';
import { database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import JsBarcode from 'jsbarcode';

export default function BarcodeLabelPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    // Support ID from params or query for flexibility
    const sampleId = params.sampleId as string || searchParams.get('sampleId');
    const ownerId = searchParams.get('ownerId');

    const [sampleData, setSampleData] = useState<any>(null);
    const [patientData, setPatientData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [labBranding, setLabBranding] = useState<any>(null);

    useEffect(() => {
        if (!sampleId || !ownerId) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                // Fetch Sample
                const sampleRef = ref(database, `samples/${ownerId}/${sampleId}`);
                const sampleSnap = await get(sampleRef);

                if (sampleSnap.exists()) {
                    const sData = sampleSnap.val();
                    setSampleData(sData);

                    // Fetch Patient
                    if (sData.patientId) {
                        const patRef = ref(database, `patients/${ownerId}/${sData.patientId}`);
                        const patSnap = await get(patRef);
                        if (patSnap.exists()) {
                            setPatientData(patSnap.val());
                        }
                    }
                }

                // Fetch Branding
                const brandRef = ref(database, `branding/${ownerId}`);
                const brandSnap = await get(brandRef);
                if (brandSnap.exists()) {
                    setLabBranding(brandSnap.val());
                }

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [sampleId, ownerId]);

    // Generate barcode when element is ready
    useEffect(() => {
        if (!loading && sampleId) {
            setTimeout(() => {
                const canvas = document.getElementById('barcode-canvas');
                if (canvas) {
                    try {
                        JsBarcode(canvas, sampleId, {
                            format: "CODE128",
                            width: 2,
                            height: 40,
                            displayValue: true,
                            fontSize: 14,
                            margin: 0
                        });
                        // Auto-print
                        window.print();
                    } catch (e) {
                        console.error("Barcode error:", e);
                    }
                }
            }, 500); // Small delay to ensure render
        }
    }, [loading, sampleId]);


    if (loading) return <div className="p-8 text-center text-xs">Loading Label...</div>;
    if (!sampleData) return <div className="p-8 text-center text-red-600 text-xs">Sample not found</div>;

    // Typically labels are small, e.g., 50mm x 25mm. allow print CSS to handle page size
    return (
        <div className="bg-white min-h-screen flex items-start justify-center p-4 print:p-0 print:items-start print:justify-start">
            {/* Standard Label Container (approx 2x1 inches) */}
            <div className="w-[50mm] h-[25mm] border border-gray-300 print:border-none flex flex-col items-center justify-center p-1 text-center overflow-hidden">
                <div className="text-[8px] font-bold uppercase truncate w-full leading-tight mb-0.5">
                    {labBranding?.labName || 'MEDICLO LAB'}
                </div>

                <div className="flex justify-between w-full px-1 mb-0.5" style={{ fontSize: '7px' }}>
                    <span className="font-bold truncate max-w-[60%]">{patientData?.name || 'Unknown Patient'}</span>
                    <span>{patientData?.age ? `${patientData.age}/${patientData.gender?.[0] || ''}` : ''}</span>
                </div>

                <div className="w-full h-[30px] flex items-center justify-center overflow-hidden">
                    <canvas id="barcode-canvas" className="max-w-full max-h-full"></canvas>
                </div>

                <div className="text-[7px] w-full flex justify-between px-1 mt-0.5 text-gray-600 font-mono">
                    <span>{sampleData.testName?.split(',')[0].slice(0, 10) || 'TEST'}</span>
                    <span>{new Date(sampleData.collectionDate || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' })}</span>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page {
                        size: 50mm 25mm;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        background: white;
                    }
                    /* Hide everything else */
                    body * {
                        visibility: hidden;
                    }
                    /* Show only the label container */
                    .w-\\[50mm\\], .w-\\[50mm\\] * {
                        visibility: visible;
                    }
                    .w-\\[50mm\\] {
                        position: absolute;
                        left: 0;
                        top: 0;
                        border: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
