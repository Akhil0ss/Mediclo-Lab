'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function PrintOPDPage() {
    const params = useParams();
    const { user, userProfile, loading: authLoading } = useAuth();
    const [visit, setVisit] = useState<any>(null);
    const [branding, setBranding] = useState<any>(null);
    const [doctor, setDoctor] = useState<any>(null);
    const [ownerId, setOwnerId] = useState<string>('');
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

                if (!currentOwnerId) {
                    setLoading(false);
                    return;
                }

                setOwnerId(currentOwnerId);

                // Fetch Visit
                const visitSnap = await get(ref(database, `opd/${currentOwnerId}/${visitId}`));
                if (!visitSnap.exists()) {
                    setLoading(false);
                    return;
                }
                const visitData = visitSnap.val();

                // Fetch Branding
                const brandingSnap = await get(ref(database, `branding/${currentOwnerId}`));
                const brandingData = brandingSnap.val() || {};

                // Fetch Doctor Info (to get Reg No / Specialization if not in visit)
                let doctorData = null;
                if (visitData.doctorId) {
                    const docSnap = await get(ref(database, `users/${currentOwnerId}/auth/staff/${visitData.doctorId}`));
                    doctorData = docSnap.val();
                }

                setVisit(visitData);
                setBranding(brandingData);
                setDoctor(doctorData);
                setLoading(false);

            } catch (error) {
                console.error('Error fetching print data:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [visitId, authLoading, user, userProfile]);

    useEffect(() => {
        if (loading || !visit || !branding || printTriggeredRef.current) return;
        printTriggeredRef.current = true;
        setTimeout(() => {
            window.print();
        }, 1000);
    }, [loading, visit, branding]);

    if (loading) return <div className="p-10 text-center font-bold">Loading Prescription...</div>;
    if (!visit) return <div className="p-10 text-center font-bold text-red-600">Prescription not found!</div>;

    const themeColor = branding.primaryColor || '#2563eb';

    return (
        <div className="report-container bg-white min-h-screen font-sans text-gray-900 overflow-hidden" style={{ width: '210mm', margin: '0 auto' }}>
            {/* Header */}
            <div className="p-8 border-b-4 flex justify-between items-center bg-gray-50" style={{ borderBottomColor: themeColor }}>
                <div className="flex items-center gap-6">
                    {branding.logoUrl && <img src={branding.logoUrl} alt="Logo" className="w-20 h-20 object-contain" />}
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tight" style={{ color: themeColor }}>{branding.labName || 'Mediclo Clinic'}</h1>
                        <p className="text-xs font-bold text-gray-500 italic mb-2">{branding.tagline || 'Your Health, Our Priority'}</p>
                        <div className="text-[10px] text-gray-600 leading-relaxed">
                            <p>{branding.address || 'Health Center Main Road'}</p>
                            <p>{branding.city}, {branding.state} - {branding.pincode}</p>
                            <p className="font-bold mt-1">📞 {branding.contact} | ✉️ {branding.email}</p>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="bg-white p-2 border-2 rounded-xl mb-2" style={{ borderColor: themeColor }}>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=OPD_${visitId}`} alt="QR" className="w-16 h-16 mx-auto" />
                    </div>
                    <p className="text-[8px] font-black text-gray-400">Rx ID: {visitId.slice(-8).toUpperCase()}</p>
                </div>
            </div>

            {/* Sub-Header / Doctor Info */}
            <div className="px-8 py-4 border-b flex justify-between items-end bg-white">
                <div>
                    <h2 className="text-lg font-black text-gray-800">Dr. {visit.doctorName || doctor?.name}</h2>
                    <p className="text-xs font-bold text-blue-600">{doctor?.specialization || 'Consultant Physician'}</p>
                    {doctor?.registrationNumber && <p className="text-[9px] text-gray-500 font-mono">Reg No: {doctor.registrationNumber}</p>}
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-gray-500">Date: <span className="text-gray-900">{new Date(visit.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                    <p className="text-xs font-bold text-gray-500">Time: <span className="text-gray-900">{new Date(visit.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></p>
                </div>
            </div>

            {/* Patient Info Bar */}
            <div className="mx-8 mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 grid grid-cols-4 gap-4">
                <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Patient Name</label>
                    <span className="text-sm font-bold text-gray-800">{visit.patientName}</span>
                </div>
                <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Patient ID</label>
                    <span className="text-sm font-mono font-bold text-gray-800">{visit.patientId}</span>
                </div>
                <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Token No.</label>
                    <span className="text-sm font-black text-blue-600">#{visit.token}</span>
                </div>
                <div className="text-right">
                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Visit Type</label>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">OPD Consultation</span>
                </div>
            </div>

            {/* Vitals Section */}
            <div className="mx-8 mt-4 grid grid-cols-5 gap-3">
                {Object.entries(visit.vitals || {}).map(([key, val]) => (
                    val ? (
                        <div key={key} className="p-3 border rounded-xl bg-white border-dashed border-gray-300">
                            <p className="text-[8px] font-black text-gray-400 uppercase mb-1">{key === 'bp' ? 'BP (mmHg)' : key === 'spo2' ? 'SpO2 %' : key}</p>
                            <p className="text-xs font-black text-gray-800">{val as string}</p>
                        </div>
                    ) : null
                ))}
            </div>

            {/* Clinical Notes Body */}
            <div className="mx-8 mt-8 grid grid-cols-1 gap-8 min-h-[400px]">
                <div className="space-y-6">
                    {/* Complaints & Diagnosis */}
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-1 mb-2">Chief Complaints</h3>
                            <p className="text-sm italic text-gray-700 leading-relaxed">{visit.complaints || 'No specific complaints recorded.'}</p>
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-1 mb-2">Diagnosis</h3>
                            <p className="text-sm font-bold text-gray-900 leading-relaxed underline decoration-blue-200 decoration-4">{visit.prescription?.diagnosis || 'Provisional Diagnosis Pending'}</p>
                        </div>
                    </div>

                    {/* Prescription Table */}
                    <div className="mt-8">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl font-serif italic font-black text-blue-600">Rx</span>
                            <div className="h-[2px] flex-1 bg-gray-100"></div>
                        </div>
                        
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-black text-gray-400 uppercase border-b">
                                    <th className="pb-2">Medicine Detail</th>
                                    <th className="pb-2">Dosage</th>
                                    <th className="pb-2">Frequency</th>
                                    <th className="pb-2">Duration</th>
                                    <th className="pb-2 text-right">Instructions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {visit.prescription?.medicines?.map((med: any, idx: number) => (
                                    <tr key={idx} className="text-sm">
                                        <td className="py-3 pr-4">
                                            <p className="font-bold text-gray-900">{med.name}</p>
                                        </td>
                                        <td className="py-3 text-gray-700">{med.dosage}</td>
                                        <td className="py-3">
                                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black rounded border border-blue-100">{med.frequency}</span>
                                        </td>
                                        <td className="py-3 text-gray-700">{med.duration}</td>
                                        <td className="py-3 text-right text-xs font-medium italic text-gray-500">{med.instructions}</td>
                                    </tr>
                                ))}
                                {!visit.prescription?.medicines?.length && (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center text-gray-400 italic">No medicines prescribed.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Advice Section */}
                    {visit.prescription?.advice && (
                        <div className="mt-8 p-4 bg-yellow-50/50 rounded-2xl border border-yellow-100">
                            <h3 className="text-xs font-black text-yellow-700 uppercase tracking-widest mb-2">Advice / General Instructions</h3>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{visit.prescription.advice}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-auto p-8 border-t-2" style={{ borderTopColor: themeColor }}>
                <div className="flex justify-between items-end">
                    <div>
                        {visit.prescription?.nextVisit && (
                            <div className="mb-4">
                                <p className="text-[10px] font-black text-blue-600 uppercase">Next Follow-up Visit</p>
                                <p className="text-sm font-bold text-gray-800">{new Date(visit.prescription.nextVisit).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                            </div>
                        )}
                        <p className="text-[10px] text-gray-400 italic max-w-sm">This is a digitally generated medical prescription. Please consult your doctor for any clarifications.</p>
                    </div>
                    <div className="text-center">
                        <div className="w-40 h-1 border-b-2 border-gray-300 mb-2 mx-auto"></div>
                        <p className="text-xs font-bold text-gray-800">Digitally Signed By</p>
                        <p className="text-[10px] font-bold text-blue-600">Dr. {visit.doctorName}</p>
                    </div>
                </div>
                <div className="mt-8 pt-4 border-t border-gray-100 text-center">
                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Powered by Mediclo-Lab Cloud Health System</p>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { background: white; margin: 0; padding: 0; }
                    .report-container { width: 100% !important; height: 100vh !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
                    .no-print { display: none !important; }
                }
                .report-container {
                    background-image: linear-gradient(rgba(37, 99, 235, 0.02) 1px, transparent 1px),
                                    linear-gradient(90deg, rgba(37, 99, 235, 0.02) 1px, transparent 1px);
                    background-size: 20px 20px;
                }
            `}</style>
        </div>
    );
}
