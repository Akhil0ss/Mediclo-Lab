'use client';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getDataOwnerId } from '@/lib/dataUtils';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import NotificationBell from '@/components/NotificationBell';
import Intercom from '@/components/Intercom';

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
        const { ref, onValue } = require('firebase/database');
        const { database } = require('@/lib/firebase');
        const brandingRef = ref(database, 'branding/' + dataOwnerId);
        const unsub = onValue(brandingRef, (snapshot: any) => {
            if (snapshot.exists()) setBranding(snapshot.val());
        });
        return () => unsub();
    }, [user, dataOwnerId]);

    const handleSignOut = async () => {
        try {
            const authMethod = localStorage.getItem('authMethod');
            if (authMethod !== 'username') await signOut(auth);
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/';
        } catch (e) {
            window.location.href = '/';
        }
    };

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: 'fa-home', path: '/dashboard' },
        { id: 'patients', label: 'Patients', icon: 'fa-users', path: '/dashboard/patients' },
        { id: 'samples', label: 'Samples', icon: 'fa-vial', path: '/dashboard/samples' },
        { id: 'reports', label: 'Reports', icon: 'fa-file-medical', path: '/dashboard/reports' },
        { id: 'templates', label: 'Templates', icon: 'fa-flask-vial', path: '/dashboard/templates' },
        { id: 'analytics', label: 'Analytics', icon: 'fa-chart-bar', path: '/dashboard/analytics' },
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
                        <NotificationBell />
                        <div className="text-right mr-2">
                            <p className="text-sm font-semibold">{userProfile?.name}</p>
                            <span className="text-xs bg-white/30 px-2 py-0.5 rounded-full">{userProfile?.role?.toUpperCase() || 'ADMIN'}</span>
                        </div>
                        <Link href="/dashboard/settings" className="bg-white/20 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/30"><i className="fas fa-cog"></i></Link>
                        <button onClick={handleSignOut} className="bg-white/20 px-4 py-2 rounded-lg hover:bg-white/30"><i className="fas fa-sign-out-alt"></i> Logout</button>
                    </div>
                </div>
            </header>

            <div className="container-pc w-full mx-auto p-6 lg:px-8 grid grid-cols-12 gap-6">
                <aside className="col-span-12 lg:col-span-2 space-y-2">
                    {tabs.map(tab => (
                        <Link key={tab.id} href={tab.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ` + (activeTab === tab.id ? 'gradient-colorful text-white shadow-lg scale-105' : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 shadow-sm')}>
                            <i className={`fas ` + tab.icon + ` w-6`}></i> {tab.label}
                        </Link>
                    ))}
                    <div className="mt-8 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 text-center">
                        <i className="fas fa-headset text-3xl text-blue-300 mb-2"></i>
                        <p className="text-xs text-blue-800 font-bold">Need Help?</p>
                        <p className="text-[10px] text-gray-500">Contact Support</p>
                    </div>
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
            <Intercom />
        </ToastProvider>
    );
}
