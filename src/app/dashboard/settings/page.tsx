'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, onValue, set, update, push } from 'firebase/database';
import { database } from '@/lib/firebase';
import { createBackup, uploadBackup, listBackups, getBackupStats } from '@/lib/backupManager';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function SettingsPage() {
    const { user, userProfile } = useAuth();
    const { isPremium, daysRemaining, expiryDate } = useSubscription();
    const { currentTheme, setTheme, availableThemes } = useTheme();

    // Block only Lab, Doctor, Pharmacy staff (username login with those roles)
    const authMethod = typeof window !== 'undefined' ? localStorage.getItem('authMethod') : null;
    const isStaffUser = authMethod === 'username';
    const isRestrictedRole = userProfile?.role && userProfile.role !== 'receptionist';

    if (isStaffUser && isRestrictedRole) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md w-full text-center">
                    <div className="mb-6"><i className="fas fa-lock text-6xl text-red-500"></i></div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-4">Access Denied</h2>
                    <p className="text-gray-600 mb-2">Settings are only accessible to Owner/Receptionist.</p>
                    <a href="/dashboard" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition mt-4">Back to Dashboard</a>
                </div>
            </div>
        );
    }

    const [formData, setFormData] = useState({
        labName: '',
        tagline: '',
        address: '',
        contact: '',
        email: '',
        website: '',
        director: '',
        footerNotes: '',
        googleClientId: ''
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [staffUsers, setStaffUsers] = useState<any[]>([]);
    const [showResetModal, setShowResetModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [newPassword, setNewPassword] = useState('');
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState({ id: '', name: '', username: '' });

    // Payment States
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentStep, setPaymentStep] = useState(1);
    const [utrNumber, setUtrNumber] = useState('');
    const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;
        const paymentRef = ref(database, `payment_requests/${user.uid}`);
        const unsub = onValue(paymentRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.entries(data).map(([k, v]) => ({ id: k, ...(v as any) }));
                setPaymentHistory(list.reverse());
            }
        });
        return () => unsub();
    }, [user]);

    // UI State
    const [settingsTab, setSettingsTab] = useState<'branding' | 'team' | 'billing' | 'backup' | 'theme'>('branding');
    const [isEditing, setIsEditing] = useState(false);

    // Backup State
    const [backupLoading, setBackupLoading] = useState(false);
    const [backupHistory, setBackupHistory] = useState<any[]>([]);
    const [backupStats, setBackupStats] = useState<any>(null);
    const [showDriveConfigModal, setShowDriveConfigModal] = useState(false);

    useEffect(() => {
        if (!user) return;
        const brandingRef = ref(database, `branding/${user.uid}`);
        const unsubBranding = onValue(brandingRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setFormData({
                    labName: data.labName || '',
                    tagline: data.tagline || '',
                    address: data.address || '',
                    contact: data.contact || '',
                    email: data.email || '',
                    website: data.website || '',
                    director: data.director || '',
                    footerNotes: data.footerNotes || '',
                    googleClientId: data.googleClientId || ''
                });
                if (data.logoUrl) setLogoPreview(data.logoUrl);
            }
        });

        const usersRef = ref(database, `users/${user.uid}/auth`);
        const unsubUsers = onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const users = [];

                // Add receptionist
                if (data.receptionist && data.receptionist.username && data.receptionist.isActive !== false) {
                    users.push({
                        ...data.receptionist,
                        id: 'receptionist',
                        role: data.receptionist.role || 'receptionist'
                    });
                }

                // Add lab
                if (data.lab && data.lab.username && data.lab.isActive !== false) {
                    users.push({
                        ...data.lab,
                        id: 'lab',
                        role: data.lab.role || 'lab'
                    });
                }

                // Add pharmacy
                if (data.pharmacy && data.pharmacy.username && data.pharmacy.isActive !== false) {
                    users.push({
                        ...data.pharmacy,
                        id: 'pharmacy',
                        role: data.pharmacy.role || 'pharmacy'
                    });
                }

                // Add doctors (with proper filtering)
                if (data.doctors) {
                    Object.entries(data.doctors).forEach(([doctorId, doc]: [string, any]) => {
                        // Only add if it has required fields AND is active
                        if (doc && doc.username && doc.name && doc.isActive !== false) {
                            users.push({
                                ...doc,
                                id: doctorId,
                                role: doc.role || 'doctor'
                            });
                        }
                    });
                }

                setStaffUsers(users);
            } else {
                setStaffUsers([]);
            }
        });

        return () => { unsubBranding(); unsubUsers(); };
    }, [user]);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        if (!isPremium) {
            alert('Branding is a Premium feature. Please upgrade.');
            return;
        }
        if (!confirm('Apply branding changes?')) return;
        try {
            const brandingData = { ...formData, logoUrl: logoPreview, updatedAt: new Date().toISOString() };
            // Save to branding node (for Reports)
            await set(ref(database, `branding/${user.uid}`), brandingData);

            // Also update User Profile (for Sidebar/Header app-wide usage)
            if (formData.labName) {
                await update(ref(database, `users/${user.uid}/profile`), { labName: formData.labName });
            }

            alert('Branding Apply Successfully!');
            setIsEditing(false);
        } catch (error) {
            console.error(error);
            alert('Failed to save settings');
        }
    };

    const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
        if (!user) return;
        if (!confirm('Are you sure you want to change this user status?')) return;
        try {
            await update(ref(database, `users/${user.uid}/auth/${userId}`), { isActive: !currentStatus });
            alert(`User ${!currentStatus ? 'enabled' : 'disabled'} successfully!`);
        } catch (error) {
            console.error(error);
            alert('Failed to update user status');
        }
    };

    const handleResetClick = (userData: any) => { setSelectedUser(userData); setShowResetModal(true); };
    const submitResetPassword = async () => {
        if (!newPassword || newPassword.length < 6) { alert('Password must be at least 6 characters'); return; }
        if (!user || !selectedUser) return;
        if (!confirm('Are you sure you want to reset the password?')) return;
        try {
            // Import hashPassword function
            const { hashPassword } = await import('@/lib/userUtils');

            let path = '';
            if (selectedUser.role === 'doctor') path = `users/${user.uid}/auth/doctors/${selectedUser.id}`;
            else path = `users/${user.uid}/auth/${selectedUser.role}`;

            // Hash the password before saving
            const hashedPassword = hashPassword(newPassword);
            await update(ref(database, path), { passwordHash: hashedPassword });

            alert('Password updated successfully!');
            setShowResetModal(false);
            setNewPassword('');
        } catch (error) {
            console.error(error);
            alert('Failed to reset password');
        }
    };

    const handleEditUserClick = (u: any) => { setEditingUser({ id: u.id, name: u.name, username: u.username }); setShowEditUserModal(true); };
    const submitUpdateUser = async () => {
        if (!user || !editingUser.id) return;
        if (!confirm('Are you sure you want to update this user?')) return;
        try {
            const fullUser = staffUsers.find(u => u.id === editingUser.id);
            if (!fullUser) return;

            let path = '';
            if (fullUser.role === 'doctor') path = `users/${user.uid}/auth/doctors/${fullUser.id}`;
            else path = `users/${user.uid}/auth/${fullUser.role}`;

            await update(ref(database, path), { name: editingUser.name });
            alert('User updated successfully');
            setShowEditUserModal(false);
        } catch (e) {
            console.error(e);
            alert('Update failed');
        }
    };

    const handleUpgrade = () => { setShowPaymentModal(true); setPaymentStep(1); };
    const submitPayment = async () => {
        if (!user || !utrNumber) { alert('Please enter UTR number'); return; }
        try {
            const reqRef = push(ref(database, `payment_requests/${user.uid}`));
            await set(reqRef, {
                utr: utrNumber,
                amount: 5999,
                plan: 'premium_annual',
                status: 'pending',
                createdAt: new Date().toISOString(),
                userName: user.displayName || 'User',
                userEmail: user.email
            });
            alert('Payment submitted for verification!');
            setShowPaymentModal(false);
            setUtrNumber('');
        } catch (e) {
            console.error(e);
            alert('Submission failed');
        }
    };

    return (
        <div className="max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
                    <p className="text-sm text-gray-500">Configure app branding & preferences</p>
                </div>
                {/* Tabs */}
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                    <button onClick={() => setSettingsTab('branding')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settingsTab === 'branding' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Branding
                    </button>
                    <button onClick={() => setSettingsTab('team')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settingsTab === 'team' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Team
                    </button>
                    <button onClick={() => setSettingsTab('billing')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settingsTab === 'billing' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Billing
                    </button>
                    <button onClick={() => setSettingsTab('backup')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settingsTab === 'backup' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Backup
                    </button>
                    <button onClick={() => setSettingsTab('theme')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settingsTab === 'theme' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <i className="fas fa-palette mr-1"></i> Theme
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[400px]">

                {/* BRANDING TAB */}
                {settingsTab === 'branding' && (
                    <div className="p-6 animate-in fade-in slide-in-from-bottom-2">
                        {/* Action Bar */}
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800">App Branding</h3>
                                <p className="text-xs text-gray-500">Changes here apply to Repors, Headers & Sidebar</p>
                            </div>
                            {!isEditing ? (
                                <button onClick={() => setIsEditing(true)} className="text-sm font-medium text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition border border-blue-100">
                                    <i className="fas fa-edit mr-2"></i>Edit Branding
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => setIsEditing(false)} className="text-sm text-gray-600 px-4 py-2 hover:bg-gray-100 rounded-lg">Cancel</button>
                                    <button onClick={handleSave} className="text-sm bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 shadow-sm">Save & Apply</button>
                                </div>
                            )}
                        </div>

                        {/* Aligned Form Layout */}
                        <div className="max-w-3xl mx-auto space-y-6">

                            {/* Identity Section */}
                            <div className="grid grid-cols-12 gap-6 items-start">
                                {/* Logo - Col 1-3 */}
                                <div className="col-span-12 md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">App Logo</label>
                                    <div className="w-full aspect-square rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden relative group transition-all hover:border-blue-300">
                                        {logoPreview ? (
                                            <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                                        ) : (
                                            <div className="text-center p-2">
                                                <i className="fas fa-image text-gray-300 text-3xl mb-1"></i>
                                                <p className="text-[10px] text-gray-400">Upload Logo</p>
                                            </div>
                                        )}
                                        <input type="file" disabled={!isEditing} onChange={handleLogoChange} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                                        {isEditing && <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] py-1 text-center">Change</div>}
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 text-center">Recommended: Square PNG</p>
                                </div>

                                {/* Main Inputs - Col 4-12 */}
                                <div className="col-span-12 md:col-span-9 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Lab Name (App Title)</label>
                                        <input type="text" disabled={!isEditing} value={formData.labName} onChange={e => setFormData({ ...formData, labName: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-600 outline-none transition" placeholder="e.g. City Diagnostic Center" />
                                        <p className="text-[11px] text-blue-500 mt-1"><i className="fas fa-info-circle mr-1"></i>Visible in Sidebar & Reports</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Tagline</label>
                                            <input type="text" disabled={!isEditing} value={formData.tagline} onChange={e => setFormData({ ...formData, tagline: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 outline-none" placeholder="e.g. Excellence in Care" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Director Name</label>
                                            <input type="text" disabled={!isEditing} value={formData.director} onChange={e => setFormData({ ...formData, director: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 outline-none" placeholder="Dr. Name" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Contact Section */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Contact Details (For Reports)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                                        <input type="text" disabled={!isEditing} value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 outline-none" placeholder="+91..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                                        <input type="text" disabled={!isEditing} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 outline-none" placeholder="lab@example.com" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Website URL</label>
                                        <input type="text" disabled={!isEditing} value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 outline-none" placeholder="https://..." />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Clinic Address</label>
                                        <textarea rows={2} disabled={!isEditing} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 outline-none resize-none" placeholder="Full address for report header" />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Config Section */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Report Configuration</h4>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Footer Note / Disclaimer</label>
                                    <textarea rows={2} disabled={!isEditing} value={formData.footerNotes} onChange={e => setFormData({ ...formData, footerNotes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 outline-none resize-none" placeholder="Text to appear at the bottom of every patient report (e.g. Legal Disclaimer, T&C)..." />
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {/* TEAM TAB (Kept Clean) */}
                {settingsTab === 'team' && (
                    <div className="p-0 animate-in fade-in slide-in-from-bottom-2">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-5 py-3 font-semibold text-gray-600">Name</th>
                                    <th className="px-5 py-3 font-semibold text-gray-600">Role</th>
                                    <th className="px-5 py-3 font-semibold text-gray-600">Username</th>
                                    <th className="px-5 py-3 font-semibold text-gray-600 text-center">Status</th>
                                    <th className="px-5 py-3 font-semibold text-gray-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {staffUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50">
                                        <td className="px-5 py-3 font-medium text-gray-800">{u.name}</td>
                                        <td className="px-5 py-3"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs uppercase">{u.role}</span></td>
                                        <td className="px-5 py-3 text-gray-500 font-mono text-xs">{u.username}</td>
                                        <td className="px-5 py-3 text-center">
                                            {u.isActive ? <span className="text-green-600 text-xs font-bold">● Active</span> : <span className="text-red-500 text-xs font-bold">● Disabled</span>}
                                        </td>
                                        <td className="px-5 py-3 text-right space-x-2">
                                            <button onClick={() => toggleUserStatus(u.id, u.isActive)} className="text-xs text-blue-600 hover:underline">{u.isActive ? 'Disable' : 'Enable'}</button>
                                            <button onClick={() => handleEditUserClick(u)} className="text-xs text-gray-600 hover:text-black"><i className="fas fa-edit"></i></button>
                                            <button onClick={() => handleResetClick(u)} className="text-xs text-gray-600 hover:text-black"><i className="fas fa-key"></i></button>
                                        </td>
                                    </tr>
                                ))}
                                {staffUsers.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No staff found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* BILLING TAB (Kept Clean) */}
                {settingsTab === 'billing' && (
                    <div className="p-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Status Card */}
                            <div className="flex-1 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                                <i className="fas fa-crown absolute top-4 right-4 text-white/20 text-6xl rotate-12"></i>
                                <div className="relative z-10">
                                    <h3 className="text-lg font-medium text-white/90">Current Plan</h3>
                                    <div className="text-3xl font-bold mt-1 mb-2">{isPremium ? 'Premium Plan' : 'Free Trial'}</div>
                                    <p className="text-sm text-white/80 mb-4">
                                        {isPremium ? `Valid until ${expiryDate ? new Date(expiryDate).toLocaleDateString() : 'N/A'}` : `${daysRemaining} days remaining in trial`}
                                    </p>
                                    {!isPremium && <button onClick={handleUpgrade} className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-gray-100 transition">Upgrade Now</button>}
                                </div>
                            </div>

                            {/* Benefits Grid */}
                            <div className="flex-[2] grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border rounded-lg p-4 bg-gray-50 flex items-center gap-3">
                                    <div className="bg-green-100 text-green-600 w-10 h-10 rounded-full flex items-center justify-center"><i className="fas fa-check"></i></div>
                                    <div><div className="font-bold text-sm">Unlimited Patients</div><div className="text-xs text-gray-500">No limits on storage</div></div>
                                </div>
                                <div className="border rounded-lg p-4 bg-gray-50 flex items-center gap-3">
                                    <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-full flex items-center justify-center"><i className="fas fa-paint-brush"></i></div>
                                    <div><div className="font-bold text-sm">Custom Branding</div><div className="text-xs text-gray-500">Your logo on reports</div></div>
                                </div>
                                <div className="border rounded-lg p-4 bg-gray-50 flex items-center gap-3">
                                    <div className="bg-purple-100 text-purple-600 w-10 h-10 rounded-full flex items-center justify-center"><i className="fas fa-headset"></i></div>
                                    <div><div className="font-bold text-sm">Priority Support</div><div className="text-xs text-gray-500">Direct tech access</div></div>
                                </div>
                                <div className="border rounded-lg p-4 bg-gray-50 flex items-center gap-3">
                                    <div className="bg-orange-100 text-orange-600 w-10 h-10 rounded-full flex items-center justify-center"><i className="fas fa-file-pdf"></i></div>
                                    <div><div className="font-bold text-sm">Smart Reports</div><div className="text-xs text-gray-500">Auto-calculated values</div></div>
                                </div>
                            </div>
                        </div>

                        {paymentHistory.some(p => p.status === 'pending') && (
                            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 text-sm text-yellow-800">
                                <i className="fas fa-info-circle"></i> Verification pending for UTR <strong>{paymentHistory.find(p => p.status === 'pending')?.utr}</strong>
                            </div>
                        )}
                    </div>
                )}

                {/* BACKUP TAB */}
                {settingsTab === 'backup' && (
                    <div className="p-4 animate-in fade-in slide-in-from-bottom-2">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Backup & Restore</h3>
                                <p className="text-xs text-gray-500">Manage your data security</p>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!user) return;
                                    setBackupLoading(true);
                                    try {
                                        const data = await createBackup(user.uid);
                                        if (data) {
                                            const url = await uploadBackup(user.uid, data, 'manual');
                                            if (url) {
                                                const h = await listBackups(user.uid);
                                                setBackupHistory(h);
                                                const s = await getBackupStats(user.uid);
                                                setBackupStats(s);
                                                alert('✅ Backup created successfully!');
                                            }
                                        }
                                    } catch (e) {
                                        alert('Failed to create backup');
                                    } finally {
                                        setBackupLoading(false);
                                    }
                                }}
                                disabled={backupLoading}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition disabled:opacity-70 flex items-center gap-2 text-xs font-bold uppercase tracking-wide"
                            >
                                {backupLoading ? (
                                    <><i className="fas fa-spinner fa-spin"></i> Creating...</>
                                ) : (
                                    <><i className="fas fa-cloud-upload-alt"></i> Create Backup</>
                                )}
                            </button>
                        </div>

                        {/* Stats Cards (Compact) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold text-blue-600 leading-none">{backupStats?.total || 0}</div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400 mt-1">Total Backups</div>
                                </div>
                                <i className="fas fa-database text-blue-100 text-2xl"></i>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold text-green-600 leading-none">{backupStats?.manual || 0}</div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400 mt-1">Manual</div>
                                </div>
                                <i className="fas fa-hand-pointer text-green-100 text-2xl"></i>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm col-span-2 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-bold text-purple-600">{backupStats?.newestDate ? new Date(backupStats.newestDate).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'None'}</div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400 mt-1">Last Backup</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Safe</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Local / Firebase History */}
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[320px]">
                                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                                    <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                        <i className="fas fa-server text-blue-500"></i> System Backups
                                    </h4>
                                    <button
                                        onClick={async () => {
                                            if (!user) return;
                                            setBackupLoading(true);
                                            const h = await listBackups(user.uid);
                                            setBackupHistory(h);
                                            const s = await getBackupStats(user.uid);
                                            setBackupStats(s);
                                            setBackupLoading(false);
                                        }}
                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase"
                                    >
                                        <i className="fas fa-sync-alt mr-1"></i> Refresh
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    {backupHistory.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-300">
                                            <i className="fas fa-inbox text-2xl mb-1"></i>
                                            <p className="text-xs">No history</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50/50 sticky top-0 text-gray-500 uppercase">
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-semibold">Date</th>
                                                    <th className="px-4 py-2 text-left font-semibold">Type</th>
                                                    <th className="px-4 py-2 text-right font-semibold">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {backupHistory.map((b, i) => (
                                                    <tr key={i} className="hover:bg-blue-50/30 transition">
                                                        <td className="px-4 py-2 text-gray-700 font-medium">
                                                            {new Date(b.createdAt).toLocaleDateString()} <span className="text-gray-400 text-[10px]">{new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold uppercase">
                                                                {b.name.includes('manual') ? 'Manual' : 'System'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-right">
                                                            <a href={b.url} download className="text-blue-600 hover:text-blue-800 font-bold hover:underline">
                                                                Down <i className="fas fa-arrow-down ml-0.5"></i>
                                                            </a>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>

                            {/* Google Drive Integration */}
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[320px]">
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 border-b border-green-100 flex justify-between items-center">
                                    <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                        <i className="fab fa-google-drive text-green-600"></i> Google Drive
                                    </h4>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${formData.googleClientId ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {formData.googleClientId ? 'Ready' : 'Pending'}
                                    </span>
                                </div>

                                <div className="p-4 flex flex-col items-center justify-center text-center flex-1">
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-3 text-green-600">
                                        <i className="fab fa-google-drive text-xl"></i>
                                    </div>

                                    {formData.googleClientId ? (
                                        <div className="mb-4">
                                            <p className="text-xs text-green-700 font-bold mb-1"><i className="fas fa-check-circle mr-1"></i> Configured</p>
                                            <p className="text-[10px] text-gray-500 max-w-[200px] mx-auto leading-tight">Project connected successfully.</p>
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-gray-500 mb-4 max-w-[220px] leading-tight">
                                            Configure your Client ID to enable cloud sync.
                                        </p>
                                    )}

                                    <div className="space-y-2 w-full max-w-[220px]">
                                        <button
                                            className={`w-full border text-xs font-bold py-2 px-4 rounded transition flex items-center justify-center gap-2 ${formData.googleClientId ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                            onClick={() => setShowDriveConfigModal(true)}
                                        >
                                            <i className="fas fa-cog"></i> {formData.googleClientId ? 'Manage' : 'Connect Project'}
                                        </button>

                                        <button
                                            className="w-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 font-bold py-2 rounded text-xs transition flex items-center justify-center gap-2"
                                            onClick={async () => {
                                                if (backupHistory.length > 0 && backupHistory[0].url) {
                                                    window.open(backupHistory[0].url, '_blank');
                                                } else {
                                                    alert("Please create a local backup first.");
                                                }
                                            }}
                                        >
                                            <i className="fas fa-file-download"></i> Download Last Backup
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* THEME TAB */}
                {settingsTab === 'theme' && (
                    <div className="p-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-2">
                                <i className="fas fa-palette mr-2 text-purple-600"></i>
                                App Color Theme
                            </h2>
                            <p className="text-sm text-gray-600">Choose your preferred color scheme for the application</p>
                        </div>

                        {/* Current Theme Display */}
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 mb-6 border border-purple-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-700 mb-1">Current Theme</p>
                                    <p className="text-lg font-bold" style={{ color: currentTheme.primary }}>{currentTheme.name}</p>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-8 h-8 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: currentTheme.primary }}></div>
                                    <div className="w-8 h-8 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: currentTheme.secondary }}></div>
                                    <div className="w-8 h-8 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: currentTheme.accent }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Theme Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {availableThemes.map((theme) => (
                                <button
                                    key={theme.id}
                                    onClick={() => setTheme(theme.id)}
                                    className={`relative p-4 rounded-xl border-2 transition-all hover:shadow-lg ${currentTheme.id === theme.id
                                        ? 'border-purple-500 shadow-lg ring-2 ring-purple-200'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    style={{ backgroundColor: theme.background }}
                                >
                                    {/* Selected Badge */}
                                    {currentTheme.id === theme.id && (
                                        <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                                            <i className="fas fa-check"></i> Active
                                        </div>
                                    )}

                                    {/* Theme Name */}
                                    <div className="mb-3">
                                        <h3 className="font-bold text-lg" style={{ color: theme.text }}>{theme.name}</h3>
                                    </div>

                                    {/* Color Palette */}
                                    <div className="flex gap-2 mb-3">
                                        <div className="flex-1 h-12 rounded-lg shadow-sm" style={{ backgroundColor: theme.primary }}></div>
                                        <div className="flex-1 h-12 rounded-lg shadow-sm" style={{ backgroundColor: theme.secondary }}></div>
                                        <div className="flex-1 h-12 rounded-lg shadow-sm" style={{ backgroundColor: theme.accent }}></div>
                                    </div>

                                    {/* Preview Card */}
                                    <div className="bg-white rounded-lg p-3 shadow-sm border" style={{ borderColor: theme.border }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.primary }}></div>
                                            <div className="flex-1">
                                                <div className="h-2 rounded" style={{ backgroundColor: theme.text, opacity: 0.8, width: '70%' }}></div>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="h-1.5 rounded" style={{ backgroundColor: theme.textSecondary, opacity: 0.5 }}></div>
                                            <div className="h-1.5 rounded" style={{ backgroundColor: theme.textSecondary, opacity: 0.5, width: '80%' }}></div>
                                        </div>
                                        <div className="mt-2 flex gap-1">
                                            <div className="h-5 flex-1 rounded" style={{ backgroundColor: theme.success, opacity: 0.3 }}></div>
                                            <div className="h-5 flex-1 rounded" style={{ backgroundColor: theme.warning, opacity: 0.3 }}></div>
                                            <div className="h-5 flex-1 rounded" style={{ backgroundColor: theme.error, opacity: 0.3 }}></div>
                                        </div>
                                    </div>

                                    {/* Apply Button */}
                                    <div className="mt-3">
                                        <div
                                            className="w-full py-2 rounded-lg font-semibold text-sm text-center transition"
                                            style={{
                                                backgroundColor: currentTheme.id === theme.id ? theme.primary : theme.surface,
                                                color: currentTheme.id === theme.id ? '#ffffff' : theme.text,
                                                border: `1px solid ${theme.border}`
                                            }}
                                        >
                                            {currentTheme.id === theme.id ? 'Current Theme' : 'Apply Theme'}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Info Note */}
                        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <i className="fas fa-info-circle text-blue-600 mt-0.5"></i>
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold mb-1">Theme Settings</p>
                                    <p className="text-xs text-blue-700">
                                        Your theme preference is saved locally and will persist across sessions.
                                        All themes are designed with high contrast to ensure text readability.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Reused Modals */}
            {
                showDriveConfigModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[50] p-4">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
                                Configure Google Drive
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Enter your <strong>Google Cloud Client ID</strong> to enable direct integration.
                            </p>

                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-700 mb-1">Google Client ID</label>
                                <input
                                    type="text"
                                    value={formData.googleClientId || ''}
                                    onChange={e => setFormData({ ...formData, googleClientId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                                    placeholder="123456789-abc...apps.googleusercontent.com"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">
                                    Found in <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-blue-600 hover:underline">Google Cloud Console</a> &rarr; APIs & Services &rarr; Credentials.
                                    Ensure Authorized Origin includes <code>{typeof window !== 'undefined' ? window.location.origin : 'your domain'}</code>.
                                </p>
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2 mb-4">
                                <i className="fas fa-info-circle text-blue-500 mt-0.5"></i>
                                <p className="text-xs text-blue-800">
                                    <strong>Why is this needed?</strong><br />
                                    Using your own Client ID ensures you have full control over your data access quotas and avoids security warnings for unverified apps.
                                </p>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowDriveConfigModal(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition">Cancel</button>
                                <button onClick={() => {
                                    handleSave();
                                    setShowDriveConfigModal(false);
                                    alert("Configuration saved! You can now use Google Drive features once the API script is loaded.");
                                }} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm">Save Configuration</button>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                showResetModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[50] p-4">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                            <h3 className="font-bold mb-2">Reset Password for {selectedUser?.name}</h3>
                            <p className="text-xs text-gray-500 mb-4">Note: For security reasons, the current password is hidden. Entering a new password will overwrite the existing one.</p>
                            <input type="text" placeholder="New Password (min 6 characters)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border p-2 rounded mb-4" />
                            <div className="flex justify-end gap-2"><button onClick={() => setShowResetModal(false)} className="px-3 py-1 bg-gray-200 rounded">Cancel</button><button onClick={submitResetPassword} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button></div>
                        </div>
                    </div>
                )
            }
            {
                showEditUserModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[50] p-4">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                            <h3 className="font-bold mb-4">Edit User</h3>
                            <div className="mb-2"><label className="text-xs font-bold">Name</label><input type="text" value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} className="w-full border p-2 rounded" /></div>
                            <div className="flex justify-end gap-2 mt-4"><button onClick={() => setShowEditUserModal(false)} className="px-3 py-1 bg-gray-200 rounded">Cancel</button><button onClick={submitUpdateUser} className="px-3 py-1 bg-blue-600 text-white rounded">Update</button></div>
                        </div>
                    </div>
                )
            }
            {
                showPaymentModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[50] p-4">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md text-center">
                            {paymentStep === 1 ? (
                                <>
                                    <h2 className="text-xl font-bold mb-2">Premium Upgrade</h2>
                                    <h3 className="text-3xl font-bold text-indigo-600 mb-4">₹5999<span className="text-sm text-gray-500">/yr</span></h3>
                                    <button onClick={() => setPaymentStep(2)} className="w-full bg-black text-white py-2 rounded font-bold mb-2">Pay Now</button>
                                    <button onClick={() => setShowPaymentModal(false)} className="text-sm text-gray-500">Back</button>
                                </>
                            ) : (
                                <>
                                    <h2 className="font-bold mb-4">Scan & Pay</h2>
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('upi://pay?pa=spotnet@upi&pn=Spotnet MedOS&am=5999&cu=INR')}`} className="mx-auto mb-4 border p-2 rounded" />
                                    <input type="text" placeholder="Enter UTR Number" value={utrNumber} onChange={e => setUtrNumber(e.target.value)} className="w-full border p-2 rounded mb-2" />
                                    <button onClick={submitPayment} className="w-full bg-green-600 text-white py-2 rounded font-bold mb-2">Submit</button>
                                    <button onClick={() => setPaymentStep(1)} className="text-sm text-gray-500">Back</button>
                                </>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
}
