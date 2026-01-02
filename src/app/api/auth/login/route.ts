import { NextRequest, NextResponse } from 'next/server';
import { ref, get } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { verifyPassword } from '@/lib/userUtils';
import { generateUsername } from '@/lib/userUtils';

export async function POST(request: NextRequest) {
    try {
        // Sign in anonymously to bypass security rules
        await signInAnonymously(auth);

        const { username, password } = await request.json();
        const cleanPassword = password ? password.trim() : '';

        if (!username || !cleanPassword) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        const cleanUsername = username.toLowerCase().trim();
        const rolePart = cleanUsername.split('@')[1];

        let role: string;
        let path: string;

        if (rolePart === 'receptionist') {
            role = 'receptionist';
            path = 'receptionist';
        } else if (rolePart === 'lab') {
            role = 'lab';
            path = 'lab';
        } else if (rolePart === 'pharmacy') {
            role = 'pharmacy';
            path = 'pharmacy';
        } else if (rolePart && rolePart.startsWith('dr')) {
            // Doctor usernames are like: spot@drjohn, spot@drmary
            role = 'doctor';
            path = 'doctors';
        } else {
            // Invalid username format
            return NextResponse.json({ error: 'Invalid username format' }, { status: 401 });
        }

        const labPrefix = cleanUsername.split('@')[0];

        // Read all users (this works because we're on the server with admin SDK)
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);

        if (!snapshot.exists()) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const users = snapshot.val();

        // Search through all owners
        for (const ownerId in users) {
            const profileRef = ref(database, `users/${ownerId}/profile`);
            const profileSnapshot = await get(profileRef);

            if (!profileSnapshot.exists()) continue;

            const profile = profileSnapshot.val();

            // Improved Owner Detection: Check actual usage (Receptionist/Lab) instead of re-deriving
            // This handles cases where prefix has a number suffix (e.g. 'medi1') due to uniqueness checks
            let clinicPrefix = '';
            const authData = users[ownerId].auth;

            if (authData?.receptionist?.username) clinicPrefix = authData.receptionist.username.split('@')[0];
            else if (authData?.lab?.username) clinicPrefix = authData.lab.username.split('@')[0];
            else if (authData?.pharmacy?.username) clinicPrefix = authData.pharmacy.username.split('@')[0];
            else clinicPrefix = generateUsername(profile.labName || '', 'receptionist').split('@')[0]; // Fallback

            if (clinicPrefix === labPrefix) {
                const authPath = role === 'doctor'
                    ? `users/${ownerId}/auth/doctors`
                    : `users/${ownerId}/auth/${path}`;

                const userRef = ref(database, authPath);
                const userSnapshot = await get(userRef);

                if (!userSnapshot.exists()) continue;

                if (role === 'doctor') {
                    const doctors = userSnapshot.val();
                    for (const doctorId in doctors) {
                        const doctor = doctors[doctorId];
                        if (doctor.username === cleanUsername && verifyPassword(cleanPassword, doctor.passwordHash)) {
                            console.log('✅ Doctor login successful:', doctorId);
                            return NextResponse.json({
                                success: true,
                                user: {
                                    userId: doctorId,
                                    username: doctor.username,
                                    name: doctor.name,
                                    role: 'doctor',
                                    isActive: doctor.isActive,
                                    doctorId: doctor.doctorId,
                                    ownerId: ownerId
                                }
                            });
                        }
                    }
                } else {
                    const user = userSnapshot.val();
                    if (user.username === cleanUsername && verifyPassword(cleanPassword, user.passwordHash)) {
                        console.log(`✅ ${role} login successful`);
                        return NextResponse.json({
                            success: true,
                            user: {
                                userId: user.id || user.username,
                                username: user.username,
                                name: user.name,
                                role: user.role,
                                isActive: user.isActive,
                                ownerId: ownerId
                            }
                        });
                    }
                }
            }
        }

        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } catch (error) {
        console.error('Auth API error:', error);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }
}
