'use client';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, database } from '@/lib/firebase';
import { ref, onValue, update, query, limitToLast } from 'firebase/database';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getDataOwnerId } from '@/lib/dataUtils';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import DashboardChat from '@/components/DashboardChat';
import AILabSuggestions from '@/components/AILabSuggestions';

function DashboardContent({ children }: { children: React.ReactNode }) {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [branding, setBranding] = useState<{ logoUrl?: string; tagline?: string }>({});
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);

    const { showToast } = useToast();

    const dataOwnerId = useMemo(() => {
        if (!user) return '';
        return getDataOwnerId(userProfile, user.uid);
    }, [user, userProfile]);

    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        if (!loading && !user) router.push('/login');
    }, [loading, user, router]);

    if (loading || (user && !userProfile)) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-600/20 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="flex flex-col items-center">
                    <p className="text-blue-600 font-black text-xs uppercase tracking-[0.2em] animate-pulse">Syncing MedOS</p>
                    <p className="text-gray-400 text-[10px] mt-1 font-bold uppercase">Preparing Workspace...</p>
                </div>
            </div>
        );
    }

    useEffect(() => {
        const path = pathname.split('/').pop() || 'dashboard';
        setActiveTab(path === 'dashboard' ? 'dashboard' : path);
    }, [pathname]);

    useEffect(() => {
        if (!user || !dataOwnerId) return;

        // Branding
        const brandingRef = ref(database, 'branding/' + dataOwnerId);
        const unsubBranding = onValue(brandingRef, (snapshot: any) => {
            if (snapshot.exists()) setBranding(snapshot.val());
        });

        // Notifications
        const notifRef = query(ref(database, 'notifications/' + dataOwnerId), limitToLast(20));
        const unsubNotif = onValue(notifRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setNotifications(list.reverse()); // Newest first
            } else {
                setNotifications([]);
            }
        });

        return () => { unsubBranding(); unsubNotif(); };
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

    const isDoctor = userProfile?.role === 'doctor';
    const isDrStaff = userProfile?.role === 'dr-staff';
    const isClinical = isDoctor || isDrStaff;
    const isLab = userProfile?.role === 'lab';
    const isPharmacy = userProfile?.role === 'pharmacy';
    const isOwner = userProfile?.role === 'owner';
    const isReceptionist = userProfile?.role === 'receptionist';

    const tabs = useMemo(() => {
        const baseTabs = [
            { id: 'dashboard', label: 'Dashboard', icon: 'fa-home', path: '/dashboard', group: 'General' },
        ];

        // Pharmacy specific: Only Dashboard and Settings
        if (isPharmacy) {
            baseTabs.push({ id: 'settings', label: 'Settings', icon: 'fa-cog', path: '/dashboard/settings', group: 'Admin' });
            return baseTabs;
        }

        if (!isLab) {
            baseTabs.push({ id: 'patients', label: 'Patients', icon: 'fa-users', path: '/dashboard/patients', group: 'Medical' });
            baseTabs.push({ id: 'opd', label: 'OPD', icon: 'fa-stethoscope', path: '/dashboard/opd', group: 'Medical' });
        }

        if (!isDoctor) {
            baseTabs.push({ id: 'samples', label: 'Samples', icon: 'fa-vial', path: '/dashboard/samples', group: 'Laboratory' });
            baseTabs.push({ id: 'reports', label: 'Reports', icon: 'fa-file-medical', path: '/dashboard/reports', group: 'Laboratory' });
        }

        if (isOwner || isReceptionist) {
            baseTabs.push({ id: 'templates', label: 'Templates', icon: 'fa-flask-vial', path: '/dashboard/templates', group: 'Laboratory' });
            baseTabs.push({ id: 'analytics', label: 'Analytics', icon: 'fa-chart-bar', path: '/dashboard/analytics', group: 'Admin' });
            if (isOwner) {
                baseTabs.push({ id: 'settings', label: 'Settings', icon: 'fa-cog', path: '/dashboard/settings', group: 'Admin' });
            }
        }

        return baseTabs;
    }, [isDoctor, isOwner, isReceptionist, isLab, isPharmacy]);

    const groupedTabs = useMemo(() => {
        const groups: { [key: string]: any[] } = {};
        tabs.forEach(tab => {
            if (!groups[tab.group]) groups[tab.group] = [];
            groups[tab.group].push(tab);
        });
        return groups;
    }, [tabs]);

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
                            <h1 className="text-2xl font-bold">{(branding as any).labName || userProfile?.labName || 'Mediclo LIMS'}</h1>
                            <p className="text-sm opacity-90">{branding.tagline || 'Lab Information System'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative bg-white/20 p-2 rounded-lg hover:bg-white/30 text-white transition-colors"
                            >
                                <i className="fas fa-bell text-lg"></i>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            {/* Dropdown */}
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden text-gray-800 animate-fadeIn">
                                    <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
                                        <h3 className="font-bold text-sm text-gray-700">Notifications</h3>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={async () => {
                                                    // Mark all as read
                                                    const updates: any = {};
                                                    notifications.forEach(n => {
                                                        if (!n.read) updates[`notifications/${dataOwnerId}/${n.id}/read`] = true;
                                                    });
                                                    if (Object.keys(updates).length) await update(ref(database), updates);
                                                }}
                                                className="text-xs text-blue-600 hover:underline"
                                            >
                                                Mark all read
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-4 text-center text-gray-400 text-sm">
                                                No notifications
                                            </div>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    className={`p-3 border-b hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${n.type === 'critical' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                            {n.type?.toUpperCase() || 'INFO'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">
                                                            {new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-800">{n.title}</p>
                                                    <p className="text-xs text-gray-600 mb-2">{n.message}</p>
                                                    {!n.read && (
                                                        <button
                                                            onClick={() => update(ref(database, `notifications/${dataOwnerId}/${n.id}`), { read: true })}
                                                            className="text-[10px] text-blue-500 hover:text-blue-700 font-medium"
                                                        >
                                                            Mark as read
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="text-right mr-2">
                            <p className="text-sm font-semibold">{user?.displayName || userProfile?.name}</p>
                            <span className="text-xs bg-white/30 px-2 py-0.5 rounded-full">
                                {userProfile?.role === 'receptionist' ? 'RECEPTION' :
                                    userProfile?.role === 'owner' ? 'CLINIC OWNER' :
                                        userProfile?.role?.toUpperCase() || 'LAB ADMIN'}
                            </span>
                        </div>
                        <button onClick={handleSignOut} className="bg-white/20 px-4 py-2 rounded-lg hover:bg-white/30"><i className="fas fa-sign-out-alt"></i> Logout</button>
                    </div>
                </div>
            </header>

            {/* Removed Doctor/Staff Mobile Bottom Navigation as requested */}

            <div className={`container-pc w-full mx-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-6`}>
                {!isClinical && !isPharmacy && (
                    <aside className={`w-full lg:w-52 h-full flex-shrink-0 flex flex-col gap-2 lg:sticky lg:top-24 lg:self-start lg:h-[calc(100vh-120px)] lg:overflow-y-auto pr-2`}>
                        <div className="space-y-4">
                            {Object.entries(groupedTabs).map(([groupName, groupItems]) => (
                                <div key={groupName} className="space-y-1">
                                    <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{groupName}</h3>
                                    {groupItems.map(tab => {
                                        const isTemplates = tab.id === 'templates';
                                        return (
                                            <div
                                                key={tab.id}
                                                onClick={(e) => {
                                                    if (isTemplates) {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (e.detail === 2) {
                                                            router.push(tab.path);
                                                        } else if (e.detail === 1) {
                                                            showToast('This is a secure tab. Double click to open.', 'info');
                                                        }
                                                        return;
                                                    }
                                                    router.push(tab.path);
                                                }}
                                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all cursor-pointer select-none ` + (activeTab === tab.id ? 'gradient-colorful text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 shadow-sm border border-transparent')}>
                                                <i className={`fas ` + tab.icon + ` w-5 text-center`}></i> 
                                                <span className="text-sm">{tab.label}</span>
                                                {isTemplates && <i className="fas fa-lock text-[8px] ml-auto opacity-40" title="Double Click to Open"></i>}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    {userProfile?.role !== 'lab' && (
                        <a href="https://wa.me/917619948657?text=Hi%2C%20I%20need%20help%20with%20Mediclo%20Lab" target="_blank" rel="noopener noreferrer" className="block mt-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 text-center hover:shadow-md transition-shadow cursor-pointer">
                            <i className="fas fa-headset text-2xl text-blue-300 mb-1"></i>
                            <h4 className="font-bold text-gray-800 text-sm">Need Help?</h4>
                            <p className="text-[10px] text-gray-500">Chat with Support</p>
                        </a>
                    )}
                    {userProfile?.role === 'lab' && (
                        <>
                            <AILabSuggestions dataOwnerId={dataOwnerId} />
                            <DashboardChat 
                                dataOwnerId={dataOwnerId} 
                                userRole={userProfile.role} 
                                userName={userProfile.name || 'Laboratory'} 
                                channel="lab"
                            />
                        </>
                    )}
                </aside>
                )}
                <main className={`flex-1 w-full min-h-[500px] ${isPharmacy ? 'max-w-full' : ''}`}>
                    {children}
                </main>
            </div>
            
            {(userProfile?.role === 'owner' || userProfile?.role === 'receptionist' || userProfile?.role === 'admin') && (
                <DashboardChat 
                    dataOwnerId={dataOwnerId} 
                    userRole="owner" 
                    userName={(userProfile.name === 'Lab Admin' || !userProfile.name) ? 'Reception' : userProfile.name} 
                />
            )}

            {isClinical && (
                <DashboardChat 
                    dataOwnerId={dataOwnerId} 
                    userRole={userProfile?.role || 'doctor'} 
                    userName={userProfile?.name || 'Doctor'} 
                    channel="doctor"
                />
            )}

            {isPharmacy && (
                <DashboardChat 
                    dataOwnerId={dataOwnerId} 
                    userRole={userProfile?.role || 'pharmacy'} 
                    userName={userProfile?.name || 'Pharmacy'} 
                    channel="pharmacy"
                />
            )}
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
