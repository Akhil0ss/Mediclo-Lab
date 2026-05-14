import { NextRequest, NextResponse } from 'next/server';
import { ref, get, set } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { hashPassword, verifyPassword } from '@/lib/userUtils';

export async function POST(request: NextRequest) {
    try {
        await signInAnonymously(auth);

        const { ownerId, username, newPassword, currentPassword } = await request.json();

        if (!ownerId || !username || !newPassword) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        if (newPassword.length < 12) {
            return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 });
        }

        // AUTH CHECK: Require current password to change password
        if (!currentPassword) {
            return NextResponse.json({ error: 'Current password is required to reset password' }, { status: 401 });
        }

        // Find user and verify current password
        const authRef = ref(database, `users/${ownerId}/auth`);
        const authSnap = await get(authRef);

        if (!authSnap.exists()) {
            return NextResponse.json({ error: 'Authentication data not found' }, { status: 404 });
        }

        const authData = authSnap.val();
        const rolePart = username.split('@')[1];
        let targetPath: string = '';
        let verified = false;

        // Check primary roles
        const primaryRoles: Record<string, string> = {
            'receptionist': 'receptionist', 'admin': 'receptionist',
            'lab': 'lab', 'pharmacy': 'pharmacy'
        };

        if (primaryRoles[rolePart]) {
            const roleKey = primaryRoles[rolePart];
            const user = authData[roleKey];
            if (user && user.username === username.toLowerCase().trim()) {
                if (verifyPassword(currentPassword, user.passwordHash)) {
                    targetPath = `users/${ownerId}/auth/${roleKey}/passwordHash`;
                    verified = true;
                }
            }
        }

        // Check staff
        if (!verified && authData.staff) {
            for (const sId in authData.staff) {
                const staff = authData.staff[sId];
                if (staff && staff.username === username.toLowerCase().trim()) {
                    if (verifyPassword(currentPassword, staff.passwordHash)) {
                        targetPath = `users/${ownerId}/auth/staff/${sId}/passwordHash`;
                        verified = true;
                    }
                    break;
                }
            }
        }

        // Check doctors
        if (!verified && authData.doctors) {
            for (const dId in authData.doctors) {
                const doctor = authData.doctors[dId];
                if (doctor && doctor.username === username.toLowerCase().trim()) {
                    if (verifyPassword(currentPassword, doctor.passwordHash)) {
                        targetPath = `users/${ownerId}/auth/doctors/${dId}/passwordHash`;
                        verified = true;
                    }
                    break;
                }
            }
        }

        if (!verified) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
        }

        // Hash and update
        const hashedPassword = hashPassword(newPassword);
        await set(ref(database, targetPath), hashedPassword);

        return NextResponse.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        console.error('Password reset API error:', error);
        return NextResponse.json({
            error: 'Failed to reset password'
        }, { status: 500 });
    }
}
