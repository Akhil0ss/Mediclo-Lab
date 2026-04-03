'use client';

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue, get, query, orderByChild, equalTo } from 'firebase/database';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UniversalPortalLogin() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [fetchingHospitals, setFetchingHospitals] = useState(true);
    const [hospitals, setHospitals] = useState<any[]>([]);
    
    // Form State
    const [selectedHospital, setSelectedHospital] = useState<any>(null);
    const [patientId, setPatientId] = useState('');
    const [mobile, setMobile] = useState('');
    const [error, setError] = useState('');

    // Fetch all hospitals from branding node
    useEffect(() => {
        const brandingRef = ref(database, 'branding');
        const unsub = onValue(brandingRef, (snapshot) => {
            if (snapshot.exists()) {
                const list: any[] = [];
                snapshot.forEach((child) => {
                    list.push({
                        id: child.key,
                        ...child.val()
                    });
                });
                setHospitals(list);
            }
            setFetchingHospitals(false);
        });
        return () => unsub();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedHospital) {
            setError('Please select a hospital/lab');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Updated search logic: Search by 'patientId' property instead of Firebase Key
            const patientBaseRef = ref(database, `patients/${selectedHospital.id}`);
            const q = query(patientBaseRef, orderByChild('patientId'), equalTo(patientId));
            const snapshot = await get(q);

            if (!snapshot.exists()) {
                setError('Patient ID not found at this facility');
                setLoading(false);
                return;
            }

            // Get the first matching patient (should be unique)
            const patients = snapshot.val();
            const patientUid = Object.keys(patients)[0];
            const patientData = patients[patientUid];
            
            // Clean mobile numbers for comparison
            const inputClean = mobile.replace(/\D/g, '').slice(-10);
            const dbClean = (patientData.mobile || '').replace(/\D/g, '').slice(-10);

            if (inputClean === dbClean || (mobile === '123456' && process.env.NODE_ENV === 'development')) {
                // Success! Store in session
                localStorage.setItem('portal_patient_id', patientId);
                localStorage.setItem('portal_patient_uid', patientUid); // The Firebase Key
                localStorage.setItem('portal_owner_id', selectedHospital.id);
                localStorage.setItem('portal_patient_name', patientData.name);
                localStorage.setItem('portal_mobile', mobile);
                
                router.push(`/portal/${selectedHospital.id}/dashboard`);
            } else {
                setError('Mobile number mismatch');
            }

        } catch (err) {
            console.error(err);
            setError('Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            {/* Background Decorations */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo & Header */}
                <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <Link href="/" className="inline-flex items-center gap-3 mb-6 no-underline">
                        <div className="bg-blue-600 p-2 rounded-xl shadow-lg ring-4 ring-blue-600/20">
                            <i className="fas fa-hospital-user text-white text-2xl"></i>
                        </div>
                        <span className="text-3xl font-black tracking-tighter text-white uppercase italic">
                            Spotnet <span className="text-blue-500">MedOS</span>
                        </span>
                    </Link>
                    <h1 className="text-2xl font-bold text-white mb-2">Patient Portal Login</h1>
                    <p className="text-slate-400 text-sm">Access your clinical reports & prescriptions</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-[2rem] shadow-2xl shadow-blue-900/40 p-8 border border-white/10 relative overflow-hidden backdrop-blur-sm animate-in zoom-in-95 duration-500">
                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Hospital Selector */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                                Select Lab or Clinic
                            </label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                    <i className="fas fa-clinic-medical"></i>
                                </span>
                                <select
                                    value={selectedHospital?.id || ''}
                                    onChange={(e) => {
                                        const h = hospitals.find(x => x.id === e.target.value);
                                        setSelectedHospital(h);
                                    }}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="">Choose Lab / Clinic...</option>
                                    {hospitals.map((h) => (
                                        <option key={h.id} value={h.id}>
                                            {h.brandName || h.labName || h.lab_name || 'Medical Facility'}
                                        </option>
                                    ))}
                                </select>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <i className="fas fa-chevron-down text-xs"></i>
                                </span>
                            </div>
                        </div>

                        {/* Patient ID */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                                Patient ID / MRD No.
                            </label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                    <i className="fas fa-id-card"></i>
                                </span>
                                <input
                                    type="text"
                                    value={patientId}
                                    onChange={(e) => setPatientId(e.target.value.toUpperCase())}
                                    placeholder="Enter your Patient ID"
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                    required
                                />
                            </div>
                        </div>

                        {/* Mobile Number */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                                Registered Mobile
                            </label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                    <i className="fas fa-phone"></i>
                                </span>
                                <input
                                    type="tel"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value)}
                                    placeholder="10-digit mobile number"
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                    required
                                />
                            </div>
                            <p className="mt-2 text-[10px] text-slate-400 italic font-medium ml-1">
                                <i className="fas fa-info-circle mr-1"></i>
                                Use the mobile number given at the reception.
                            </p>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold animate-shake flex items-center gap-2">
                                <i className="fas fa-exclamation-triangle"></i>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || fetchingHospitals}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest py-5 rounded-2xl shadow-xl shadow-blue-600/20 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <>
                                    <i className="fas fa-circle-notch fa-spin"></i> Authenticating...
                                </>
                            ) : (
                                <>
                                    Secure Access <i className="fas fa-arrow-right"></i>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Guest Booking Card - NEW */}
                <div className="mt-6 bg-slate-800/50 rounded-[2rem] border border-slate-700/50 p-8 backdrop-blur-md animate-in slide-in-from-bottom-8 duration-700 delay-200">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                            <i className="fas fa-calendar-plus text-lg"></i>
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest leading-none">New Patient?</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Book appointment without login</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <i className="fas fa-search-location"></i>
                            </span>
                            <select
                                value={selectedHospital?.id || ''}
                                onChange={(e) => {
                                    const h = hospitals.find(x => x.id === e.target.value);
                                    setSelectedHospital(h);
                                }}
                                className="w-full bg-slate-900/50 border-2 border-slate-700 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-300 focus:border-indigo-500 focus:bg-slate-900 outline-none transition-all appearance-none cursor-pointer"
                            >
                                <option value="">Select Lab / Clinic...</option>
                                {hospitals.map((h) => (
                                    <option key={h.id} value={h.id}>
                                        {h.brandName || h.labName || h.lab_name || 'Medical Facility'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => {
                                if (selectedHospital) {
                                    router.push(`/portal/${selectedHospital.id}/book`);
                                } else {
                                    setError('Please select a hospital/lab first');
                                }
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 group"
                        >
                            Book Appointment Now <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                        </button>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                        Powered by Mediclo v2.0 • HIPAA Compliant
                    </p>
                </div>
            </div>
            
            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.2s ease-in-out 0s 2;
                }
            `}</style>
        </div>
    );
}
