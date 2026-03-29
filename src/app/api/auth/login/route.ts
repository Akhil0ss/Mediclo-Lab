import { NextRequest, NextResponse } from 'next/server';
import { ref, get } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { verifyPassword } from '@/lib/userUtils';
import { generateUsername } from '@/lib/userUtils';

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();
        const cleanPassword = password ? password.trim() : '';

        if (!username || !cleanPassword) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        // --- AUTHENTICATE SERVER CONTEXT ---
        // Crucial for satisfying Firebase security rules in a Node.js/Next.js environment
        if (!auth.currentUser) {
            try {
                await signInAnonymously(auth);
                console.log('✅ Server authenticated anonymously for login query');
            } catch (err: any) {
                console.warn('⚠️ Server-side auth warning:', err.message);
                // Continue anyway, as some rules might allow public access
            }
        }

        const cleanUsername = username.toLowerCase().trim();
        
        // 1. Extract prefix
        let prefix = '';
        if (cleanUsername.includes('_')) {
            prefix = cleanUsername.split('_')[0];
        } else if (cleanUsername.includes('@')) {
            prefix = cleanUsername.split('@')[0];
        } else {
            prefix = cleanUsername; 
        }

        console.log(`🔍 Auth Attempt: ${cleanUsername} (Prefix: ${prefix})`);

        // 2. SURGICAL LOOKUP
        const prefixRef = ref(database, `prefixes/${prefix}`);
        const prefixSnap = await get(prefixRef);
        
        let ownerId = prefixSnap.exists() ? prefixSnap.val() : null;
        let usersToSearch = [];

        if (ownerId && typeof ownerId === 'string') {
            console.log(`🎯 Prefix matched! Owner: ${ownerId}`);
            const ownerRef = ref(database, `users/${ownerId}`);
            const ownerSnap = await get(ownerRef);
            if (ownerSnap.exists()) {
                usersToSearch.push({ id: ownerId, data: ownerSnap.val() });
            }
        }

        if (usersToSearch.length === 0) {
            console.log('⚠️ Prefix not found in index.');
            return NextResponse.json({ error: 'Laboratory not found. Owner must login via Google first to index.' }, { status: 404 });
        }

        // 4. Fetch Subscriptions
        const subsSnap = await get(ref(database, 'subscriptions'));
        const subscriptions = subsSnap.exists() ? subsSnap.val() : {};

        // 5. Match User
        for (const item of usersToSearch) {
            const currentOwnerId = item.id;
            const userData = item.data;
            if (!userData || !userData.auth) continue;

            const authData = userData.auth;
            
            // Sub Status Helper
            const isOwnerSubActive = () => {
                const subData = subscriptions[currentOwnerId];
                const now = new Date();
                if (subData && subData.isPremium) {
                    return new Date(subData.expiryDate) > now;
                }
                const createdAt = userData?.profile?.createdAt;
                if (createdAt) {
                    const trialDuration = 14 * 24 * 60 * 60 * 1000;
                    return (now.getTime() - new Date(createdAt).getTime()) < trialDuration;
                }
                return false;
            };

            const isSubActive = isOwnerSubActive();

            // Check primary roles
            const primaryRoles = ['receptionist', 'lab', 'pharmacy'];
            for (const r of primaryRoles) {
                const pUser = authData[r];
                if (pUser && typeof pUser === 'object' && pUser.username === cleanUsername && verifyPassword(cleanPassword, pUser.passwordHash)) {
                    if (!isSubActive && r !== 'receptionist') {
                        return NextResponse.json({ error: 'Subscription Expired. Please contact owner.' }, { status: 403 });
                    }
                    return NextResponse.json({
                        success: true,
                        user: {
                            userId: pUser.id || pUser.username,
                            username: pUser.username,
                            name: pUser.name,
                            role: pUser.role || r,
                            isActive: pUser.isActive !== false,
                            ownerId: currentOwnerId
                        }
                    });
                }
            }

            // Check staff collection
            if (authData.staff && typeof authData.staff === 'object') {
                for (const sId in authData.staff) {
                    const staff = authData.staff[sId];
                    if (staff && staff.username === cleanUsername && verifyPassword(cleanPassword, staff.passwordHash)) {
                        if (!isSubActive) return NextResponse.json({ error: 'Subscription Expired. Please contact owner.' }, { status: 403 });
                        return NextResponse.json({
                            success: true,
                            user: {
                                userId: sId,
                                username: staff.username,
                                name: staff.name,
                                role: staff.role,
                                isActive: staff.isActive !== false,
                                ownerId: currentOwnerId
                            }
                        });
                    }
                }
            }

            // Check doctors collection
            if (authData.doctors && typeof authData.doctors === 'object') {
                for (const dId in authData.doctors) {
                    const doctor = authData.doctors[dId];
                    if (doctor && doctor.username === cleanUsername && verifyPassword(cleanPassword, doctor.passwordHash)) {
                        if (!isSubActive) return NextResponse.json({ error: 'Subscription Expired. Please contact owner.' }, { status: 403 });
                        return NextResponse.json({
                            success: true,
                            user: {
                                userId: dId,
                                username: doctor.username,
                                name: doctor.name,
                                role: 'doctor',
                                isActive: doctor.isActive !== false,
                                ownerId: currentOwnerId
                            }
                        });
                    }
                }
            }
        }

        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } catch (error: any) {
        console.error('CRITICAL Auth API Error:', error.message);
        return NextResponse.json({ 
            error: 'Authentication failed. Please try again later.', 
            debug: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
