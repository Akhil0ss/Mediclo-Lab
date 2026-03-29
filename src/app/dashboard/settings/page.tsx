'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, onValue, set, update, push, remove, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import GoogleDriveBackup from '@/components/GoogleDriveBackup';
import { hashPassword, generatePassword } from '@/lib/userUtils';
import { formatIdFromDate } from '@/lib/idGenerator';

import { useSubscription } from '@/contexts/SubscriptionContext';


export default function SettingsPage() {
    const { user, userProfile } = useAuth();
    const { isPremium, daysRemaining, expiryDate } = useSubscription();


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
    const [settingsTab, setSettingsTab] = useState<'branding' | 'billing' | 'backup' | 'staff'>('branding');
    const [isEditing, setIsEditing] = useState(false);

    // Staff State
    const [staffList, setStaffList] = useState<any[]>([]);
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
    const [staffForm, setStaffForm] = useState({ username: '', password: '', role: 'lab', name: '', isActive: true });
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!user) return;
        const staffRef = ref(database, `users/${userProfile?.ownerId || user.uid}/auth/staff`);
        const unsubStaff = onValue(staffRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.entries(data).map(([k, v]) => ({ id: k, ...(v as any) }));
                setStaffList(list);
            } else {
                setStaffList([]);
            }
        });
        return () => unsubStaff();
    }, [user, userProfile]);

    const handleSaveStaff = async () => {
        if (!user) return;
        if (!staffForm.name) {
            alert('Please enter staff member name');
            return;
        }

        const ownerId = userProfile?.ownerId || user.uid;
        // Robust fetch for brandPrefix to handle stale profile state
        let brandPrefix = (userProfile as any)?.brandPrefix;
        if (!brandPrefix) {
            const profileSnap = await get(ref(database, `users/${ownerId}/profile`));
            brandPrefix = profileSnap.val()?.brandPrefix || 'lab';
        }
        
        try {
            let finalUsername = staffForm.username;
            let finalPassword = staffForm.password;
            
            // 1. New Staff Handling
            if (!editingStaffId) {
                const cleanName = staffForm.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
                let baseStaffUsername = `${brandPrefix}_${cleanName}`;
                finalUsername = baseStaffUsername;
                
                let counter = 0;
                const existingUsernames = staffList.map(s => s.username);
                while (existingUsernames.includes(finalUsername)) {
                    counter++;
                    finalUsername = `${baseStaffUsername}${counter}`;
                }

                // Auto-generate strong password ONLY if blank and NEW
                if (!finalPassword) {
                    finalPassword = generatePassword();
                }
            }

            const staffId = editingStaffId || push(ref(database, `users/${ownerId}/auth/staff`)).key;
            const staffRef = ref(database, `users/${ownerId}/auth/staff/${staffId}`);

            const staffData: any = {
                id: staffId,
                username: finalUsername,
                name: staffForm.name,
                role: 'lab', 
                isActive: staffForm.isActive,
                updatedAt: new Date().toISOString()
            };

            // ONLY update password if a new one was provided OR it was auto-generated for NEW staff
            if (finalPassword) {
                staffData.password = finalPassword;
                staffData.passwordHash = hashPassword(finalPassword);
            }

            if (editingStaffId) {
                await update(staffRef, staffData);
            } else {
                await set(staffRef, staffData);
            }
            setShowStaffModal(false);
            
            if (!editingStaffId && finalPassword) {
                alert(`✅ Staff Created Successfully!\n\nUsername: ${finalUsername}\nPassword: ${finalPassword}\n\nPlease share these with your staff.`);
            } else {
                alert('Staff member updated successfully!');
            }
            
            setStaffForm({ username: '', password: '', role: 'lab', name: '', isActive: true });
            setEditingStaffId(null);
            setShowPassword(false);
        } catch (error) {
            console.error('Error saving staff:', error);
            alert('Failed to save staff member');
        }
    };

    const handleDeleteStaff = async (staffId: string) => {
        if (!user) return;
        if (!confirm('Are you absolutely sure you want to PERMANENTLY DELETE this staff member? This action cannot be undone.')) return;
        
        try {
            await remove(ref(database, `users/${userProfile?.ownerId || user.uid}/auth/staff/${staffId}`));
            alert('Staff member deleted successfully!');
        } catch (error) {
            console.error('Error deleting staff:', error);
            alert('Failed to delete staff member');
        }
    };

    // --- DATA MIGRATION UTILITY (SYNC LEGACY DATA) ---
    const [isMigrating, setIsMigrating] = useState(false);

    const handleSyncLegacyData = async () => {
        if (!user || userProfile?.role === 'staff') return;
        
        const confirmMsg = "⚠️ DANGER ZONE: This will RENAME all your existing Patient, Sample, and Report IDs to the new format (e.g., TES-2603-2901P).\n\nExisting internal links will still work, but readable IDs will change. Proceed?";
        if (!confirm(confirmMsg)) return;

        const ownerId = userProfile?.ownerId || user.uid;
        const labName = userProfile?.labName || 'CLINIC';
        
        setIsMigrating(true);
        try {
            const updates: any = {};
            const patientIdMap: Record<string, string> = {};
            const sampleIdMap: Record<string, string> = {};
            
            // 1. MIGRATE PATIENTS
            const patientsSnap = await get(ref(database, `patients/${ownerId}`));
            if (patientsSnap.exists()) {
                const patients: any[] = [];
                patientsSnap.forEach(child => { patients.push({ key: child.key, ...child.val() }); });
                
                // Group by date
                const groupedByDate: Record<string, any[]> = {};
                patients.forEach(p => {
                    const date = new Date(p.createdAt || Date.now()).toISOString().split('T')[0];
                    if (!groupedByDate[date]) groupedByDate[date] = [];
                    groupedByDate[date].push(p);
                });

                // Update Each Group
                Object.keys(groupedByDate).forEach(date => {
                    const sorted = groupedByDate[date].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                    sorted.forEach((p, index) => {
                        const newId = formatIdFromDate(labName, new Date(p.createdAt || Date.now()), index + 1, 'P');
                        updates[`patients/${ownerId}/${p.key}/patientId`] = newId;
                        patientIdMap[p.key] = newId;
                    });
                });
            }

            // 2. MIGRATE SAMPLES
            const samplesSnap = await get(ref(database, `samples/${ownerId}`));
            if (samplesSnap.exists()) {
                const samples: any[] = [];
                samplesSnap.forEach(child => { samples.push({ key: child.key, ...child.val() }); });
                
                const groupedByDate: Record<string, any[]> = {};
                samples.forEach(s => {
                    const date = new Date(s.createdAt || s.date || Date.now()).toISOString().split('T')[0];
                    if (!groupedByDate[date]) groupedByDate[date] = [];
                    groupedByDate[date].push(s);
                });

                Object.keys(groupedByDate).forEach(date => {
                    const sorted = groupedByDate[date].sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());
                    sorted.forEach((s, index) => {
                        const newId = formatIdFromDate(labName, new Date(s.createdAt || s.date || Date.now()), index + 1, 'S');
                        updates[`samples/${ownerId}/${s.key}/sampleId`] = newId;
                        updates[`samples/${ownerId}/${s.key}/sampleNumber`] = newId;
                        sampleIdMap[s.key] = newId;
                    });
                });
            }

            // 3. MIGRATE REPORTS (DEEP SYNC)
            const reportsSnap = await get(ref(database, `reports/${ownerId}`));
            if (reportsSnap.exists()) {
                const reports: any[] = [];
                reportsSnap.forEach(child => { reports.push({ key: child.key, ...child.val() }); });
                
                const groupedByDate: Record<string, any[]> = {};
                reports.forEach(r => {
                    const date = new Date(r.createdAt || r.reportDate || Date.now()).toISOString().split('T')[0];
                    if (!groupedByDate[date]) groupedByDate[date] = [];
                    groupedByDate[date].push(r);
                });

                Object.keys(groupedByDate).forEach(date => {
                    const sorted = groupedByDate[date].sort((a, b) => new Date(a.createdAt || a.reportDate).getTime() - new Date(b.createdAt || b.reportDate).getTime());
                    sorted.forEach((r, index) => {
                        const newId = formatIdFromDate(labName, new Date(r.createdAt || r.reportDate || Date.now()), index + 1, 'R');
                        const reportPath = `reports/${ownerId}/${r.key}`;
                        updates[`${reportPath}/reportId`] = newId;
                        
                        // DEEP SYNC: Update internal ID references for Patients & Samples
                        if (r.patientId && patientIdMap[r.patientId]) {
                            updates[`${reportPath}/patientDisplayId`] = patientIdMap[r.patientId];
                        }
                        
                        // If report has a sample number field (often stored as sampleId or sampleNumber)
                        // Note: r.sampleId is usually the Firebase key, check mapping
                        if (r.sampleId && sampleIdMap[r.sampleId]) {
                            updates[`${reportPath}/sampleId`] = sampleIdMap[r.sampleId];
                        }
                    });
                });
            }

            if (Object.keys(updates).length > 0) {
                await update(ref(database), updates);
                alert(`✅ Total Healing Success! Migrated ${Object.keys(updates).length} fields to the new format.`);
            } else {
                alert("No records found to migrate.");
            }
        } catch (error) {
            console.error('Migration failed:', error);
            alert('Migration failed. Check console for details.');
        } finally {
            setIsMigrating(false);
        }
    };



    // Backup State
    const [backupLoading, setBackupLoading] = useState<string | null>(null);
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

        return () => { unsubBranding(); };
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
    const handleCategoryExport = async (category: 'patients' | 'reports' | 'doctors' | 'all') => {
        if (!user) return;
        setBackupLoading(category);
        try {
            // Fetch Data
            const { createBackup } = await import('@/lib/backupManager');
            const backupData = await createBackup(user.uid);

            if (backupData && backupData.data) {
                // Helper to convert object array to CSV
                const toCSV = (data: any[], filename: string) => {
                    if (!data || data.length === 0) return;
                    const headers = Object.keys(data[0]).join(',');
                    const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(','));
                    const csv = [headers, ...rows].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${filename}.csv`;
                    a.click();
                };

                const dateStr = new Date().toISOString().split('T')[0];

                // Export Patients
                if ((category === 'patients' || category === 'all') && backupData.data.patients) {
                    const patients = Object.values(backupData.data.patients);
                    if (patients.length) toCSV(patients, `patients_backup_${dateStr}`);
                    else if (category === 'patients') alert('No patients found.');
                }

                // Export Reports
                if ((category === 'reports' || category === 'all') && backupData.data.reports) {
                    const reports = Object.values(backupData.data.reports).map((r: any) => ({
                        id: r.id,
                        patientName: r.patientName,
                        date: r.date,
                        testName: r.testName,
                        status: r.status
                    }));
                    if (reports.length) toCSV(reports, `reports_backup_${dateStr}`);
                    else if (category === 'reports') alert('No reports found.');
                }

                // Export Doctors
                if ((category === 'doctors' || category === 'all') && backupData.data.doctors) {
                    const doctors = Object.values(backupData.data.doctors);
                    if (doctors.length) toCSV(doctors, `doctors_backup_${dateStr}`);
                    else if (category === 'doctors') alert('No doctors found.');
                }

                if (category === 'all') alert('✅ Complete System Backup Downloaded!');
            } else {
                alert('No data found to export.');
            }

        } catch (e) {
            console.error(e);
            alert('Export failed');
        } finally {
            setBackupLoading(null);
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

                    <button onClick={() => setSettingsTab('billing')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settingsTab === 'billing' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Billing
                    </button>
                    <button onClick={() => setSettingsTab('backup')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settingsTab === 'backup' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Backup
                    </button>
                    <button onClick={() => setSettingsTab('staff')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settingsTab === 'staff' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Staff
                    </button>
                    <button onClick={() => setSettingsTab('maintenance')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settingsTab === 'maintenance' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Maintenance
                    </button>

                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[400px]">

                {/* MAINTENANCE / DANGER ZONE TAB */}
                {settingsTab === 'maintenance' && (
                    <div className="p-8 animate-in fade-in slide-in-from-bottom-2">
                        <div className="max-w-2xl mx-auto">
                            <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-8 shadow-sm text-center">
                                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-3xl shadow-inner mx-auto mb-6">
                                    <i className="fas fa-exclamation-triangle"></i>
                                </div>
                                
                                <h3 className="text-2xl font-bold text-red-900 mb-2">Laboratory Maintenance</h3>
                                <p className="text-red-700 text-sm mb-10">Repair and synchronize legacy laboratory data.</p>

                                <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-red-100 shadow-sm text-left">
                                    <h4 className="font-bold text-gray-800 text-lg mb-3 flex items-center gap-2">
                                        <i className="fas fa-sync-alt text-blue-600"></i> Sync Legacy Data IDs
                                    </h4>
                                    <div className="text-sm text-gray-600 space-y-4 mb-8 leading-relaxed">
                                        <p>This automated tool will scan all your old records and rename them to your new professional format:</p>
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 font-mono text-center text-blue-800 font-bold">
                                            {(userProfile as any)?.labName?.replace(/[^A-Za-z0-9]/g,'').substring(0,3).toUpperCase() || 'TES'}-2603-2900P
                                        </div>
                                        <p className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-100">
                                            <i className="fas fa-info-circle mr-2"></i> <strong>Note:</strong> Old QR codes on printed reports will still work, but the "Patient ID" and "Report ID" text on your dashboard will change to the new format.
                                        </p>
                                    </div>

                                    <button 
                                        onClick={handleSyncLegacyData}
                                        disabled={isMigrating}
                                        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                                            isMigrating 
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-inner' 
                                            : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:shadow-lg hover:scale-[1.01] active:scale-[0.98]'
                                        }`}
                                    >
                                        {isMigrating ? (
                                            <>
                                                <i className="fas fa-circle-notch fa-spin"></i>
                                                MIGRATING {((userProfile as any)?.labName?.substring(0,3).toUpperCase() || 'DATA')}...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-database"></i>
                                                START DATA SYNC
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="mt-8 p-4 bg-white/40 rounded-lg text-[11px] text-gray-400 text-center border border-dashed border-gray-200 uppercase tracking-widest font-bold">
                                    Maintenance Tool Version 1.0.0
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STAFF TAB */}
                {settingsTab === 'staff' && (
                    <div className="p-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800">Staff Management</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold border border-blue-100 flex items-center gap-1">
                                        <i className="fas fa-shield-halved"></i> 
                                        LOGIN PREFIX: {(userProfile as any)?.brandPrefix || '...'}
                                    </span>
                                    <p className="text-[10px] text-gray-500">Only your staff uses this prefix to login.</p>
                                </div>
                            </div>
                            <button onClick={() => { setEditingStaffId(null); setStaffForm({ username: '', password: '', role: 'lab', name: '', isActive: true }); setShowStaffModal(true); }} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2">
                                <i className="fas fa-plus"></i> Add Staff
                            </button>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-2 rounded-l-lg">Name</th>
                                        <th className="px-6 py-2">Username</th>
                                        <th className="px-6 py-2">Role</th>
                                        <th className="px-6 py-2">Status</th>
                                        <th className="px-6 py-2 text-right rounded-r-lg">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {staffList.map(staff => (
                                        <tr key={staff.id} className="hover:bg-gray-50 transition-colors border-b last:border-0 border-gray-100">
                                            <td className="px-6 py-2 font-medium text-gray-900">{staff.name}</td>
                                            <td className="px-6 py-2 text-sm font-mono text-blue-600">{staff.username}</td>
                                            <td className="px-6 py-2"><span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold uppercase">{staff.role}</span></td>
                                            <td className="px-6 py-2">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${staff.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {staff.isActive ? 'ACTIVE' : 'INACTIVE'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-2 text-right flex justify-end gap-1">
                                                <button onClick={() => { setEditingStaffId(staff.id); setStaffForm({ username: staff.username, password: staff.password || '', role: staff.role, name: staff.name, isActive: staff.isActive }); setShowStaffModal(true); setShowPassword(false); }} className="text-blue-600 hover:text-blue-800 p-2" title="Edit Staff"><i className="fas fa-edit"></i></button>
                                                <button onClick={() => handleDeleteStaff(staff.id)} className="text-red-600 hover:text-red-800 p-2" title="Delete Staff"><i className="fas fa-trash"></i></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {staffList.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">No staff members found. Create one.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

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
                            {/* Unified Grid Layout */}
                            {/* Single Column Layout */}
                            <div className="col-span-12 space-y-8">
                                {/* Section 1: Identity & Logo Combined */}
                                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-6 flex items-center gap-2">
                                        <i className="fas fa-id-card"></i> Identity & Branding
                                    </h4>

                                    <div className="flex flex-col md:flex-row gap-8 items-start">
                                        {/* Logo Column */}
                                        <div className="w-full md:w-auto flex flex-col items-center">
                                            <div className="w-40 h-40 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white overflow-hidden relative group transition-all hover:border-blue-300 shadow-sm">
                                                {logoPreview ? (
                                                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                                                ) : (
                                                    <div className="text-center p-2">
                                                        <i className="fas fa-image text-gray-300 text-3xl mb-1"></i>
                                                        <p className="text-[10px] text-gray-400">Upload Logo</p>
                                                    </div>
                                                )}
                                                <input type="file" disabled={!isEditing} onChange={handleLogoChange} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                                                {isEditing && <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] py-1 text-center">Change Logo</div>}
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-2 text-center w-40">Square PNG recommended</p>
                                        </div>

                                        {/* Inputs Column */}
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-gray-700 mb-1">Lab Name (App Title)</label>
                                                <input type="text" disabled={!isEditing} value={formData.labName} onChange={e => setFormData({ ...formData, labName: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600 outline-none transition" placeholder="e.g. City Diagnostic Center" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 mb-1">Tagline</label>
                                                <input type="text" disabled={!isEditing} value={formData.tagline} onChange={e => setFormData({ ...formData, tagline: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 outline-none" placeholder="e.g. Excellence in Care" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 mb-1">Director Name</label>
                                                <input type="text" disabled={!isEditing} value={formData.director} onChange={e => setFormData({ ...formData, director: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 outline-none" placeholder="Dr. Name" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Contact */}
                                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                                        <i className="fas fa-address-book"></i> Contact Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                                            <input type="text" disabled={!isEditing} value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 outline-none" placeholder="+91..." />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                                            <input type="text" disabled={!isEditing} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 outline-none" placeholder="lab@example.com" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Website URL</label>
                                            <input type="text" disabled={!isEditing} value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 outline-none" placeholder="https://..." />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Clinic Address</label>
                                            <textarea rows={2} disabled={!isEditing} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 outline-none resize-none" placeholder="Full address for report header" />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Configuration */}
                                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                                        <i className="fas fa-cog"></i> Configuration
                                    </h4>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Footer Note / Disclaimer</label>
                                        <textarea rows={2} disabled={!isEditing} value={formData.footerNotes} onChange={e => setFormData({ ...formData, footerNotes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 outline-none resize-none" placeholder="Text to appear at the bottom of every patient report (e.g. Legal Disclaimer, T&C)..." />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* TEAM TAB REMOVED */}

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
                    <div className="p-8 animate-in fade-in slide-in-from-bottom-2">
                        <div className="max-w-4xl mx-auto">
                            <div className="text-center mb-10">
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Data Backup & Export</h3>
                                <p className="text-gray-600">Download your data in CSV format for external use or manual backup.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Patients Card */}
                                <div className="bg-white border rounded-xl p-6 hover:shadow-md transition-shadow group cursor-pointer relative overflow-hidden"
                                    onClick={() => handleCategoryExport('patients')}>
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <i className="fas fa-users text-6xl text-blue-600"></i>
                                    </div>
                                    <div className="relative z-10">
                                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                                            <i className="fas fa-users text-xl"></i>
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-lg mb-1">Patients Data</h4>
                                        <p className="text-sm text-gray-500 mb-4">Export complete patient list, demographics, and contact info.</p>
                                        <button disabled={!!backupLoading} className="text-blue-600 font-semibold text-sm flex items-center gap-2 hover:gap-3 transition-all">
                                            {backupLoading === 'patients' ? 'Processing...' : <>Download CSV <i className="fas fa-arrow-right"></i></>}
                                        </button>
                                    </div>
                                </div>

                                {/* Reports Card */}
                                <div className="bg-white border rounded-xl p-6 hover:shadow-md transition-shadow group cursor-pointer relative overflow-hidden"
                                    onClick={() => handleCategoryExport('reports')}>
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <i className="fas fa-file-medical-alt text-6xl text-green-600"></i>
                                    </div>
                                    <div className="relative z-10">
                                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-4 group-hover:scale-110 transition-transform">
                                            <i className="fas fa-file-medical-alt text-xl"></i>
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-lg mb-1">Medical Reports</h4>
                                        <p className="text-sm text-gray-500 mb-4">Export all test reports, statuses, and result summaries.</p>
                                        <button disabled={!!backupLoading} className="text-green-600 font-semibold text-sm flex items-center gap-2 hover:gap-3 transition-all">
                                            {backupLoading === 'reports' ? 'Processing...' : <>Download CSV <i className="fas fa-arrow-right"></i></>}
                                        </button>
                                    </div>
                                </div>

                                {/* Doctors Card */}
                                <div className="bg-white border rounded-xl p-6 hover:shadow-md transition-shadow group cursor-pointer relative overflow-hidden"
                                    onClick={() => handleCategoryExport('doctors')}>
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <i className="fas fa-user-md text-6xl text-purple-600"></i>
                                    </div>
                                    <div className="relative z-10">
                                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                                            <i className="fas fa-user-md text-xl"></i>
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-lg mb-1">Doctors Directory</h4>
                                        <p className="text-sm text-gray-500 mb-4">Export referring doctors list and commission rates.</p>
                                        <button disabled={!!backupLoading} className="text-purple-600 font-semibold text-sm flex items-center gap-2 hover:gap-3 transition-all">
                                            {backupLoading === 'doctors' ? 'Processing...' : <>Download CSV <i className="fas fa-arrow-right"></i></>}
                                        </button>
                                    </div>
                                </div>

                                {/* Full Backup Card */}
                                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 hover:shadow-lg transition-shadow group cursor-pointer relative overflow-hidden text-white border border-gray-700"
                                    onClick={() => handleCategoryExport('all')}>
                                    <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity">
                                        <i className="fas fa-database text-6xl text-white"></i>
                                    </div>
                                    <div className="relative z-10">
                                        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                                            <i className="fas fa-download text-xl"></i>
                                        </div>
                                        <h4 className="font-bold text-white text-lg mb-1">Complete System Backup</h4>
                                        <p className="text-sm text-gray-300 mb-4">Download EVERYTHING (Patients, Reports, Doctors, etc) as separate files.</p>
                                        <button disabled={!!backupLoading} className="text-white font-semibold text-sm flex items-center gap-2 hover:gap-3 transition-all">
                                            {backupLoading === 'all' ? 'Processing...' : <>Start Full Export <i className="fas fa-arrow-right"></i></>}
                                        </button>
                                    </div>
                                </div>

                                {/* Google Drive Backup Card */}
                                <div className="bg-white border rounded-xl p-6 hover:shadow-md transition-shadow group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <i className="fab fa-google-drive text-6xl text-blue-600"></i>
                                    </div>
                                    <div className="relative z-10">
                                        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                                            <i className="fab fa-google-drive text-xl"></i>
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-lg mb-1">Cloud Backup</h4>
                                        <p className="text-sm text-gray-500 mb-4">Securely upload your complete database to your personal Google Drive.</p>

                                        {!formData.googleClientId ? (
                                            <button
                                                onClick={() => setShowDriveConfigModal(true)}
                                                className="w-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-bold py-2 px-4 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all"
                                            >
                                                <i className="fas fa-cog"></i> Configure Drive
                                            </button>
                                        ) : (
                                            <GoogleDriveBackup
                                                clientId={formData.googleClientId}
                                                fileName={`Mediclo_Backup_${new Date().toISOString().split('T')[0]}.json`}
                                                getData={async () => {
                                                    if (!user) return null;
                                                    const { createBackup } = await import('@/lib/backupManager');
                                                    return await createBackup(user.uid);
                                                }}
                                                onSuccess={() => alert('Backup successfully saved to Google Drive!')}
                                            />
                                        )}

                                        {formData.googleClientId && (
                                            <button
                                                onClick={() => setShowDriveConfigModal(true)}
                                                className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline w-full text-center"
                                            >
                                                Reconfigure Client ID
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* THEME TAB REMOVED */}
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

            {/* STAFF MODAL */}
            {showStaffModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">{editingStaffId ? 'Edit Staff' : 'Add Staff Member'}</h3>
                            <button onClick={() => setShowStaffModal(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-xl"></i></button>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Staff Full Name</label>
                                <input 
                                    type="text" 
                                    autoComplete="off" 
                                    value={staffForm.name} 
                                    onChange={e => setStaffForm({...staffForm, name: e.target.value})} 
                                    className="w-full p-2.5 border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                                    placeholder="Enter full name" 
                                />
                            </div>

                            {editingStaffId && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Staff Username (Read Only)</label>
                                    <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-blue-600 font-mono text-sm select-all">
                                        {staffForm.username}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{editingStaffId ? 'Reset Password' : 'Password (Auto-generated if empty)'}</label>
                                <div className="relative">
                                    <input 
                                        type={showPassword ? 'text' : 'password'} 
                                        autoComplete="new-password"
                                        value={staffForm.password} 
                                        onChange={e => setStaffForm({...staffForm, password: e.target.value})} 
                                        className="w-full p-2.5 pr-10 border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono transition-all" 
                                        placeholder={editingStaffId ? "Enter new password to change" : "Leave empty to auto-generate"}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>
                                {!editingStaffId && (
                                    <p className="text-[10px] text-gray-400 mt-1">Username will be generated automatically: <strong>prefix_name</strong></p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Designation</label>
                                <div className="p-2 bg-purple-50 text-purple-700 rounded-lg border border-purple-100 font-bold text-sm flex items-center gap-2">
                                    <i className="fas fa-flask"></i> Lab Technician
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <input type="checkbox" id="isActiveStaff" checked={staffForm.isActive} onChange={e => setStaffForm({...staffForm, isActive: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                                <label htmlFor="isActiveStaff" className="text-sm font-bold text-gray-700">Account Active</label>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end gap-3">
                            <button onClick={() => setShowStaffModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={handleSaveStaff} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">Save Staff</button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
