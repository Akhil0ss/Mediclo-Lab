import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ref, get } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { signInAnonymously } from 'firebase/auth';
import { verifyPassword } from '@/lib/userUtils';

type OwnerAuthRecord = {
    id: string;
    data: {
        auth: Record<string, unknown>;
        profile: Record<string, unknown>;
    };
};

type LoginUserRecord = {
    id?: string;
    username?: string;
    passwordHash?: string;
    name?: string;
    role?: string;
    isActive?: boolean;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object';
}

function isLoginUserRecord(value: unknown): value is LoginUserRecord {
    return isObjectRecord(value);
}

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
            } catch (err: unknown) {
                console.warn('⚠️ Server-side auth warning:', err instanceof Error ? err.message : err);
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
        
        const ownerId = prefixSnap.exists() ? prefixSnap.val() : null;
        const usersToSearch: OwnerAuthRecord[] = [];

        if (ownerId && typeof ownerId === 'string') {
            console.log(`🎯 Prefix matched! Owner: ${ownerId}`);
            const [authSnap, profileSnap] = await Promise.all([
                get(ref(database, `users/${ownerId}/auth`)),
                get(ref(database, `users/${ownerId}/profile`))
            ]);

            if (authSnap.exists()) {
                usersToSearch.push({
                    id: ownerId,
                    data: {
                        auth: authSnap.val(),
                        profile: profileSnap.exists() ? profileSnap.val() : {}
                    }
                });
            }
        }

        if (usersToSearch.length === 0) {
            console.log('⚠️ Prefix not found in index.');
            return NextResponse.json({ error: 'Laboratory not found. Owner must login via Google first to index.' }, { status: 404 });
        }

        // 4. Match User
        for (const item of usersToSearch) {
            const currentOwnerId = item.id;
            const userData = item.data;
            if (!userData || !userData.auth) continue;

            const authData = userData.auth;
            const subSnap = await get(ref(database, `subscriptions/${currentOwnerId}`));
            const subData = subSnap.exists() ? subSnap.val() : null;
            const ownerLabName = String(userData?.profile?.labName || userData?.profile?.hospitalName || userData?.profile?.lab_name || 'My Laboratory');
            
            // Sub Status Helper
            const isOwnerSubActive = () => {
                const now = new Date();
                if (subData && subData.isPremium) {
                    return new Date(subData.expiryDate) > now;
                }
                const createdAt = userData?.profile?.createdAt;
                if (typeof createdAt === 'string' || typeof createdAt === 'number') {
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
                if (isLoginUserRecord(pUser) && pUser.username === cleanUsername && pUser.passwordHash && verifyPassword(cleanPassword, pUser.passwordHash)) {
                    const pUserIsActive = pUser.isActive !== false;
                    if (!pUserIsActive) {
                        return NextResponse.json({ error: 'This account has been deactivated. Contact your lab owner.' }, { status: 403 });
                    }
                    if (!isSubActive && r !== 'receptionist') {
                        return NextResponse.json({ error: 'Subscription Expired. Please contact owner.' }, { status: 403 });
                    }
                    await logAudit(currentOwnerId, AUDIT_ACTIONS.STAFF_LOGIN, `Login via API portal: ${pUser.username} as ${r}`, pUser.name);
                    
                    const userData = {
                        userId: pUser.id || pUser.username,
                        username: pUser.username,
                        name: pUser.name,
                        role: pUser.role || r,
                        isActive: pUserIsActive,
                        ownerId: currentOwnerId,
                        labName: ownerLabName
                    };
                    
                    const cookieStore = await cookies();
                    cookieStore.set('medos_auth_token', Buffer.from(JSON.stringify(userData)).toString('base64'), {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict',
                        path: '/',
                        maxAge: 60 * 60 * 24 * 7
                    });

                    return NextResponse.json({ success: true, user: userData });
                }
            }

            // Check staff collection
            if (isObjectRecord(authData.staff)) {
                for (const [sId, staff] of Object.entries(authData.staff)) {
                    if (isLoginUserRecord(staff) && staff.username === cleanUsername && staff.passwordHash && verifyPassword(cleanPassword, staff.passwordHash)) {
                        const staffIsActive = staff.isActive !== false;
                        if (!staffIsActive) {
                            return NextResponse.json({ error: 'This account has been deactivated. Contact your lab owner.' }, { status: 403 });
                        }
                        if (!isSubActive) return NextResponse.json({ error: 'Subscription Expired. Please contact owner.' }, { status: 403 });
                        await logAudit(currentOwnerId, AUDIT_ACTIONS.STAFF_LOGIN, `Login via API portal: ${staff.username} as staff`, staff.name);
                        
                        const userData = {
                            userId: sId,
                            username: staff.username,
                            name: staff.name,
                            role: staff.role,
                            isActive: staffIsActive,
                            ownerId: currentOwnerId,
                            labName: ownerLabName
                        };
                        
                        const cookieStore = await cookies();
                        cookieStore.set('medos_auth_token', Buffer.from(JSON.stringify(userData)).toString('base64'), {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'strict',
                            path: '/',
                            maxAge: 60 * 60 * 24 * 7
                        });

                        return NextResponse.json({ success: true, user: userData });
                    }
                }
            }

            // Check doctors collection
            if (isObjectRecord(authData.doctors)) {
                for (const [dId, doctor] of Object.entries(authData.doctors)) {
                    if (isLoginUserRecord(doctor) && doctor.username === cleanUsername && doctor.passwordHash && verifyPassword(cleanPassword, doctor.passwordHash)) {
                        const doctorIsActive = doctor.isActive !== false;
                        if (!doctorIsActive) {
                            return NextResponse.json({ error: 'This account has been deactivated. Contact your lab owner.' }, { status: 403 });
                        }
                        if (!isSubActive) return NextResponse.json({ error: 'Subscription Expired. Please contact owner.' }, { status: 403 });
                        await logAudit(currentOwnerId, AUDIT_ACTIONS.STAFF_LOGIN, `Login via API portal: ${doctor.username} as associate doctor`, doctor.name);
                        
                        const userData = {
                            userId: dId,
                            username: doctor.username,
                            name: doctor.name,
                            role: doctor.role || 'doctor',
                            isActive: doctorIsActive,
                            ownerId: currentOwnerId,
                            labName: ownerLabName
                        };

                        const cookieStore = await cookies();
                        cookieStore.set('medos_auth_token', Buffer.from(JSON.stringify(userData)).toString('base64'), {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'strict',
                            path: '/',
                            maxAge: 60 * 60 * 24 * 7
                        });

                        return NextResponse.json({ success: true, user: userData });
                    }
                }
            }
        }

        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('CRITICAL Auth API Error:', message);
        return NextResponse.json({ 
            error: 'Authentication failed. Please try again later.', 
            debug: message,
            stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
