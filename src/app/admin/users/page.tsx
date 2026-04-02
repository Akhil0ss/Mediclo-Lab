'use client';

import { useEffect, useState } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue, get, update } from 'firebase/database';
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
    const [roleLimits, setRoleLimits] = useState<Record<string, any>>({});
    const [selectedUserForLimits, setSelectedUserForLimits] = useState<any>(null);
    const [limitForm, setLimitForm] = useState({ lab: 1, pharmacy: 1, receptionist: 1, doctor: 1 });

    useEffect(() => {
        // Fix 5: Use get() for subscriptions (one-time read) to avoid nested listener memory leak
        const unsubUsers = onValue(ref(database, 'users'), async (snapUsers) => {
            const usersData = snapUsers.val();

            try {
                // One-time read for subscriptions — no leak
                const snapSubs = await get(ref(database, 'subscriptions'));
                const subsData = snapSubs.val() || {};

                // Fetch Staff Limits
                const snapLimits = await get(ref(database, 'staff_limits'));
                setRoleLimits(snapLimits.val() || {});

                if (usersData) {
                    const now = new Date();
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
                            subscription: { status, daysLeft, isExpiring, plan: sub?.plan || 'Free' }
                        };
                    });

                    const s = {
                        total: list.length,
                        premium: list.filter(u => u.subscription.status === 'Premium').length,
                        free: list.filter(u => u.subscription.status !== 'Premium').length,
                        expiring: list.filter(u => u.subscription.isExpiring).length
                    };
                    setStats(s);
                    const validUsers = list.filter(u => u.name || u.email);
                    setUsers(validUsers);
                    setFilteredUsers(validUsers);
                } else {
                    setUsers([]);
                }
            } catch (error: any) {
                console.error('Data load error:', error.message);
            }
            setLoading(false);
        }, (error) => {
            console.error('Users read error:', error.message);
            setLoading(false);
        });

        // Fix 5: Single cleanup — no nested listener orphans
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

    const handleUpdateLimits = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserForLimits) return;
        try {
            await update(ref(database, `staff_limits/${selectedUserForLimits.uid}`), limitForm);
            setRoleLimits(prev => ({ ...prev, [selectedUserForLimits.uid]: limitForm }));
            setSelectedUserForLimits(null);
            alert('Staff limits updated successfully!');
        } catch (e) {
            alert('Error updating limits: ' + e);
        }
    };

    if (loading) return <div className="p-12 text-center text-gray-500 font-mono">Loading God Mode Data...</div>;

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Header Stand */}
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
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
            <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold text-[11px] uppercase sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3">User Identity</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Subscription</th>
                                <th className="px-4 py-3 text-right">God Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map((u) => (
                                <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-gray-900 text-sm truncate max-w-[200px]">{u.name || 'Unknown'}</div>
                                        <div className="text-[11px] text-gray-500">{u.email}</div>
                                        <div className="text-[10px] font-mono text-gray-400 mt-0.5" title={u.uid}>{u.uid.substring(0, 8)}...</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => handleChangeRole(u.uid, u.role)}
                                            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition"
                                            title="Click to Edit Role"
                                        >
                                            {u.role || 'User'} <i className="fas fa-pen ml-1 text-[9px] opacity-50"></i>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        {u.subscription.status === 'Premium' ? (
                                            <div>
                                                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                                                    <i className="fas fa-crown text-[9px]"></i> Premium
                                                </span>
                                                <div className={`text-[11px] mt-1 font-medium ${u.subscription.isExpiring ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
                                                    {u.subscription.daysLeft} days left
                                                </div>
                                            </div>
                                        ) : (
                                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold">Free Plan</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {u.subscription.status !== 'Premium' ? (
                                                <button
                                                    onClick={() => handleGrantPremium(u.uid, u.name)}
                                                    className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded shadow-sm text-[11px] font-bold transition flex items-center gap-1"
                                                    title="Grant Premium"
                                                >
                                                    <i className="fas fa-gift"></i> Grant
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleRevokePremium(u.uid, u.name)}
                                                    className="bg-white border border-red-200 text-red-600 px-2 py-1 rounded hover:bg-red-50 text-[11px] font-bold transition flex items-center gap-1"
                                                    title="Revoke Premium"
                                                >
                                                    <i className="fas fa-ban"></i> Revoke
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    const currentLimits = roleLimits[u.uid] || { lab: 1, pharmacy: 1, receptionist: 1, doctor: 1 };
                                                    setSelectedUserForLimits(u);
                                                    setLimitForm(currentLimits);
                                                }}
                                                className="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded hover:bg-blue-100 text-[11px] font-bold transition flex items-center gap-1"
                                                title="Manage Staff Limits"
                                            >
                                                <i className="fas fa-shield-halved"></i> Limits
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-12 text-center text-gray-500 text-sm">
                                        No users found matching filter '{filter}'.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Limits Modal */}
            {selectedUserForLimits && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="bg-blue-600 px-6 py-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">Staff Capacity: {selectedUserForLimits.name}</h3>
                            <button onClick={() => setSelectedUserForLimits(null)} className="text-white/80 hover:text-white">
                                <i className="fas fa-times text-xl"></i>
                            </button>
                        </div>
                        <form onSubmit={handleUpdateLimits} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lab Staff</label>
                                    <input type="number" min={1} value={limitForm.lab} onChange={e => setLimitForm({...limitForm, lab: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pharmacy</label>
                                    <input type="number" min={1} value={limitForm.pharmacy} onChange={e => setLimitForm({...limitForm, pharmacy: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Receptionist</label>
                                    <input type="number" min={1} value={limitForm.receptionist} onChange={e => setLimitForm({...limitForm, receptionist: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Doctors</label>
                                    <input type="number" min={1} value={limitForm.doctor} onChange={e => setLimitForm({...limitForm, doctor: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-2">
                                <button type="button" onClick={() => setSelectedUserForLimits(null)} className="flex-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold">Cancel</button>
                                <button type="submit" className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 transition-all active:scale-95">Update Quota</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
