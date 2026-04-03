'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '@/lib/firebase';

export default function VerifyReportPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const id = params.id as string;
    const ownerId = searchParams.get('oid');
    const type = searchParams.get('type') || 'report'; // Default to report

    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
    const [data, setData] = useState<any>(null);
    const [isRx, setIsRx] = useState(false);

    useEffect(() => {
        if (!id) return;

        const verifyRecord = async () => {
            try {
                if (ownerId) {
                    let recordData = null;
                    let recordType = type;

                    // 1. Initial Lookup (Either Report or Rx)
                    const initialPath = recordType === 'rx' ? `opd/${ownerId}/${id}` : `reports/${ownerId}/${id}`;
                    const iSnap = await get(ref(database, initialPath));
                    
                    if (iSnap.exists()) {
                        recordData = iSnap.val();
                    } else if (recordType === 'report') {
                        // 2. AUTO-FALLBACK: If type is report but not found, try RX (Smart Lookup)
                        const rxSnap = await get(ref(database, `opd/${ownerId}/${id}`));
                        if (rxSnap.exists()) {
                            recordData = rxSnap.val();
                            recordType = 'rx';
                        }
                    }

                    if (recordData) {
                        setIsRx(recordType === 'rx');
                        let r = recordData;
                        if (!r.id) r.id = id;

                        // Fetch Branding & Optional Patient Details
                        const bPromise = get(ref(database, `branding/${ownerId}`));
                        const pPromise = r.patientId ? get(ref(database, `patients/${ownerId}/${r.patientId}`)) : Promise.resolve(null);
                        
                        const [bSnap, pSnap] = await Promise.all([bPromise, pPromise]);

                        if (pSnap && pSnap.exists()) {
                            r.patientDisplayId = pSnap.val().patientId;
                            r.patientName = pSnap.val().name || r.patientName;
                            r.patientAge = pSnap.val().age || r.patientAge;
                            r.patientGender = pSnap.val().gender || r.patientGender;
                        }

                        const branding = bSnap.exists() ? bSnap.val() : {};
                        const labName = branding.labName || 'Spotnet MedOS';
                        const labPrefix = labName.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase().padEnd(4, 'X');

                        // Standardize IDs for UI
                        r.displayRecordId = recordType === 'rx' ? (r.prescription?.rxId || id) : (r.reportId || id);
                        r.displayPatientId = r.patientDisplayId || r.patientId || 'N/A';
                        r.displayDate = recordType === 'rx' ? (r.visitDate || r.createdAt) : (r.reportDate || r.createdAt);
                        r.displayDoctor = recordType === 'rx' ? (r.doctorName || 'Authorized Physician') : (r.refDoctor || 'Self');

                        setData(r);
                        setStatus('valid');
                    } else {
                        setStatus('invalid');
                    }
                } else {
                    console.warn("Missing 'oid' parameter");
                    setStatus('invalid');
                }
            } catch (error) {
                console.error("Verification failed", error);
                setStatus('invalid');
            }
        };

        verifyRecord();
    }, [id, ownerId, type]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="bg-slate-900 text-white p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                    <img src="/logo.png" alt="Logo" className="h-12 w-12 mx-auto mb-3 bg-white rounded-lg p-1 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <h1 className="text-xl font-bold tracking-wide">Spotnet MedOS</h1>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mt-1">{isRx ? 'Prescription' : 'Report'} Verification System</p>
                </div>

                {/* Body */}
                <div className="p-8">
                    {status === 'loading' && (
                        <div className="flex flex-col items-center py-8">
                            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-500 font-medium animate-pulse">Verifying Record Authenticity...</p>
                        </div>
                    )}

                    {status === 'invalid' && (
                        <div className="text-center py-6">
                            <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                                <span>✖</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Verification Failed</h2>
                            <p className="text-gray-500 text-sm">
                                The record ID <strong>{id}</strong> could not be verified in our system. Not an authentic document.
                            </p>
                        </div>
                    )}

                    {status === 'valid' && data && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-sm animate-bounce duration-1000">
                                <span>✔</span>
                            </div>

                            <h2 className="text-2xl font-bold text-gray-800 mb-1">Verified Authentic</h2>
                            <p className="text-emerald-600 text-xs font-black uppercase tracking-[0.2em] mb-8">Official {isRx ? 'Clinical Prescription' : 'Laboratory Report'}</p>

                            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 text-left space-y-3 shadow-inner">
                                <div className="flex justify-between border-b border-gray-200/60 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">{isRx ? 'Rx ID' : 'Report ID'}</span>
                                    <span className="text-gray-800 font-mono font-bold text-sm tracking-tight">{data.displayRecordId}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200/60 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">UHID / Pat ID</span>
                                    <span className="text-gray-800 font-mono font-bold text-sm tracking-tight">{data.displayPatientId}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200/60 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Patient Name</span>
                                    <span className="text-gray-800 font-bold text-sm uppercase">{data.patientName}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200/60 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Details</span>
                                    <span className="text-gray-800 text-sm">{data.patientAge} Y / {data.patientGender}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200/60 pb-2">
                                    <span className="text-gray-500 text-xs font-bold uppercase">Date</span>
                                    <span className="text-gray-800 text-sm">{data.displayDate ? new Date(data.displayDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-xs font-bold uppercase">{isRx ? 'Doctor' : 'Referred By'}</span>
                                    <span className="text-gray-800 text-sm font-bold italic">{data.displayDoctor}</span>
                                </div>
                            </div>

                            <div className="mt-8">
                                <p className="text-[10px] text-gray-400 max-w-xs mx-auto leading-relaxed">
                                    This record has been digitally verified by Spotnet MedOS Central. 
                                    Integrity guaranteed via secure digital record synchronization.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-400 font-medium">© 2026 Powered by Spotnet MedOS</p>
                </div>
            </div>
        </div>
    );
}
