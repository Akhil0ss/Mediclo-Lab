# Remaining Features - Implementation Code

## Feature 7: User Enable/Disable Toggle
**Note**: Settings page doesn't have user management table yet. Need to add it first.

### Step 1: Add state to settings page
```typescript
const [allUsers, setAllUsers] = useState<any[]>([]);

useEffect(() => {
    if (!user) return;
    const usersRef = ref(database, `users/${user.uid}/auth`);
    const unsubscribe = onValue(usersRef, (snapshot) => {
        const data: any[] = [];
        snapshot.forEach((child) => {
            data.push({ id: child.key, ...child.val() });
        });
        setAllUsers(data);
    });
    return () => unsubscribe();
}, [user]);
```

### Step 2: Add toggle function
```typescript
const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!user) return;
    try {
        await update(ref(database, `users/${user.uid}/auth/${userId}`), {
            isActive: !currentStatus
        });
        alert(`User ${!currentStatus ? 'enabled' : 'disabled'} successfully!`);
    } catch (error) {
        console.error('Error toggling user status:', error);
        alert('Failed to update user status');
    }
};
```

### Step 3: Add UI in settings page (after branding section)
```typescript
{/* User Management Section */}
<div className="mt-8">
    <h2 className="text-2xl font-bold mb-4">
        <i className="fas fa-users text-purple-600"></i> User Management
    </h2>
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Username</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                </tr>
            </thead>
            <tbody>
                {allUsers.map(u => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">{u.name}</td>
                        <td className="px-4 py-3">{u.username}</td>
                        <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                {u.role}
                            </span>
                        </td>
                        <td className="px-4 py-3">
                            {u.isActive ? (
                                <span className="text-green-600">Active</span>
                            ) : (
                                <span className="text-red-600">Disabled</span>
                            )}
                        </td>
                        <td className="px-4 py-3">
                            <button
                                onClick={() => toggleUserStatus(u.id, u.isActive)}
                                className={`px-3 py-1 rounded text-sm ${
                                    u.isActive 
                                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                                }`}
                            >
                                {u.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button
                                onClick={() => handleResetClick(u)}
                                className="ml-2 px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200"
                            >
                                Reset Password
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
</div>
```

---

## Feature 8: Doctor Deletion with Visit Checks
**Note**: Doctors page doesn't have delete functionality yet. Need to add it.

### Step 1: Add delete function to doctors page
```typescript
const handleDeleteDoctor = async (doctorId: string, doctorName: string) => {
    if (!user) return;
    
    try {
        // Check for existing OPD visits
        const opdRef = ref(database, `opd/${user.uid}`);
        const opdSnapshot = await get(opdRef);
        const opdData = opdSnapshot.val() || {};
        
        const hasVisits = Object.values(opdData).some(
            (visit: any) => visit.assignedDoctorId === doctorId
        );
        
        if (hasVisits) {
            const confirmDelete = window.confirm(
                `⚠️ WARNING: Dr. ${doctorName} has existing OPD visits in the system.\n\n` +
                `Deleting this doctor will affect patient records and prescriptions.\n\n` +
                `Are you sure you want to proceed?`
            );
            
            if (!confirmDelete) return;
        }
        
        // Confirm deletion
        const finalConfirm = window.confirm(
            `Delete Dr. ${doctorName}? This action cannot be undone.`
        );
        
        if (!finalConfirm) return;
        
        // Delete doctor
        await remove(ref(database, `doctors/${user.uid}/${doctorId}`));
        
        // Delete auth account if exists
        const authRef = ref(database, `users/${user.uid}/auth`);
        const authSnapshot = await get(authRef);
        const authData = authSnapshot.val() || {};
        
        const authEntry = Object.entries(authData).find(
            ([_, data]: any) => data.doctorId === doctorId
        );
        
        if (authEntry) {
            await remove(ref(database, `users/${user.uid}/auth/${authEntry[0]}`));
        }
        
        alert('Doctor deleted successfully!');
    } catch (error) {
        console.error('Error deleting doctor:', error);
        alert('Failed to delete doctor');
    }
};
```

### Step 2: Add delete button in doctors table
```typescript
<button
    onClick={() => handleDeleteDoctor(doctor.id, doctor.name)}
    className="text-red-600 hover:text-red-800"
    title="Delete Doctor"
>
    <i className="fas fa-trash"></i>
</button>
```

---

## Feature 9: Premium/Subscription Features

