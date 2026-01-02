'use client';

import { useEffect, useState } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalRevenue: 0,
        premiumUsers: 0,
        pendingPayments: 0,
        todayRevenue: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStats = () => {
            // 1. Users
            const usersRef = ref(database, 'users');
            onValue(usersRef, (snap) => {
                const count = snap.size;
                setStats(prev => ({ ...prev, totalUsers: count }));
            });

            // 2. Payments
            const paymentsRef = ref(database, 'payment_requests');
            onValue(paymentsRef, (snap) => {
                const data = snap.val();
                let revenue = 0;
                let todayRev = 0;
                let pending = 0;
                const todayStr = new Date().toDateString();

                if (data) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    Object.values(data).forEach((userVal: any) => {
                        // UserVal is the request object itself now (since we use set)
                        // OR UserVal is { REQUEST_ID: ... } (if push was used historically)
                        // We support both structures by checking properties.

                        // Helper to process a single request
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const processReq = (r: any) => {
                            if (r.status === 'approved') {
                                revenue += Number(r.amount || 0);
                                if (new Date(r.approvedAt || r.createdAt).toDateString() === todayStr) {
                                    todayRev += Number(r.amount || 0);
                                }
                            }
                            if (r.status === 'pending') {
                                pending++;
                            }
                        };

                        if (userVal.amount && userVal.status) {
                            // Direct object (set)
                            processReq(userVal);
                        } else {
                            // Nested list (push)
                            Object.values(userVal).forEach((r: any) => processReq(r));
                        }
                    });
                }
                setStats(prev => ({ ...prev, totalRevenue: revenue, todayRevenue: todayRev, pendingPayments: pending }));
            });

            // 3. Subscriptions
            const subsRef = ref(database, 'subscriptions');
            onValue(subsRef, (snap) => {
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
            });
        };

        loadStats();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Analytics...</div>;

    const cards = [
        { label: 'Total Users', value: stats.totalUsers, icon: 'fa-users', color: 'bg-blue-500' },
        { label: 'Premium Subscribers', value: stats.premiumUsers, icon: 'fa-crown', color: 'bg-yellow-500' },
        { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: 'fa-rupee-sign', color: 'bg-green-500' },
        { label: 'Today\'s Revenue', value: `₹${stats.todayRevenue.toLocaleString()}`, icon: 'fa-chart-line', color: 'bg-emerald-500' },
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
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl ${card.color} shadow-lg shadow-${card.color.replace('bg-', '')}/30`}>
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
                            <span className="text-purple-600 font-bold">wdbyakt@gmail.com</span>
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
