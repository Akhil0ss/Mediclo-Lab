import { NextRequest, NextResponse } from 'next/server';
import { ref, get } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';

export async function POST(request: NextRequest) {
    try {
        await signInAnonymously(auth);
        
        const { username, excludeStaffId } = await request.json();
        if (!username) return NextResponse.json({ exists: false });

        const cleanUsername = username.toLowerCase().trim();

        // Check against all users globally
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);

        if (!snapshot.exists()) {
            return NextResponse.json({ exists: false });
        }

        const users = snapshot.val();

        for (const ownerId in users) {
            const authData = users[ownerId].auth;
            if (!authData) continue;

            const primaryRoles = ['receptionist', 'lab', 'pharmacy'];
            for (const pRole of primaryRoles) {
                if (authData[pRole]?.username?.toLowerCase() === cleanUsername) {
                    return NextResponse.json({ exists: true });
                }
            }

            if (authData.staff) {
                for (const staffId in authData.staff) {
                    if (staffId === excludeStaffId) continue; // skip the one we are editing
                    const staff = authData.staff[staffId];
                    if (staff.username?.toLowerCase() === cleanUsername) {
                        return NextResponse.json({ exists: true });
                    }
                }
            }

            if (authData.doctors) {
                for (const doctorId in authData.doctors) {
                    if (authData.doctors[doctorId]?.username?.toLowerCase() === cleanUsername) {
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
