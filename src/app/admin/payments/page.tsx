'use client';

import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function AdminPayments() {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
            return;
        }

        if (user) {
            const paymentsRef = ref(database, 'payment_requests');
            const unsub = onValue(paymentsRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const allRequests: any[] = [];
                    // Data structure is now: { USER_ID: { ...requestData } }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    Object.entries(data).forEach(([userId, userVal]: [string, any]) => {
                        // If flat structure: { USER_ID: { amount, status } }
                        if (userVal.amount && userVal.status) {
                            allRequests.push({
                                id: 'latest',
                                userId,
                                ...userVal
                            });
                        } 
                        // If nested structure: { USER_ID: { REQUEST_ID: { amount, status } } }
                        else if (userVal && typeof userVal === 'object') {
                            Object.entries(userVal).forEach(([reqId, reqData]: [string, any]) => {
                                if (reqData.amount && reqData.status) {
                                    allRequests.push({
                                        id: reqId,
                                        userId,
                                        ...reqData
                                    });
                                }
                            });
                        }
                    });

                    // Sort by date desc
                    allRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    setRequests(allRequests);
                    setError(''); // Clear error if successful
                } else {
                    setRequests([]);
                }
                setIsLoadingData(false);
            }, (err) => {
                console.error(err);
                // Check if profile role is admin, but maybe rules are cached or failed
                if ((userProfile?.role as string) === 'admin') {
                    // Should have worked if rules are correct
                    setError('Database Access Error. Please check rules.');
                } else {
                    setError('Access Denied. You are not an authorized admin.');
                }
                setIsLoadingData(false);
            });
            return () => unsub();
        }
    }, [user, loading, router, userProfile]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleApprove = async (req: any) => {
        if (!confirm(`Approve payment for ${req.userName}?`)) return;

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updates: any = {};

            const pathPrefix = req.id === 'latest' 
                ? `payment_requests/${req.userId}` 
                : `payment_requests/${req.userId}/${req.id}`;

            // 1. Update Request Status
            updates[`${pathPrefix}/status`] = 'approved';
            updates[`${pathPrefix}/approvedAt`] = new Date().toISOString();
            updates[`${pathPrefix}/approvedBy`] = user?.uid;

            // 2. Update User Subscription
            // CRITICAL: Must set 'isPremium' to true as per SubscriptionContext
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 Year

            updates[`subscriptions/${req.userId}`] = {
                isPremium: true, // Verification Field
                plan: 'Premium Annual',
                status: 'Premium',
                startDate: new Date().toISOString(),
                expiryDate: expiryDate.toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await update(ref(database), updates);
            alert('Payment Approved & Subscription Activated');
        } catch (e) {
            console.error(e);
            alert('Error approving payment');
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleReject = async (req: any) => {
        if (!confirm(`Reject payment for ${req.userName}?`)) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updates: any = {};
            
            const pathPrefix = req.id === 'latest' 
                ? `payment_requests/${req.userId}` 
                : `payment_requests/${req.userId}/${req.id}`;

            updates[`${pathPrefix}/status`] = 'rejected';
            updates[`${pathPrefix}/rejectedAt`] = new Date().toISOString();
            updates[`${pathPrefix}/rejectedBy`] = user?.uid;

            await update(ref(database), updates);
        } catch (e) {
            console.error(e);
            alert('Error rejecting payment');
        }
    };

    if (loading || isLoadingData) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading Admin Panel...</div>;

    if (error) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
                <div className="text-red-500 text-5xl mb-4"><i className="fas fa-lock"></i></div>
                <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                <p className="text-gray-600 mb-6">{error}</p>
                <div className="bg-gray-100 p-4 rounded text-xs font-mono text-left mb-4">
                    <strong>Instructions:</strong><br />
                    1. Ensure your User Profile has <code>role: 'admin'</code>.<br />
                    2. OR Add your UID to <code>admins</code> node in Firebase.
                </div>

                {user?.email === 'wdbyakt@gmail.com' && (
                    <div className="mb-6 animate-pulse">
                        <button
                            onClick={async () => {
                                try {
                                    await update(ref(database, 'admins'), { [user.uid]: true });
                                    alert('Admin access granted securely. Reloading...');
                                    window.location.reload();
                                } catch (e) {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    alert('Error: ' + (e as any).message);
                                }
                            }}
                            className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 transition transform hover:scale-105 flex items-center justify-center gap-2 w-full"
                        >
                            <i className="fas fa-shield-alt"></i> Initialize Admin Access
                        </button>
                        <p className="text-xs text-purple-600 mt-2 font-semibold">Secure identification confirmed for {user.email}</p>
                    </div>
                )}

                <button onClick={() => router.push('/dashboard')} className="text-blue-600 font-bold hover:underline">Return to Dashboard</button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex flex-shrink-0 items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
                        <span className="text-purple-600 mr-2"><i className="fas fa-shield-alt"></i></span>
                        Admin Verification
                    </h1>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0">
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase font-bold text-gray-500 tracking-wider sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Plan / Amount</th>
                                    <th className="px-4 py-3">UTR Number</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {requests.map(req => (
                                    <tr key={req.userId} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            <div className="font-bold text-gray-800">{new Date(req.createdAt).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-gray-500">{new Date(req.createdAt).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-800 text-sm truncate max-w-[150px]">{req.userName}</div>
                                            <div className="text-[10px] text-gray-400 font-mono" title={req.userId}>{req.userId.substring(0, 8)}...</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-purple-700 text-sm">{req.plan}</div>
                                            <div className="text-xs font-bold">₹{req.amount}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-mono text-xs font-bold bg-gray-100 px-2 py-1 rounded inline-block text-gray-700 select-all border border-gray-200">
                                                {req.utr}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide
                                                ${req.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                    req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'}`}
                                            >
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {req.status === 'pending' && (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleApprove(req)} className="bg-green-600 text-white px-2 py-1 rounded shadow-sm hover:bg-green-700 text-[11px] font-bold transition flex items-center gap-1">
                                                        <i className="fas fa-check"></i> Approve
                                                    </button>
                                                    <button onClick={() => handleReject(req)} className="bg-white border border-red-200 text-red-600 px-2 py-1 rounded hover:bg-red-50 text-[11px] font-bold transition flex items-center gap-1">
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {requests.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">No payment requests found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
        </div>
    );
}
