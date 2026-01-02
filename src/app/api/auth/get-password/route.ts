import { NextRequest, NextResponse } from 'next/server';
import { ref, get } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';

export async function POST(request: NextRequest) {
    try {
        await signInAnonymously(auth);

        const { ownerId, username } = await request.json();

        if (!ownerId || !username) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const rolePart = username.split('@')[1];
        let path: string = '';

        if (rolePart === 'receptionist') {
            path = `owners/${ownerId}/receptionist`;
        } else if (rolePart === 'lab') {
            path = `owners/${ownerId}/lab`;
        } else if (rolePart === 'pharmacy') {
            path = `owners/${ownerId}/pharmacy`;
        } else {
            // Doctor
            const doctorsRef = ref(database, `owners/${ownerId}/doctors`);
            const snapshot = await get(doctorsRef);
            if (!snapshot.exists()) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            const doctors = snapshot.val();
            for (const doctorId in doctors) {
                if (doctors[doctorId].username === username) {
                    path = `owners/${ownerId}/doctors/${doctorId}`;
                    break;
                }
            }
        }

        if (!path) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Try to get password from users path (old structure has password field)
        const usersPath = path.replace(`owners/${ownerId}`, `users/${ownerId}/auth`);
        const usersRef = ref(database, usersPath);
        const usersSnap = await get(usersRef);

        let password = 'Not set';
        if (usersSnap.exists()) {
            const userData = usersSnap.val();
            password = userData.password || 'Not set';
        }

        return NextResponse.json({
            success: true,
            password: password,
            username: username
        });

    } catch (error) {
        console.error('Get password error:', error);
        return NextResponse.json({
            error: 'Failed to get password'
        }, { status: 500 });
    }
}
