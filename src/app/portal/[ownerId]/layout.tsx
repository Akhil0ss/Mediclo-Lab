'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import Link from 'next/link';

export default function PatientAuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const ownerId = params.ownerId as string;
    
    const [loading, setLoading] = useState(true);
    const [patientName, setPatientName] = useState('');
    const [branding, setBranding] = useState<any>(null);

    useEffect(() => {
        // 1. Auth Check - Redirect if not matching session
        const storedPatientId = localStorage.getItem('portal_patient_id');
        const storedOwnerId = localStorage.getItem('portal_owner_id');
        const storedName = localStorage.getItem('portal_patient_name');
        const storedUid = localStorage.getItem('portal_patient_uid');

        if (!storedPatientId || !storedOwnerId) {
            router.push('/portal/login');
            return;
        }

        // Only redirect if ownerId is loaded and doesn't match
        if (ownerId && storedOwnerId !== ownerId) {
            router.push('/portal/login');
            return;
        }

        setPatientName(storedName || 'Patient');

        // 2. Fetch Branding
        const fetchBranding = async () => {
            try {
                const snap = await get(ref(database, `branding/${ownerId}`));
                if (snap.exists()) setBranding(snap.val());
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchBranding();
    }, [ownerId, router]);

    const handleLogout = () => {
        localStorage.removeItem('portal_patient_id');
        localStorage.removeItem('portal_patient_uid');
        localStorage.removeItem('portal_owner_id');
        localStorage.removeItem('portal_patient_name');
        localStorage.removeItem('portal_mobile');
        router.push('/portal/login');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Synchronizing Portal...</p>
                </div>
            </div>
        );
    }

    const navItems = [
        { name: 'Dashboard', icon: 'fas fa-th-large', path: `/portal/${ownerId}/dashboard` },
        { name: 'Prescriptions', icon: 'fas fa-prescription', path: `/portal/${ownerId}/prescriptions` },
        { name: 'Reports', icon: 'fas fa-flask-vial', path: `/portal/${ownerId}/reports` },
        { name: 'Book Appointment', icon: 'fas fa-calendar-plus', path: `/portal/${ownerId}/book` },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Top Navigation */}
            <nav className="bg-white border-b sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 lg:px-8 flex justify-between items-center h-20">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                            <i className="fas fa-clinic-medical text-white text-lg"></i>
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                                {branding?.brandName || branding?.labName || branding?.lab_name || 'Patient Portal'}
                            </h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Welcome, {patientName}</p>
                        </div>
                    </div>

                    <button 
                        onClick={handleLogout}
                        className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
                    >
                        <i className="fas fa-sign-out-alt mr-2"></i> Logout
                    </button>
                </div>
            </nav>

            {/* Content Area */}
            <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {children}
            </main>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50 px-4 py-2 flex justify-around">
                <Link 
                    href={`/portal/${ownerId}/dashboard`}
                    className={`flex flex-col items-center gap-1 p-2 transition-all no-underline ${pathname.includes('dashboard') ? 'text-blue-600' : 'text-slate-400'}`}
                >
                    <i className="fas fa-th-large text-lg"></i>
                    <span className="text-[9px] font-black uppercase tracking-tighter shadow-none">Dashboard</span>
                </Link>
                <Link 
                    href={`/portal/${ownerId}/book`}
                    className={`flex flex-col items-center gap-1 p-2 transition-all no-underline ${pathname.includes('book') ? 'text-blue-600' : 'text-slate-400'}`}
                >
                    <i className="fas fa-calendar-plus text-lg"></i>
                    <span className="text-[9px] font-black uppercase tracking-tighter shadow-none">Book</span>
                </Link>
            </div>
            
            {/* Mobile Spacing for Bottom Nav */}
            <div className="h-20 md:hidden"></div>
        </div>
    );
}
