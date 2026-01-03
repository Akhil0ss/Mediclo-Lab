'use client';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getDataOwnerId } from '@/lib/dataUtils';
import { ToastProvider, useToast } from '@/contexts/ToastContext';


function DashboardContent({ children }: { children: React.ReactNode }) {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [branding, setBranding] = useState<{ logoUrl?: string; tagline?: string }>({});

    const dataOwnerId = useMemo(() => {
        if (!user) return '';
        return getDataOwnerId(userProfile, user.uid);
    }, [user, userProfile]);

    useEffect(() => {
        if (!loading && !user) router.push('/login');
    }, [loading, user, router]);

    useEffect(() => {
        const path = pathname.split('/').pop() || 'dashboard';
        setActiveTab(path === 'dashboard' ? 'dashboard' : path);
    }, [pathname]);

    useEffect(() => {
        if (!user || !dataOwnerId) return;
        const brandingRef = ref(database, 'branding/' + dataOwnerId);
        const unsub = onValue(brandingRef, (snapshot: any) => {
            if (snapshot.exists()) setBranding(snapshot.val());
        });
        return () => unsub();
    }, [user, dataOwnerId]);

    const handleSignOut = async () => {
        try {
            // Always sign out from Firebase to ensure clean state
            await signOut(auth).catch(() => { });

            // Clear all local storage and session data
            localStorage.clear();
            sessionStorage.clear();

            // Force redirect to login
            window.location.href = '/login';
        } catch (e) {
            localStorage.clear();
            window.location.href = '/login';
        }
    };

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: 'fa-home', path: '/dashboard' },
        { id: 'patients', label: 'Patients', icon: 'fa-users', path: '/dashboard/patients' },
        { id: 'samples', label: 'Samples', icon: 'fa-vial', path: '/dashboard/samples' },
        { id: 'reports', label: 'Reports', icon: 'fa-file-medical', path: '/dashboard/reports' },
        { id: 'templates', label: 'Templates', icon: 'fa-flask-vial', path: '/dashboard/templates' },
        { id: 'analytics', label: 'Analytics', icon: 'fa-chart-bar', path: '/dashboard/analytics' },
        { id: 'settings', label: 'Settings', icon: 'fa-cog', path: '/dashboard/settings' },
    ];

    if (loading) return <div className='min-h-screen flex items-center justify-center'>Loading...</div>;
    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="gradient-colorful text-white shadow-lg sticky top-0 z-50">
                <div className="container-pc w-full mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2 rounded-lg h-12 w-12 flex items-center justify-center">
                            {branding.logoUrl ? <img src={branding.logoUrl} className="w-full h-full object-contain" /> : <i className="fas fa-flask text-2xl"></i>}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{userProfile?.labName || 'Mediclo LIMS'}</h1>
                            <p className="text-sm opacity-90">{branding.tagline || 'Lab Information System'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right mr-2">
                            <p className="text-sm font-semibold">{user?.displayName || userProfile?.name}</p>
                            <span className="text-xs bg-white/30 px-2 py-0.5 rounded-full">{(userProfile?.role === 'receptionist' ? 'LAB ADMIN' : userProfile?.role?.toUpperCase()) || 'LAB ADMIN'}</span>
                        </div>
                        <button onClick={handleSignOut} className="bg-white/20 px-4 py-2 rounded-lg hover:bg-white/30"><i className="fas fa-sign-out-alt"></i> Logout</button>
                    </div>
                </div>
            </header>

            <div className="container-pc w-full mx-auto p-6 lg:px-8 grid grid-cols-12 gap-6">
                <aside className="col-span-12 lg:col-span-2 space-y-2 lg:sticky lg:top-24 lg:self-start lg:h-[calc(100vh-120px)] lg:overflow-y-auto pr-2">
                    {tabs.map(tab => (
                        <Link key={tab.id} href={tab.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ` + (activeTab === tab.id ? 'gradient-colorful text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 shadow-sm')}>
                            <i className={`fas ` + tab.icon + ` w-6`}></i> {tab.label}
                        </Link>
                    ))}
                    <a href="https://wa.me/917619948657?text=Hi%2C%20I%20need%20help%20with%20SpotNet%20MedOS" target="_blank" rel="noopener noreferrer" className="block mt-8 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 text-center hover:shadow-md transition-shadow cursor-pointer">
                        <i className="fas fa-headset text-3xl text-blue-300 mb-2"></i>
                        <p className="text-xs text-blue-800 font-bold">Need Help?</p>
                        <p className="text-[10px] text-gray-500">Contact Support</p>
                    </a>
                </aside>
                <main className="col-span-12 lg:col-span-10 min-h-[500px]">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <DashboardContent>{children}</DashboardContent>
        </ToastProvider>
    );
}
