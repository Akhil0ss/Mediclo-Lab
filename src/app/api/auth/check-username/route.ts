import { NextRequest, NextResponse } from 'next/server';
import { ref, get } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';

export async function POST(request: NextRequest) {
    try {
        await signInAnonymously(auth);
        
        const { username, excludeStaffId, ownerId } = await request.json();
        if (!username) return NextResponse.json({ exists: false });

        const cleanUsername = username.toLowerCase().trim();

        // If ownerId is provided, only check that specific owner's staff (O(1) lookup)
        if (ownerId) {
            const authRef = ref(database, `users/${ownerId}/auth`);
            const snapshot = await get(authRef);

            if (!snapshot.exists()) {
                return NextResponse.json({ exists: false });
            }

            const authData = snapshot.val();
            if (isUsernameTaken(authData, cleanUsername, excludeStaffId)) {
                return NextResponse.json({ exists: true });
            }
            return NextResponse.json({ exists: false });
        }

        // Fallback: Check via prefixes index (no full scan)
        const prefix = cleanUsername.includes('_') ? cleanUsername.split('_')[0] : cleanUsername.split('@')[0] || cleanUsername;
        const prefixSnap = await get(ref(database, `prefixes/${prefix}`));
        
        if (prefixSnap.exists()) {
            const targetOwnerId = prefixSnap.val();
            if (typeof targetOwnerId === 'string') {
                const authRef = ref(database, `users/${targetOwnerId}/auth`);
                const authSnap = await get(authRef);
                if (authSnap.exists()) {
                    if (isUsernameTaken(authSnap.val(), cleanUsername, excludeStaffId)) {
                        return NextResponse.json({ exists: true });
                    }
                }
            }
        }

        return NextResponse.json({ exists: false });
    } catch (error) {
        console.error('Check username error:', error);
        return NextResponse.json({ error: 'Failed to verify username' }, { status: 500 });
    }
}

function isUsernameTaken(authData: any, cleanUsername: string, excludeStaffId?: string): boolean {
    const primaryRoles = ['receptionist', 'lab', 'pharmacy'];
    for (const pRole of primaryRoles) {
        if (authData[pRole]?.username?.toLowerCase() === cleanUsername) {
            return true;
        }
    }

    if (authData.staff) {
        for (const staffId in authData.staff) {
            if (staffId === excludeStaffId) continue;
            const staff = authData.staff[staffId];
            if (staff.username?.toLowerCase() === cleanUsername) {
                return true;
            }
        }
    }

    if (authData.doctors) {
        for (const doctorId in authData.doctors) {
            const doctor = authData.doctors[doctorId];
            if (doctor?.username?.toLowerCase() === cleanUsername) {
                return true;
            }
        }
    }

    return false;
}
