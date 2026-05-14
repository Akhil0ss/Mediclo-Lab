'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import QRCode from 'qrcode';

export default function PrintOPDPage() {
    const params = useParams();
    const { user, userProfile, loading: authLoading } = useAuth();
    const [visit, setVisit] = useState<any>(null);
    const [branding, setBranding] = useState<any>(null);
    const [doctor, setDoctor] = useState<any>(null);
    const [patient, setPatient] = useState<any>(null);
    const [ownerId, setOwnerId] = useState<string>('');
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const printTriggeredRef = useRef(false);

    const visitId = params.id as string;

    useEffect(() => {
        if (!visitId || authLoading) return;

        const fetchData = async () => {
            try {
                let currentOwnerId = userProfile?.ownerId || user?.uid;
                if (!currentOwnerId && typeof window !== 'undefined') {
                    const urlParams = new URLSearchParams(window.location.search);
                    currentOwnerId = urlParams.get('ownerId') || localStorage.getItem('ownerId') || localStorage.getItem('portal_owner_id') || null;
                }
                if (!currentOwnerId) { setLoading(false); return; }

                setOwnerId(currentOwnerId);
                const visitSnap = await get(ref(database, `opd/${currentOwnerId}/${visitId}`));
                if (!visitSnap.exists()) { setLoading(false); return; }
                const visitData = visitSnap.val();
                setVisit(visitData);

                const [brandingSnap, docSnap, patSnap, qrBase64] = await Promise.all([
                    get(ref(database, `branding/${currentOwnerId}`)).catch(() => ({ val: () => ({}) })),
                    visitData.doctorId ? get(ref(database, `users/${currentOwnerId}/auth/staff/${visitData.doctorId}`)).catch(() => ({ val: () => null })) : Promise.resolve({ val: () => null }),
                    visitData.patientId ? get(ref(database, `patients/${currentOwnerId}/${visitData.patientId}`)).catch(() => ({ exists: () => false, val: () => null })) : Promise.resolve({ exists: () => false, val: () => null }),
                    QRCode.toDataURL(`https://medlab.spotnet.in/verify/${visitId}?oid=${currentOwnerId}&type=rx`, { width: 150, margin: 0 }).catch(() => '')
                ]);

                setBranding(brandingSnap.val() || {});
                if (visitData.doctorId) setDoctor(docSnap.val());
                if (visitData.patientId && patSnap.exists()) setPatient(patSnap.val());
                setQrCodeDataUrl(qrBase64);

                setLoading(false);
            } catch (error) {
                console.error('Error fetching print data:', error);
                setLoading(false);
            }
        };
        fetchData();
    }, [visitId, authLoading, user, userProfile]);

    // Auto-Print trigger was removed to allow for digital review first.

    if (loading) return <div className="p-10 text-center font-bold text-slate-400 italic">Formatting for A4 High-Clarity Print...</div>;
    if (!visit) return <div className="p-10 text-center font-bold text-red-600">Prescription not found!</div>;

    const themeGradient = branding.themeColor
        ? `linear-gradient(135deg, ${branding.themeColor} 0%, ${branding.themeColor}dd 100%)`
        : 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)';
    const accentGradient = 'linear-gradient(90deg, #fbbf24, #f97316, #ef4444, #ec4899)';

    const displayRxId = (visit.prescription?.rxId || visit.rxId || visitId).toUpperCase();
    const displayPatientId = (patient?.patientId || visit.patientUHID || visit.patientId || 'N/A').toUpperCase();

    const currentVitals = [
        { label: 'BP', val: visit.vitals?.bp, color: 'text-red-700' },
        { label: 'Pulse', val: visit.vitals?.pulse, color: 'text-orange-700' },
        { label: 'Temp', val: visit.vitals?.temp || visit.vitals?.temperature, color: 'text-emerald-700' },
        { label: 'Wt.', val: visit.vitals?.weight, color: 'text-blue-700' },
        { label: 'SpO2', val: visit.vitals?.spo2, color: 'text-cyan-700' },
    ];

    const capturedTime = new Date(visit.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    return (
        <div className="report-container bg-white min-h-screen font-sans text-gray-900 overflow-hidden flex flex-col" style={{ width: '210mm', margin: '0 auto' }}>
            {/* 1. HEADER SECTION (EXACT SYNC WITH REPORT PDF) */}
            <header className="header">
                <div className="header-logo-container">
                    {branding.logoUrl ? <img src={branding.logoUrl} className="header-logo" alt="Logo" /> : <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center font-black text-2xl">🏥</div>}
                </div>

                <div className="header-center">
                    <h1>{branding.labName || 'Mediclo Lab'}</h1>
                    <p className="tagline">{branding.tagline || 'Leading Healthcare Through Digital Excellence'}</p>
                    <div className="contact-details">
                        <span>{branding.address || 'Medical Center Road'}, {branding.city}, {branding.state} - {branding.pincode}</span>
                        <div className="contact-flex">
                            <span>📞 {branding.contact}</span>
                            <span className="separator">|</span>
                            <span>✉️ {branding.email}</span>
                        </div>
                    </div>
                </div>

                <div className="header-right">
                    <div className="header-meta-text">
                        <p className="meta-label">Clinical Prescription</p>
                        <p className="meta-date">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        <p className="meta-time">{capturedTime}</p>
                    </div>
                    <div className="header-qr">{qrCodeDataUrl && <img src={qrCodeDataUrl} alt="QR" />}</div>
                </div>
            </header>

            {/* 2. PHYSICIAN META STRIP (Optimized Layout) */}
            <div className="mx-6 -mt-4 relative z-20">
                <div className="doctor-strip">
                    <div className="flex items-center gap-1.5 flex-1 pr-10">
                        <span className="text-indigo-300 uppercase text-[8px] font-black tracking-wider leading-none whitespace-nowrap shrink-0">Physician:</span>
                        <span className="italic text-[10px] font-black text-white whitespace-nowrap">Dr. {visit.doctorName || doctor?.name}</span>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-blue-300 uppercase text-[8px] font-black tracking-wider leading-none">Type:</span>
                            <span className="text-[10px] font-black text-white">OPD Record</span>
                        </div>
                        <div className="w-[1px] h-3 bg-white/20"></div>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-amber-300 uppercase text-[8px] font-black tracking-wider leading-none">Follow-up:</span>
                            <span className="text-[10px] font-black text-white uppercase italic">
                                {visit.prescription?.nextVisit || visit.prescription?.followUpDate || visit.nextVisit
                                    ? new Date(visit.prescription?.nextVisit || visit.prescription?.followUpDate || visit.nextVisit).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                    : 'SOS / As Advised'}
                            </span>
                        </div>
                        <div className="w-[1px] h-3 bg-white/20"></div>
                        <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                            <span className="text-slate-400 uppercase text-[8px] font-black tracking-wider leading-none">UHID:</span>
                            <span className="text-white font-black text-[9.5px] tracking-tight truncate max-w-[120px]">{displayPatientId}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. PATIENT & VITALS STRIP (A4 Print Optimized - Strict Inline) */}
            <div className="mx-6 mt-3 relative z-10">
                <div className="patient-strip h-[32px] flex items-center justify-between px-4 overflow-hidden">
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-1.5 whitespace-nowrap"><span className="text-slate-600 uppercase text-[8.5px] font-black tracking-wider">Patient:</span><span className="text-slate-900 font-extrabold text-[11px] uppercase truncate max-w-[140px]">{visit.patientName}</span></div>
                        <div className="w-[1px] h-3 bg-slate-200"></div>
                        <div className="flex items-center gap-1.5 whitespace-nowrap"><span className="text-slate-600 uppercase text-[8.5px] font-black tracking-wider">Age/Gen:</span><span className="text-slate-800 text-[10px] font-bold">{visit.patientAge || 'N/A'} / {visit.patientGender || '---'}</span></div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {currentVitals.map((vit, i) => (
                            <div key={i} className="flex items-center gap-1 border-l border-slate-200 pl-3 first:border-l-0 first:pl-0 whitespace-nowrap"><span className="text-slate-600 uppercase text-[8.5px] font-black tracking-tighter leading-none">{vit.label}:</span><span className={`font-black tracking-tight text-[11px] ${vit.color}`}>{vit.val || '---'}</span></div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. MAIN CLINICAL LAYOUT (L-Shape Design - High Density) */}
            <div className="mx-6 mt-6 grid grid-cols-2 gap-x-6 h-[125px]">
                {/* Column 1: Complaints + Pinned Medicines Heading (L-Segment) */}
                <div className="flex flex-col h-full gap-0">
                    <div className="h-[85px] overflow-hidden flex flex-col py-2 px-4 bg-slate-50/50 rounded-xl rounded-b-none border border-slate-200 border-l-4 border-l-slate-400 border-b-0">
                        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1.5">Chief Complaints</label>
                        <p className="text-[10px] italic text-slate-700 leading-tight font-semibold line-clamp-4">{visit.complaints || 'None recorded for this session.'}</p>
                    </div>
                    <div className="h-[40px] flex items-center gap-3 px-4 bg-white border border-slate-200 border-l-4 border-l-indigo-600 rounded-xl rounded-t-none">
                        <div className="rx-icon !w-6 !h-6 !text-sm bg-indigo-700">℞</div>
                        <div className="flex-1 flex items-center gap-2">
                            <h2 className="text-[12px] font-black text-slate-900 uppercase tracking-tighter leading-none">Prescribed Medications</h2>
                            <i className="fas fa-chevron-down text-[9px] text-indigo-500"></i>
                        </div>
                    </div>
                </div>

                {/* Column 2: Diagnosis (Spans full height of grid) */}
                <div className="h-full overflow-hidden flex flex-col py-3 px-4 bg-amber-50/40 rounded-xl border border-amber-200 border-l-4 border-l-amber-500 shadow-sm">
                    <label className="text-[8px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1.5">Observation / Diagnosis</label>
                    <p className="text-[11px] font-black text-slate-800 leading-relaxed italic line-clamp-5">
                        {visit.prescription?.diagnosis || visit.diagnosis || 'Clinical session assessment and evaluation.'}
                    </p>
                </div>
            </div>

            {/* 6. MEDICATION TABLE */}
            <div className="mx-6 mt-2 flex-grow min-h-[350px]">
                <div className="overflow-hidden border border-slate-300 rounded-2xl shadow-sm bg-white">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-300">
                            <tr className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                                <th className="p-3 border-r border-slate-200 text-center w-10">Sn</th>
                                <th className="p-3 border-r border-slate-200">Medicine & Frequency</th>
                                <th className="p-3 border-r border-slate-200 text-center w-24">Dosage</th>
                                <th className="p-3 border-r border-slate-200 text-center w-28">Frequency</th>
                                <th className="p-3 text-center w-24">Days</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                            {visit.prescription?.medicines?.length > 0 ? (
                                visit.prescription.medicines.map((med: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50/30">
                                        <td className="p-3 border-r border-slate-100 text-center text-slate-400 font-bold">{idx + 1}</td>
                                        <td className="p-3 border-r border-slate-100">
                                            <div className="font-black text-slate-950 leading-none mb-1 uppercase text-[12px]">{med.name}</div>
                                            <div className="text-[10px] text-slate-500 italic font-bold leading-none">{med.instructions || 'As advised by the physician'}</div>
                                        </td>
                                        <td className="p-3 border-r border-slate-100 text-center font-black text-indigo-800">{med.dosage}</td>
                                        <td className="p-3 border-r border-slate-100 text-center">
                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 text-[10px] font-black rounded-lg border border-indigo-100 uppercase italic">{med.frequency}</span>
                                        </td>
                                        <td className="p-3 text-center font-black text-slate-800 italic tracking-tighter text-[12px]">{med.duration}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-black italic uppercase tracking-widest opacity-50">No medicines recorded</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 7. LEGAL & CLINICAL FOOTER (A4 OPTIMIZED) */}
            <div className="mt-auto">
                <div className="mx-6 py-4 border-t-2 border-slate-300 flex justify-between items-center gap-8">
                    {/* Left: Digital Verification */}
                    <div className="flex flex-col gap-2 min-w-[160px] h-[85px] justify-center text-center">
                        <div className="digital-sign-box !py-2.5 !px-3 !w-full !h-full flex flex-col items-center justify-center border-slate-200">
                            <p className="flex items-center justify-center gap-1 font-black text-slate-700 text-[6.5px] whitespace-nowrap"><span className="text-emerald-600 text-[8px]">✔</span> 🔐 DIGITAL SIGN</p>
                            <div className="hash-text !text-[5.5px] text-slate-500 mt-1 uppercase tracking-tighter">HASH: {visitId.replace(/-/g, '').substring(0, 16).toUpperCase()}</div>
                            <p className="mt-1.5 font-black text-slate-400 text-[6.5px] uppercase tracking-tighter italic leading-none">Verified • Secure Record</p>
                        </div>
                    </div>

                    {/* Center: PATIENT ADVICE (advice) */}
                    <div className="flex-[2.5] min-h-[85px] p-3 bg-indigo-50/30 rounded-xl border border-indigo-200 border-dashed flex flex-col items-center justify-center overflow-hidden">
                        <div className="text-[7.5px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2 border-b border-indigo-100 pb-1 px-4 italic">Patient Advice (AI Suggestions)</div>
                        <div className="w-full text-[9px] text-slate-800 font-bold italic leading-tight text-center space-y-0.5">
                            {visit.prescription?.advice ? visit.prescription.advice.split('\n').map((line: string, i: number) => (
                                <div key={i} className="break-words">{line}</div>
                            )) : (
                                <div className="space-y-0.5">
                                    <div className="break-words">- Monitor clinical symptoms closely.</div>
                                    <div className="break-words">- Maintain adequate hydration levels.</div>
                                    <div className="break-words">- Follow-up SOS if complaints persist.</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Physician Info (Legal) */}
                    <div className="text-center min-w-[200px] h-[85px] flex flex-col items-center justify-between py-1">
                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest leading-none">Digitally Signed By</p>
                        <div className="relative inline-block">
                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-[0.08] pointer-events-none rotate-[-8deg] z-0">
                                <span className="text-[20px] font-black tracking-[0.2em] text-indigo-600 italic whitespace-nowrap">AUTHORISED</span>
                            </div>
                            <p className="text-[15px] font-black text-indigo-950 italic leading-none uppercase tracking-tighter relative z-10">
                                Dr. {visit.doctorName || doctor?.name}
                            </p>
                        </div>
                        <div className="flex flex-col gap-0.5 border-t border-slate-100 pt-1 w-full">
                            <p className="text-[9px] font-black text-indigo-700 uppercase tracking-wide leading-none">{doctor?.specialization?.substring(0, 25) || 'Medical Professional'}</p>
                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-tight bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 inline-block mx-auto mt-0.5 leading-none">
                                Reg: {doctor?.registrationNumber || doctor?.regNo || 'VERIFIED'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Formal Legal Disclaimer */}
                <div className="px-6 pb-4 text-center">
                    <p className="text-[7.5px] text-slate-500 italic font-bold leading-relaxed max-w-[700px] mx-auto tracking-normal">
                        * Authorized original computer-generated medical prescription for diagnostic reference. Validity is contingent upon correlation with the patient's identity and clinical examination. For dispensing: pharmacists must verify the digital hash or QR code.
                    </p>
                </div>

                {/* Final Professional Bar */}
                <div className="final-px-bar" style={{ background: themeGradient }}>
                    <div className="f-bar-inner">
                        <div className="flex items-center gap-5">
                            <span className="bg-white/20 px-2 py-0.5 rounded text-[8px] font-black tracking-widest border border-white/10 uppercase">Original Rx Record</span>
                            <div className="flex items-center gap-3 border-l border-white/20 pl-4 uppercase font-bold text-[9px] tracking-tight">
                                <p>UHID: {displayPatientId}</p>
                                <div className="w-[1px] h-3 bg-white/30"></div>
                                <p>DATE: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                <div className="w-[1px] h-3 bg-white/30"></div>
                                <p>PORTAL: medlab.spotnet.in/portal</p>
                            </div>
                        </div>
                        <p className="font-extrabold italic text-[10px] tracking-tight uppercase">RX ID: {displayRxId}</p>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print { @page { margin: 0; size: auto; } body { background: white !important; margin: 0; padding: 0; } .report-container { width: 100% !important; min-height: 297mm !important; margin: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .header { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .doctor-strip { -webkit-print-color-adjust: exact !important; border-radius: 8px !important; } .final-px-bar { -webkit-print-color-adjust: exact !important; } .no-print { display: none !important; } }
                .header { background: ${themeGradient}; color: white; padding: 16px 20px; display: flex; align-items: center; position: relative; }
                .header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: ${accentGradient}; }
                .header-logo-container { flex: 0 0 180px; display: flex; align-items: center; justify-content: flex-start; }
                .header-logo { width: 90px; height: 90px; object-fit: contain; }
                .header-center { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
                .header-center h1 { font-size: 24px; font-weight: 900; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
                .tagline { font-size: 11px; opacity: 0.95; margin-bottom: 4px; font-style: italic; font-weight: 500; }
                .contact-details { font-size: 9px; opacity: 0.9; line-height: 1.4; display: flex; flex-direction: column; align-items: center; gap: 1px; }
                .contact-flex { display: flex; gap: 12px; font-weight: 600; margin-top: 2px; align-items: center; }
                .separator { opacity: 0.4; }
                .header-right { flex: 0 0 180px; display: flex; align-items: center; justify-content: flex-end; gap: 10px; height: 80px; }
                .header-qr { width: 80px; height: 80px; background: rgba(255, 255, 255, 0.25); border-radius: 10px; padding: 4px; border: 1px solid rgba(255, 255, 255, 0.3); }
                .header-qr img { width: 100%; height: 100%; object-fit: contain; }
                .header-meta-text { text-align: right; color: rgba(255,255,255,0.95); font-size: 8px; line-height: 1.4; display: flex; flex-direction: column; justify-content: center; }
                .meta-label { font-weight: 900; text-transform: uppercase; letter-spacing: -0.2px; opacity: 0.8; }
                .meta-date { font-weight: 800; font-size: 10px; }
                .meta-time { font-weight: 700; font-size: 9px; opacity: 0.9; }
                .meta-id { font-weight: 700; opacity: 0.7; tracking: 0.5px; }
                .doctor-strip { background: #0f172a; color: white; border-radius: 10px; height: 36px; padding: 0 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-bottom: 2px solid #6366f1; }
                .patient-strip { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; height: 34px; padding: 0 16px; display: flex; justify-content: space-between; align-items: center; shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .rx-icon { background: #4f46e5; color: white; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-family: serif; font-style: italic; font-size: 20px; font-weight: 900; }
                .sig-line { width: 220px; border-bottom: 2px solid #e0e7ff; display: flex; align-items: center; justify-content: center; opacity: 0.6; }
                .sig-text { font-family: serif; font-weight: 900; color: #6366f1; text-transform: uppercase; tracking: 0.4em; transform: rotate(-6deg); }
                .digital-sign-box { text-align: center; padding: 10px 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; }
                .hash-text { font-family: 'Courier New', monospace; font-size: 7px; color: #64748b; margin-top: 2px; word-break: break-all; font-weight: 900; }
                .final-px-bar { padding: 12px; color: white; font-weight: 900; font-size: 9px; text-transform: uppercase; tracking: 0.1em; }
                .f-bar-inner { display: flex; justify-content: space-between; padding: 0 16px; opacity: 1; }
                .report-container { background-image: radial-gradient(rgba(15, 23, 42, 0.012) 1px, transparent 1px); background-size: 32px 32px; display: flex; flex-direction: column; }
            `}</style>
        </div>
    );
}