### Step 1: Create SubscriptionContext.tsx
```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';

interface SubscriptionContextType {
    isPremium: boolean;
    subscriptionStatus: string;
    expiryDate: string | null;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    isPremium: false,
    subscriptionStatus: 'Free',
    expiryDate: null
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [isPremium, setIsPremium] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState('Free');
    const [expiryDate, setExpiryDate] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const subRef = ref(database, `subscriptions/${user.uid}`);
        const unsubscribe = onValue(subRef, (snapshot) => {
            const data = snapshot.val();
            
            if (data && data.isPremium) {
                const expiry = new Date(data.expiryDate);
                const now = new Date();
                
                if (expiry > now) {
                    setIsPremium(true);
                    setSubscriptionStatus('Premium');
                    setExpiryDate(data.expiryDate);
                } else {
                    setIsPremium(false);
                    setSubscriptionStatus('Expired');
                    setExpiryDate(null);
                }
            } else {
                setIsPremium(false);
                setSubscriptionStatus('Free');
                setExpiryDate(null);
            }
        });

        return () => unsubscribe();
    }, [user]);

    return (
        <SubscriptionContext.Provider value={{ isPremium, subscriptionStatus, expiryDate }}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export const useSubscription = () => useContext(SubscriptionContext);
```

### Step 2: Update layout.tsx to include SubscriptionProvider
```typescript
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

// Wrap children with SubscriptionProvider
<SubscriptionProvider>
    {children}
</SubscriptionProvider>
```

### Step 3: Use in components
```typescript
import { useSubscription } from '@/contexts/SubscriptionContext';

const { isPremium } = useSubscription();

// Replace all instances of:
// const isPremium = false; // TODO: Fetch from subscription data

// With:
// const { isPremium } = useSubscription();
```

---

## Feature 10: Analytics Dashboard Enhancement

### Add to analytics page:
```typescript
// Real-time statistics
const [stats, setStats] = useState({
    totalPatients: 0,
    totalVisits: 0,
    totalSamples: 0,
    totalRevenue: 0,
    todayVisits: 0,
    todaySamples: 0
});

useEffect(() => {
    if (!user) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    const unsubscribes = [
        onValue(ref(database, `patients/${user.uid}`), (snapshot) => {
            setStats(prev => ({ ...prev, totalPatients: snapshot.size }));
        }),
        onValue(ref(database, `opd/${user.uid}`), (snapshot) => {
            const data = snapshot.val() || {};
            const visits = Object.values(data);
            const todayVisits = visits.filter((v: any) => 
                v.visitDate?.startsWith(today)
            ).length;
            
            setStats(prev => ({ 
                ...prev, 
                totalVisits: visits.length,
                todayVisits 
            }));
        }),
        onValue(ref(database, `samples/${user.uid}`), (snapshot) => {
            const data = snapshot.val() || {};
            const samples = Object.values(data);
            const todaySamples = samples.filter((s: any) => 
                s.date?.startsWith(today)
            ).length;
            
            setStats(prev => ({ 
                ...prev, 
                totalSamples: samples.length,
                todaySamples 
            }));
        })
    ];
    
    return () => unsubscribes.forEach(unsub => unsub());
}, [user]);

// Display stats
<div className="grid grid-cols-4 gap-4">
    <div className="bg-blue-50 p-4 rounded-lg">
        <div className="text-3xl font-bold text-blue-600">{stats.totalPatients}</div>
        <div className="text-sm text-gray-600">Total Patients</div>
    </div>
    <div className="bg-green-50 p-4 rounded-lg">
        <div className="text-3xl font-bold text-green-600">{stats.totalVisits}</div>
        <div className="text-sm text-gray-600">Total Visits</div>
    </div>
    <div className="bg-purple-50 p-4 rounded-lg">
        <div className="text-3xl font-bold text-purple-600">{stats.todayVisits}</div>
        <div className="text-sm text-gray-600">Today's Visits</div>
    </div>
    <div className="bg-orange-50 p-4 rounded-lg">
        <div className="text-3xl font-bold text-orange-600">{stats.todaySamples}</div>
        <div className="text-sm text-gray-600">Today's Samples</div>
    </div>
</div>
```

---

## Summary
All 4 remaining features have complete implementation code above.
Copy-paste the code into respective files to complete the system.

**Files to modify**:
1. `src/app/dashboard/settings/page.tsx` - Add user management
2. `src/app/dashboard/doctors/page.tsx` - Add delete with checks
3. `src/contexts/SubscriptionContext.tsx` - Create new file
4. `src/app/dashboard/analytics/page.tsx` - Add real-time stats

**Estimated time**: 30-45 minutes to implement all 4 features
