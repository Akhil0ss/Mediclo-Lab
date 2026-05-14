'use client';

import { useEffect, useState } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalRevenue: 0,
        premiumUsers: 0,
        pendingPayments: 0,
        todayRevenue: 0
    });
    const [loading, setLoading] = useState(true);

    // AUTH-04: Route guard — redirect non-admins
    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }
        // Only allow admin email
        if (user.email !== 'wdbyakt@gmail.com') {
            router.push('/dashboard');
            return;
        }
    }, [user, router]);

    useEffect(() => {
        if (!user || user.email !== 'wdbyakt@gmail.com') return;

        // 1. Users
        const unsubUsers = onValue(ref(database, 'users'), (snap) => {
            const data = snap.val();
            setStats(prev => ({ ...prev, totalUsers: data ? Object.keys(data).length : 0 }));
        }, (error) => {
            console.error('Users read error:', error.message);
        });

        // 2. Payments
        const unsubPayments = onValue(ref(database, 'payment_requests'), (snap) => {
            const data = snap.val();
            let revenue = 0, todayRev = 0, pending = 0;
            const todayStr = new Date().toDateString();
            if (data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                Object.values(data).forEach((userVal: any) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const processReq = (r: any) => {
                        if (r.status === 'approved') {
                            revenue += Number(r.amount || 0);
                            if (new Date(r.approvedAt || r.createdAt).toDateString() === todayStr)
                                todayRev += Number(r.amount || 0);
                        }
                        if (r.status === 'pending') pending++;
                    };
                    if (userVal.amount && userVal.status) processReq(userVal);
                    else if (userVal && typeof userVal === 'object')
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        Object.values(userVal).forEach((r: any) => processReq(r));
                });
            }
            setStats(prev => ({ ...prev, totalRevenue: revenue, todayRevenue: todayRev, pendingPayments: pending }));
        }, (error) => {
            console.error('Payments read error:', error.message);
        });

        // 3. Subscriptions
        const unsubSubs = onValue(ref(database, 'subscriptions'), (snap) => {
            let premiumCount = 0;
            const data = snap.val();
            if (data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                Object.values(data).forEach((sub: any) => {
                    if (sub.status === 'Premium' || sub.isPremium === true) premiumCount++;
                });
            }
            setStats(prev => ({ ...prev, premiumUsers: premiumCount }));
            setLoading(false);
        }, (error) => {
            console.error('Subscriptions read error:', error.message);
            setLoading(false);
        });

        // Fix 5: Cleanup all listeners on unmount
        return () => {
            unsubUsers();
            unsubPayments();
            unsubSubs();
        };
    }, [user]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Analytics...</div>;

    // Block render for non-admins
    if (!user || user.email !== 'wdbyakt@gmail.com') {
        return <div className="p-8 text-center text-gray-500">Access Denied</div>;
    }

    const cards = [
        { label: 'Total Users', value: stats.totalUsers, icon: 'fa-users', color: 'bg-blue-500' },
        { label: 'Premium Subscribers', value: stats.premiumUsers, icon: 'fa-crown', color: 'bg-yellow-500' },
        { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: 'fa-rupee-sign', color: 'bg-green-500' },
        { label: "Today's Revenue", value: `₹${stats.todayRevenue.toLocaleString()}`, icon: 'fa-chart-line', color: 'bg-emerald-500' },
    ];

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {cards.map((card, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between transition hover:-translate-y-1 hover:shadow-md">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">{card.label}</p>
                            <h3 className="text-2xl font-bold text-gray-800">{card.value}</h3>
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl ${card.color} shadow-lg`}>
                            <i className={`fas ${card.icon}`}></i>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pending Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <i className="fas fa-bell text-orange-500"></i> Pending Actions
                    </h3>
                    {stats.pendingPayments > 0 ? (
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-200 text-orange-700 w-8 h-8 rounded-full flex items-center justify-center font-bold">
                                    {stats.pendingPayments}
                                </div>
                                <span className="text-orange-800 font-medium">Pending Subscription Requests</span>
                            </div>
                            <a href="/admin/payments" className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-700">
                                Verify Now
                            </a>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-xl">All caught up! No pending actions.</p>
                    )}
                </div>

                {/* Quick Links / Info */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold mb-4">System Status</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-600">Database Status</span>
                            <span className="text-green-600 font-bold flex items-center gap-1"><i className="fas fa-circle text-[10px]"></i> Online</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-600">Secure Admin</span>
                            <span className="text-purple-600 font-bold">Authenticated</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-600">Pending Payments</span>
                            <span className="text-gray-800 font-bold">{stats.pendingPayments}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
