'use client';

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase';
import { ref, get, push, set, update } from 'firebase/database';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';

export default function BookAppointment() {
    const params = useParams();
    const router = useRouter();
    const ownerId = params.ownerId as string;
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [doctors, setDoctors] = useState<any[]>([]);
    
    // Form State
    const [form, setForm] = useState({
        patientName: '',
        mobile: '',
        age: '',
        gender: 'Male',
        date: '',
        time: '',
        doctorId: '',
        type: 'Consultation',
        notes: ''
    });

    useEffect(() => {
        // Check session
        const storedPid = localStorage.getItem('portal_patient_id');
        const storedOid = localStorage.getItem('portal_owner_id');
        const storedUid = localStorage.getItem('portal_patient_uid');

        if (storedPid && storedOid === ownerId) {
            setIsLoggedIn(true);
            if (storedUid) {
                get(ref(database, `patients/${ownerId}/${storedUid}`)).then(snap => {
                    if (snap.exists()) {
                        const data = snap.val();
                        setForm(prev => ({
                            ...prev,
                            patientName: data.name || '',
                            mobile: data.mobile || '',
                            age: data.age || '',
                            gender: data.gender || 'Male',
                            patientId: storedPid
                        }));
                    }
                });
            } else {
                // Background fallback for older sessions
                const storedName = localStorage.getItem('portal_patient_name');
                const storedMobile = localStorage.getItem('portal_mobile');
                setForm(prev => ({
                    ...prev,
                    patientName: storedName || '',
                    mobile: storedMobile || '',
                    patientId: storedPid
                }));
            }
        }

        // Fetch Doctors from Staff node
        get(ref(database, `users/${ownerId}/auth/staff`)).then(snap => {
            if (snap.exists()) {
                const list: any[] = [];
                snap.forEach(c => { 
                    const data = c.val();
                    // Filter for doctors/consultants
                    if (data.role === 'doctor' || data.role === 'dr-staff') {
                        list.push({ id: c.key, ...data });
                    }
                });
                setDoctors(list);
            }
        });
    }, [ownerId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const storedPid = localStorage.getItem('portal_patient_id');
        setLoading(true);

        try {
            const appointmentRef = push(ref(database, `appointments/${ownerId}`));
            const selectedDoctor = doctors.find(d => d.id === form.doctorId);
            
            const appointmentData = {
                ...form,
                doctorName: selectedDoctor?.name || 'Any Available',
                status: 'pending',
                createdAt: new Date().toISOString(),
                source: 'portal',
                isMember: isLoggedIn
            };

            await set(appointmentRef, appointmentData);

            // 1.5. NOTIFICATION: Push to owner dashboard
            const notificationRef = push(ref(database, `notifications/${ownerId}`));
            await set(notificationRef, {
                title: 'New Online Appointment',
                message: `${form.patientName} requested an appointment for ${form.date} at ${form.time}`,
                type: 'online_appointment',
                createdAt: new Date().toISOString(),
                read: false,
                data: {
                    appointmentId: appointmentRef.key,
                    patientName: form.patientName,
                    date: form.date,
                    time: form.time
                }
            });

            // 2. BINDING: Update patient_records index if logged in
            if (isLoggedIn && storedPid) {
                const appointmentKey = appointmentRef.key;
                await update(ref(database, `patient_records/${ownerId}/${storedPid}/appointments/${appointmentKey}`), {
                    date: form.date,
                    time: form.time,
                    type: form.type,
                    doctor: selectedDoctor?.name || 'Consultant',
                    status: 'pending'
                });
            }

            alert('Appointment requested successfully! We will contact you shortly to confirm.');
            if (isLoggedIn) {
                router.push(`/portal/${ownerId}/dashboard`);
            } else {
                router.push(`/portal/login`);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to book appointment. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            {/* Top Navigation */}
            <div className="flex items-center justify-between animate-in fade-in slide-in-from-left-4 duration-500">
                <Link 
                    href={`/portal/${ownerId}/dashboard`} 
                    className="flex items-center gap-2 text-slate-400 hover:text-blue-600 font-black text-[10px] uppercase tracking-widest no-underline transition-all group"
                >
                    <div className="w-8 h-8 rounded-full border-2 border-slate-100 flex items-center justify-center group-hover:border-blue-100 group-hover:bg-blue-50 transition-all">
                        <i className="fas fa-chevron-left"></i>
                    </div>
                    Back to Dashboard
                </Link>
            </div>

            <div className="text-center animate-in fade-in slide-in-from-top-4 duration-700">
                <span className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-4 inline-block">
                    {isLoggedIn ? 'Welcome Back' : 'New Visit Request'}
                </span>
                <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight uppercase">Request Appointment</h1>
                <p className="text-slate-400 text-sm font-medium mt-2">Skip the queue, book your slot at our Lab / Clinic.</p>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-8 lg:p-12 border border-slate-50 animate-in zoom-in-95 duration-500">
                <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-8">
                    {/* Patient Details */}
                    <div className="space-y-6">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <i className="fas fa-user-circle text-blue-600 text-sm"></i> Patient Details
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="group">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                                <input 
                                    type="text" 
                                    value={form.patientName}
                                    onChange={e => setForm({...form, patientName: e.target.value})}
                                    placeholder="John Doe"
                                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                    required
                                    disabled={isLoggedIn}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Mobile No.</label>
                                    <input 
                                        type="tel" 
                                        value={form.mobile}
                                        onChange={e => setForm({...form, mobile: e.target.value})}
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                        required
                                        disabled={isLoggedIn}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Age</label>
                                    <input 
                                        type="number" 
                                        value={form.age}
                                        onChange={e => setForm({...form, age: e.target.value})}
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                        required
                                        disabled={isLoggedIn}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Gender</label>
                                <div className="flex gap-4">
                                    {['Male', 'Female', 'Other'].map(g => (
                                        <button 
                                            key={g} 
                                            type="button"
                                            onClick={() => !isLoggedIn && setForm({...form, gender: g})}
                                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                                form.gender === g ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-50 text-slate-400 border border-slate-100'
                                            } ${isLoggedIn && form.gender !== g ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Visit Details */}
                    <div className="space-y-6">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <i className="fas fa-clock text-blue-600 text-sm"></i> Visit Schedule
                        </h2>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Pick Date</label>
                                    <input 
                                        type="date" 
                                        min={new Date().toISOString().split('T')[0]}
                                        value={form.date}
                                        onChange={e => setForm({...form, date: e.target.value})}
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Preferred Time</label>
                                    <input 
                                        type="time" 
                                        value={form.time}
                                        onChange={e => setForm({...form, time: e.target.value})}
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Select Doctor</label>
                                <select 
                                    value={form.doctorId}
                                    onChange={e => setForm({...form, doctorId: e.target.value})}
                                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none"
                                    required
                                >
                                    <option value="">Any Available Specialist</option>
                                    {doctors.map(doc => (
                                        <option key={doc.id} value={doc.id}>Dr. {doc.name} - {doc.specialization || 'Consultant'}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Appointment Type</label>
                                <div className="flex gap-3">
                                    {['Consultation', 'Lab Test', 'Follow-up'].map(t => (
                                        <button 
                                            key={t}
                                            type="button"
                                            onClick={() => setForm({...form, type: t})}
                                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                                                form.type === t ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100'
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 pt-6">
                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest py-5 rounded-[1.5rem] shadow-2xl shadow-blue-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <><i className="fas fa-spinner fa-spin"></i> Processing Request...</>
                            ) : (
                                <><i className="fas fa-paper-plane"></i> Confirm Booking Request</>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex gap-4 animate-in slide-in-from-bottom-2 duration-700">
                <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
                    <i className="fas fa-info-circle"></i>
                </div>
                <div>
                    <h5 className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1 leading-none">Important Note</h5>
                    <p className="text-[11px] text-amber-700 font-medium leading-relaxed italic">
                        This is a booking request. Our reception team will review the slot and confirm your appointment via SMS or Phone Call shortly after submission.
                    </p>
                </div>
            </div>
        </div>
    );
}
