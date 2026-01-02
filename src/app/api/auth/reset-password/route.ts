import { NextRequest, NextResponse } from 'next/server';
import { ref, get, set } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { hashPassword } from '@/lib/userUtils';

export async function POST(request: NextRequest) {
    try {
        // Sign in anonymously to bypass security rules
        await signInAnonymously(auth);

        const { ownerId, username, newPassword } = await request.json();

        if (!ownerId || !username || !newPassword) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        if (newPassword.length < 12) {
            return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 });
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
            // Doctor - find by username
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
            if (!path) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
        }

        // Hash password
        const hashedPassword = hashPassword(newPassword);

        // Update in owners path (new structure)
        await set(ref(database, `${path}/passwordHash`), hashedPassword);
        console.log('✅ Updated owners path:', path);

        // ALSO update in users path (old structure) for compatibility
        const userPath = path.replace(`owners/${ownerId}`, `users/${ownerId}/auth`);
        try {
            await set(ref(database, `${userPath}/passwordHash`), hashedPassword);
            console.log('✅ Updated users path:', userPath);
        } catch (e) {
            console.log('⚠️ Users path update failed (may not exist)');
        }

        return NextResponse.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        console.error('Password reset API error:', error);
        return NextResponse.json({
            error: 'Failed to reset password',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
