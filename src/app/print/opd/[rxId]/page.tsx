'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { getDataOwnerId } from '@/lib/dataUtils';

export default function PrintOPDPage() {
    const { user, userProfile, loading } = useAuth();
    const params = useParams();
    const rxId = params?.rxId as string;

    const [opdData, setOpdData] = useState<any>(null);
    const [branding, setBranding] = useState<any>(null);
    const [patientData, setPatientData] = useState<any>(null);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        if (loading) return;

        const patientOwnerId = typeof window !== 'undefined' ? localStorage.getItem('patient_owner_id') : null;

        if (!user && !patientOwnerId) {
            setFetching(false);
            return;
        }

        const fetchData = async () => {
            try {
                let dataSourceId = '';

                if (user?.isAnonymous) {
                    if (!dataSourceId && patientOwnerId) dataSourceId = patientOwnerId;
                    if (!dataSourceId) {
                        const sessionRef = ref(database, `patientSessions/${user.uid}`);
                        const sessionSnap = await get(sessionRef);
                        if (sessionSnap.exists()) dataSourceId = sessionSnap.val().ownerId;
                    }
                } else {
                    if (typeof window !== 'undefined') {
                        const storedOwnerId = localStorage.getItem('ownerId');
                        if (storedOwnerId) dataSourceId = storedOwnerId;
                    }
                    if (!dataSourceId && userProfile) {
                        const id = getDataOwnerId(userProfile, user?.uid || '');
                        if (id) dataSourceId = id;
                    }
                    if (!dataSourceId && user?.uid) dataSourceId = user.uid;
                }

                if (!dataSourceId && user?.uid) dataSourceId = user.uid;

                let foundOpd = null;

                if (dataSourceId) {
                    const opdRef = ref(database, `opd/${dataSourceId}`);
                    const opdSnapshot = await get(opdRef);
                    if (opdSnapshot.exists()) {
                        opdSnapshot.forEach((child) => {
                            const data = child.val();
                            if (String(data.rxId).trim().toLowerCase() === String(rxId).trim().toLowerCase() || child.key === rxId) {
                                foundOpd = { id: child.key, ...data };
                            }
                        });
                    }
                }

                if (!foundOpd) {
                    const usersRef = ref(database, 'users');
                    const usersSnap = await get(usersRef);
                    if (usersSnap.exists()) {
                        const allUsers = usersSnap.val();
                        for (const uid in allUsers) {
                            if (uid === dataSourceId) continue;
                            const keySnap = await get(ref(database, `opd/${uid}/${rxId}`));
                            if (keySnap.exists()) {
                                foundOpd = { id: keySnap.key, ...keySnap.val() };
                                dataSourceId = uid;
                                break;
                            }
                            // Try query
                            try {
                                const q = query(ref(database, `opd/${uid}`), orderByChild('rxId'), equalTo(rxId));
                                const qSnap = await get(q);
                                if (qSnap.exists()) {
                                    const val = qSnap.val();
                                    const key = Object.keys(val)[0];
                                    foundOpd = { id: key, ...val[key] };
                                    dataSourceId = uid;
                                    break;
                                }
                            } catch (e) { }
                        }
                    }
                }

                if (foundOpd) {
                    setOpdData(foundOpd);
                    if (foundOpd.patientId) {
                        const patientSnapshot = await get(ref(database, `patients/${dataSourceId}/${foundOpd.patientId}`));
                        if (patientSnapshot.exists()) setPatientData(patientSnapshot.val());
                    }
                    const brandingSnapshot = await get(ref(database, `branding/${dataSourceId}`));
                    if (brandingSnapshot.exists()) setBranding(brandingSnapshot.val());
                }
            } catch (error) {
                console.error(error);
            } finally {
                setFetching(false);
            }
        };

        fetchData();
    }, [user, userProfile, loading, rxId]);

    if (fetching) return <div className="p-10 text-center">Loading Prescription...</div>;
    if (!opdData) return <div className="p-10 text-center text-red-600 font-bold">Prescription Not Found</div>;

    const visitDate = opdData.visitDate ? new Date(opdData.visitDate).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric'
    }) : new Date().toLocaleDateString('en-IN');

    // ID Logic
    const labPrefix = (branding?.labName || 'MED').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
    const rawPatId = patientData?.patientId || opdData.patientId || opdData.patientMobile?.slice(-6) || '000000';
    const patIdDisplay = rawPatId.includes('-') ? rawPatId : `${labPrefix}-${rawPatId}`;

    const verifyLink = `https://medos.spotnet.in/verify/rx/${rxId}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyLink)}`;

    return (
        <div className="min-h-screen bg-gray-100 print:bg-white print:p-0 p-8 flex justify-center">
            {/* Print Button */}
            <button
                onClick={() => window.print()}
                className="fixed bottom-8 right-8 bg-indigo-600 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition-all print:hidden z-50 flex items-center gap-2"
            >
                🖨️ Print Prescription
            </button>

            {/* A4 Container */}
            <div className="w-[210mm] min-h-[297mm] bg-white shadow-xl print:shadow-none flex flex-col relative overflow-hidden">

                {/* HEADER */}
                <div className="relative bg-gradient-to-br from-indigo-500 to-purple-700 text-white p-5 flex items-center">
                    {/* Rainbow Stripe */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500"></div>

                    {/* Logo */}
                    <div className="w-[100px] flex-shrink-0">
                        {branding?.logoUrl && (
                            <img src={branding.logoUrl} alt="Logo" className="w-[90px] h-[90px] object-contain bg-white/10 rounded" />
                        )}
                    </div>

                    {/* Center Info */}
                    <div className="flex-1 text-center px-4">
                        <h1 className="text-2xl font-black uppercase tracking-wide text-shadow-sm mb-1">{branding?.labName || 'Medical Center'}</h1>
                        <p className="text-xs italic opacity-90 mb-1">{branding?.tagline || 'Excellence in Healthcare'}</p>
                        <div className="text-[10px] opacity-90 leading-tight">
                            {branding?.address && <p>{branding.address}</p>}
                            <p>
                                {branding?.contact && `📞 ${branding.contact}`}
                                {branding?.email && ` | ✉️ ${branding.email}`}
                            </p>
                        </div>
                    </div>

                    {/* Right Info & QR */}
                    <div className="w-[160px] flex-shrink-0 text-right space-y-1">
                        <div className="text-[10px] leading-tight">
                            <p className="font-bold text-xs">OPD PRESCRIPTION</p>
                            <p>RX: <span className="font-mono font-bold">{opdData.rxId || rxId}</span></p>
                            <p>Date: {visitDate}</p>
                            <p>PID: {patIdDisplay}</p>
                        </div>
                        <div className="flex justify-end mt-2">
                            <div className="w-[70px] h-[70px] bg-white/20 p-1 rounded backdrop-blur-sm border border-white/30">
                                <img src={qrCodeUrl} alt="QR" className="w-full h-full object-contain" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* PATIENT ROW - Inline & Clean */}
                <div className="flex items-center bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-indigo-500 text-xs">
                    <div className="flex-1 p-2 border-r border-indigo-200 flex items-center gap-2">
                        <span className="text-indigo-600 font-bold uppercase text-[9px]">Patient:</span>
                        <span className="font-bold text-slate-800">{opdData.patientName}</span>
                    </div>
                    <div className="flex-1 p-2 border-r border-indigo-200 flex items-center gap-2">
                        <span className="text-indigo-600 font-bold uppercase text-[9px]">Age/Sex:</span>
                        <span className="font-bold text-slate-800">{opdData.patientAge || '-'} / {opdData.patientGender || '-'}</span>
                    </div>
                    <div className="flex-1 p-2 border-r border-indigo-200 flex items-center gap-2">
                        <span className="text-indigo-600 font-bold uppercase text-[9px]">Phone:</span>
                        <span className="font-bold text-slate-800">{opdData.patientMobile || patientData?.mobile || '-'}</span>
                    </div>
                    <div className="flex-[1.5] p-2 border-r border-indigo-200 flex items-center gap-2 overflow-hidden">
                        <span className="text-indigo-600 font-bold uppercase text-[9px]">Address:</span>
                        <span className="font-bold text-slate-800 truncate block max-w-[120px]">{patientData?.address || opdData.patientAddress || '-'}</span>
                    </div>
                    <div className="flex-1 p-2 flex items-center gap-2 justify-end">
                        <span className="text-indigo-600 font-bold uppercase text-[9px]">Rep ID:</span>
                        <span className="font-bold text-slate-800">{opdData.reportId || '—'}</span>
                    </div>
                </div>

                {/* CONTENT BODY */}
                <div className="flex-1 p-6 flex flex-col gap-5">

                    {/* VITALS */}
                    {opdData.vitals && (
                        <div className="flex gap-3">
                            {[
                                { l: 'BP', v: opdData.vitals.bp, u: 'mmHg' },
                                { l: 'Pulse', v: opdData.vitals.pulse, u: 'bpm' },
                                { l: 'Temp', v: opdData.vitals.temperature, u: '°F' },
                                { l: 'Weight', v: opdData.vitals.weight, u: 'kg' },
                                { l: 'SpO2', v: opdData.vitals.spo2, u: '%' },
                            ].map((vit, i) => (
                                <div key={i} className="flex-1 bg-slate-50 border border-slate-200 rounded p-2 text-center">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase">{vit.l} ({vit.u})</div>
                                    <div className={`font-bold text-sm ${vit.v && vit.v !== '-' ? 'text-slate-800' : 'text-slate-300'}`}>
                                        {vit.v && vit.v !== '-' ? vit.v : '_______'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* COMPLAINTS & DIAGNOSIS - Side by Side */}
                    <div className="flex gap-5">
                        <div className="flex-1 border border-slate-200 rounded-lg p-3 min-h-[80px]">
                            <div className="text-[10px] font-bold text-indigo-600 uppercase border-b border-slate-100 pb-1 mb-2">🗣️ Chief Complaints</div>
                            <div className="text-xs leading-relaxed text-slate-700">
                                {opdData.symptoms?.length > 0 ? opdData.symptoms.join(', ') : (
                                    <div className="space-y-4 pt-2">
                                        <div className="border-b border-dotted border-slate-300"></div>
                                        <div className="border-b border-dotted border-slate-300"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 border border-slate-200 rounded-lg p-3 min-h-[80px]">
                            <div className="text-[10px] font-bold text-indigo-600 uppercase border-b border-slate-100 pb-1 mb-2">🔍 Diagnosis</div>
                            <div className="text-xs leading-relaxed font-semibold text-slate-800">
                                {opdData.diagnosis || (
                                    <div className="space-y-4 pt-2">
                                        <div className="border-b border-dotted border-slate-300"></div>
                                        <div className="border-b border-dotted border-slate-300"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* MEDICINES TABLE */}
                    <div className="flex-1 border border-slate-300 rounded-lg p-0 overflow-hidden min-h-[300px]">
                        <div className="bg-slate-50 p-2 border-b border-slate-300 text-xs font-bold text-indigo-700 uppercase flex items-center gap-2">
                            <span>💊</span> Prescribed Medicines
                        </div>
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-3 w-1/2">Medicine Name</th>
                                    <th className="p-3 w-1/4">Dosage</th>
                                    <th className="p-3 w-1/4">Duration / Instructions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {opdData.medicines?.length > 0 ? opdData.medicines.map((med: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                        <td className="p-3 align-top">
                                            <div className="font-bold text-slate-800">{med.name}</div>
                                            <div className="text-[10px] text-slate-500">{med.type} {med.composition && `(${med.composition})`}</div>
                                        </td>
                                        <td className="p-3 align-top font-semibold text-slate-700">{med.dosage}</td>
                                        <td className="p-3 align-top text-slate-600">
                                            {med.duration}
                                            {med.instructions && <div className="text-[10px] text-slate-500 mt-1">• {med.instructions}</div>}
                                        </td>
                                    </tr>
                                )) : Array(6).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        <td className="p-3 h-10 border-b border-dotted border-slate-200"></td>
                                        <td className="p-3 border-b border-dotted border-slate-200"></td>
                                        <td className="p-3 border-b border-dotted border-slate-200"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ADVICE & SIGNATURE */}
                    <div className="flex gap-5 mt-auto">
                        <div className="flex-[2] border border-slate-200 rounded-lg p-3 min-h-[100px]">
                            <div className="text-[10px] font-bold text-indigo-600 uppercase border-b border-slate-100 pb-1 mb-2">📋 Advice</div>
                            <div className="text-xs whitespace-pre-wrap leading-relaxed text-slate-700">{opdData.advice}</div>
                        </div>
                        <div className="flex-1 flex flex-col justify-end items-center text-center pb-2">
                            <div className="font-bold text-sm text-slate-800">{opdData.doctorName || 'Doctor Signature'}</div>
                            {opdData.doctorRegistration && <div className="text-[10px] text-slate-500">Reg: {opdData.doctorRegistration}</div>}
                        </div>
                    </div>

                </div>

                {/* FOOTER */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-800 text-white p-3 px-6 text-[9px] flex justify-between items-center">
                    <div className="flex-1">
                        <p className="font-bold text-[10px]">{branding?.labName}</p>
                        <p className="opacity-80">Generated: {new Date().toLocaleString('en-IN')}</p>
                        {patientData?.credentials && (
                            <p className="opacity-70 mt-1">Portal: medos.spotnet.in | User: {patientData.credentials.username}</p>
                        )}
                    </div>
                    <div className="flex-1 text-center">
                        <p>RX ID: {opdData.rxId || rxId}</p>
                        <p className="font-bold opacity-90">medos.spotnet.in</p>
                    </div>
                    <div className="flex-1 text-right">
                        <p className="opacity-80 mb-1">Electronically Generated</p>
                        <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-[10px] tracking-wider">
                            |{(opdData.rxId || rxId).replace(/-/g, '').substring(0, 12)}|
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
}
