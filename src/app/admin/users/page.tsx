'use client';

import { useEffect, useState } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminUsers() {
    const { user } = useAuth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [stats, setStats] = useState({ total: 0, premium: 0, free: 0, expiring: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [users, setUsers] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'premium' | 'free' | 'expiring'>('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        // Fetch Users and Subscriptions
        const usersRef = ref(database, 'users');
        const subsRef = ref(database, 'subscriptions');

        // Listen to both
        const unsubUsers = onValue(usersRef, (snapUsers) => {
            const usersData = snapUsers.val();

            onValue(subsRef, (snapSubs) => {
                const subsData = snapSubs.val() || {};

                if (usersData) {
                    const now = new Date();
                    const sevenDays = 7 * 24 * 60 * 60 * 1000;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const list = Object.entries(usersData).map(([uid, val]: [string, any]) => {
                        const sub = subsData[uid];
                        let status = 'Free';
                        let daysLeft = 0;
                        let isExpiring = false;

                        if (sub && sub.isPremium) {
                            const expiry = new Date(sub.expiryDate);
                            if (expiry > now) {
                                status = 'Premium';
                                daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                if (daysLeft <= 7) isExpiring = true;
                            } else {
                                status = 'Expired';
                            }
                        }

                        return {
                            uid,
                            ...val.profile,
                            subscription: {
                                status,
                                daysLeft,
                                isExpiring,
                                plan: sub?.plan || 'Free'
                            }
                        };
                    });

                    // Stats
                    const s = {
                        total: list.length,
                        premium: list.filter(u => u.subscription.status === 'Premium').length,
                        free: list.filter(u => u.subscription.status !== 'Premium').length,
                        expiring: list.filter(u => u.subscription.isExpiring).length
                    };
                    setStats(s);

                    // Filter valid profiles
                    const validUsers = list.filter(u => u.name || u.email);
                    setUsers(validUsers);
                    setFilteredUsers(validUsers);
                } else {
                    setUsers([]);
                }
                setLoading(false);
            });
        });

        // Simple cleanup (Note: nested listeners usually need managing, simplified here)
        return () => unsubUsers();
    }, []);

    useEffect(() => {
        let res = users;

        // Filter Type
        if (filter === 'premium') res = res.filter(u => u.subscription.status === 'Premium');
        if (filter === 'free') res = res.filter(u => u.subscription.status !== 'Premium');
        if (filter === 'expiring') res = res.filter(u => u.subscription.isExpiring);

        // Search
        if (search) {
            const low = search.toLowerCase();
            res = res.filter(u =>
                (u.name && u.name.toLowerCase().includes(low)) ||
                (u.email && u.email.toLowerCase().includes(low)) ||
                (u.uid && u.uid.toLowerCase().includes(low))
            );
        }

        setFilteredUsers(res);
    }, [filter, search, users]);

    // Actions
    const handleGrantPremium = async (uid: string, name: string) => {
        if (!confirm(`Grant 1 Year Premium to ${name}?`)) return;
        try {
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            await update(ref(database, `subscriptions/${uid}`), {
                isPremium: true,
                status: 'Premium',
                plan: 'God Mode Grant',
                startDate: new Date().toISOString(),
                expiryDate: expiryDate.toISOString(),
                grantedBy: user?.email
            });
            alert('Premium Granted Successfully');
        } catch (e) {
            alert('Error: ' + e);
        }
    };

    const handleRevokePremium = async (uid: string, name: string) => {
        if (!confirm(`Revoke Premium from ${name}?`)) return;
        try {
            await update(ref(database, `subscriptions/${uid}`), {
                isPremium: false,
                status: 'Free',
                revokedAt: new Date().toISOString(),
                revokedBy: user?.email
            });
            alert('Premium Revoked');
        } catch (e) {
            alert('Error: ' + e);
        }
    };

    const handleChangeRole = async (uid: string, currentRole: string) => {
        const newRole = prompt('Enter new role (admin, lab, pharmacy, doctor, receptionist):', currentRole);
        if (!newRole || newRole === currentRole) return;

        try {
            await update(ref(database, `users/${uid}/profile`), { role: newRole });
            alert(`Role updated to ${newRole}`);
        } catch (e) {
            alert('Error updating role: ' + e);
        }
    };

    if (loading) return <div className="p-12 text-center text-gray-500 font-mono">Loading God Mode Data...</div>;

    return (
        <div>
            {/* Header Stand */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                        <i className="fas fa-users-cog text-purple-600"></i> User Control Center
                    </h2>
                    <p className="text-gray-500">Manage users, roles, and subscriptions with absolute control.</p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <button onClick={() => setFilter('all')} className={`p-4 rounded-xl text-left transition ${filter === 'all' ? 'bg-gray-800 text-white shadow-lg' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}>
                    <div className="text-xs font-bold uppercase opacity-70">Total Users</div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                </button>
                <button onClick={() => setFilter('premium')} className={`p-4 rounded-xl text-left transition ${filter === 'premium' ? 'bg-yellow-500 text-white shadow-lg' : 'bg-white border border-gray-200 hover:bg-yellow-50'}`}>
                    <div className="text-xs font-bold uppercase opacity-70">Premium</div>
                    <div className="text-2xl font-bold">{stats.premium}</div>
                </button>
                <button onClick={() => setFilter('free')} className={`p-4 rounded-xl text-left transition ${filter === 'free' ? 'bg-blue-500 text-white shadow-lg' : 'bg-white border border-gray-200 hover:bg-blue-50'}`}>
                    <div className="text-xs font-bold uppercase opacity-70">Free</div>
                    <div className="text-2xl font-bold">{stats.free}</div>
                </button>
                <button onClick={() => setFilter('expiring')} className={`p-4 rounded-xl text-left transition ${filter === 'expiring' ? 'bg-red-500 text-white shadow-lg' : 'bg-white border border-gray-200 hover:bg-red-50'}`}>
                    <div className="text-xs font-bold uppercase opacity-70">Expiring (7d)</div>
                    <div className="text-2xl font-bold">{stats.expiring}</div>
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold text-xs uppercase">
                            <tr>
                                <th className="px-6 py-4">User Identity</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Subscription</th>
                                <th className="px-6 py-4 text-right">God Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map((u) => (
                                <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900">{u.name || 'Unknown'}</div>
                                        <div className="text-xs text-gray-500">{u.email}</div>
                                        <div className="text-[10px] font-mono text-gray-400 mt-1">{u.uid}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleChangeRole(u.uid, u.role)}
                                            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition"
                                            title="Click to Edit Role"
                                        >
                                            {u.role || 'User'} <i className="fas fa-pen ml-1 text-[10px] opacity-50"></i>
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        {u.subscription.status === 'Premium' ? (
                                            <div>
                                                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit">
                                                    <i className="fas fa-crown text-[10px]"></i> Premium
                                                </span>
                                                <div className={`text-xs mt-1 font-medium ${u.subscription.isExpiring ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
                                                    {u.subscription.daysLeft} days left
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">Free Plan</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {u.subscription.status !== 'Premium' ? (
                                                <button
                                                    onClick={() => handleGrantPremium(u.uid, u.name)}
                                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
                                                    title="Grant Premium"
                                                >
                                                    <i className="fas fa-gift"></i> Grant
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleRevokePremium(u.uid, u.name)}
                                                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                                    title="Revoke Premium"
                                                >
                                                    <i className="fas fa-ban"></i> Revoke
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        No users found matching filter '{filter}'.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
