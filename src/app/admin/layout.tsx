'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Secure Admin Email
const ADMIN_EMAIL = 'wdbyakt@gmail.com';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        if (!loading) {
            // Strict Email Check for Security
            if (!user) {
                // Not logged in - redirect to login
                router.push('/');
            } else if (user.email !== ADMIN_EMAIL) {
                // Logged in but not admin - redirect to dashboard
                router.push('/dashboard');
            } else {
                // Admin user - allow access
                setIsAuthorized(true);
            }
        }
    }, [user, loading, router]);

    if (loading || !isAuthorized) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <h2 className="text-xl font-mono">Verifying Admin Credentials...</h2>
            </div>
        );
    }

    const navItems = [
        { name: 'Dashboard', href: '/admin', icon: 'fa-chart-line' },
        { name: 'Payments & Verification', href: '/admin/payments', icon: 'fa-credit-card' },
        { name: 'User Management', href: '/admin/users', icon: 'fa-users' },
        { name: 'Backup & Restore', href: '/admin/backup', icon: 'fa-database' },
        // { name: 'System Settings', href: '/admin/settings', icon: 'fa-cogs' },
    ];

    return (
        <div className="min-h-screen bg-gray-100 flex font-sans">
            {/* Sidebar */}
            <aside className="w-72 bg-gray-900 text-white flex-shrink-0 flex flex-col shadow-2xl z-20">
                <div className="p-8 border-b border-gray-800">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-purple-600 p-2 rounded-lg">
                            <i className="fas fa-shield-alt text-xl"></i>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Admin<span className="text-purple-400">Console</span></h1>
                    </div>
                    <p className="text-xs text-gray-500 font-mono break-all">{user?.email}</p>
                </div>

                <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50 translate-x-1'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                            >
                                <i className={`fas ${item.icon} w-6 text-center`}></i>
                                <span className="font-medium">{item.name}</span>
                                {isActive && <i className="fas fa-chevron-right ml-auto text-xs opacity-50"></i>}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-colors"
                    >
                        <i className="fas fa-sign-out-alt w-6 text-center"></i>
                        <span className="font-medium">Exit Console</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Top Bar */}
                <header className="bg-white border-b border-gray-200 py-4 px-8 flex justify-between items-center shadow-sm z-10">
                    <h2 className="text-xl font-bold text-gray-800">
                        {navItems.find(i => i.href === pathname)?.name || 'Admin'}
                    </h2>
                    <div className="flex items-center gap-4">
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            System Secure
                        </span>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>

            {/* FontAwesome */}
            <link
                rel="stylesheet"
                href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
            />
        </div>
    );
}
