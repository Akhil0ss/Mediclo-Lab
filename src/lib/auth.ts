// Authentication service for username/password login
import { ref, get, set } from 'firebase/database';
import { auth, database } from './firebase';
import { generateUsername, generatePassword, hashPassword, verifyPassword, generateUniqueBrandPrefix, type UserRole } from './userUtils';

export interface AuthUser {
    userId: string;
    username: string;
    role: UserRole;
    name: string;
    isActive: boolean;
    doctorId?: string;
    ownerId?: string;
}

export interface UserCredentials {
    username: string;
    password: string;
    role: UserRole;
}

/**
 * Authenticate user with username and password
 * Uses server-side API to bypass Firebase security rules
 */
export async function authenticateUser(
    username: string,
    password: string
): Promise<AuthUser | null> {
    try {
        const cleanUsername = username.toLowerCase().trim();
        console.log(`🔍 Client Auth: ${cleanUsername}`);

        // 1. Extract prefix
        let prefix = '';
        if (cleanUsername.includes('_')) {
            prefix = cleanUsername.split('_')[0];
        } else if (cleanUsername.includes('@')) {
            prefix = cleanUsername.split('@')[0];
        } else {
            prefix = cleanUsername;
        }

        // 2. SURGICAL LOOKUP: Get Owner ID from Prefix Index
        const currentUid = auth.currentUser?.uid || 'NOT_LOGGED_IN';
        console.log(`🛡️ Auth context check - UID: ${currentUid}`);

        const prefixRef = ref(database, `prefixes/${prefix}`);
        const prefixSnap = await get(prefixRef);
        
        if (!prefixSnap.exists()) {
            console.error('❌ Laboratory not found for prefix:', prefix);
            return null;
        }

        const ownerId = prefixSnap.val();
        console.log(`🎯 Prefix matched! Owner ID: ${ownerId}`);

        // 3. TARGETED FETCH: Get ONLY this owner's auth data
        const authRef = ref(database, `users/${ownerId}/auth`);
        const authSnap = await get(authRef);

        if (!authSnap.exists()) {
            console.error('❌ Authentication data missing for owner');
            return null;
        }

        const authData = authSnap.val();

        // 4. Verify Credentials (defensive check)
        // Check primary roles
        const primaryRoles = ['receptionist', 'lab', 'pharmacy'];
        for (const r of primaryRoles) {
            const pUser = authData[r];
            if (pUser && typeof pUser === 'object' && pUser.username === cleanUsername && verifyPassword(password, pUser.passwordHash)) {
                return {
                    userId: pUser.id || pUser.username,
                    username: pUser.username,
                    name: pUser.name,
                    role: pUser.role || (r as UserRole),
                    isActive: pUser.isActive !== false,
                    ownerId: ownerId
                };
            }
        }

        // Check staff collection
        if (authData.staff && typeof authData.staff === 'object') {
            for (const sId in authData.staff) {
                const staff = authData.staff[sId];
                if (staff && staff.username === cleanUsername && verifyPassword(password, staff.passwordHash)) {
                    return {
                        userId: sId,
                        username: staff.username,
                        name: staff.name,
                        role: staff.role,
                        isActive: staff.isActive !== false,
                        ownerId: ownerId
                    };
                }
            }
        }

        // Check doctors
        if (authData.doctors && typeof authData.doctors === 'object') {
            for (const dId in authData.doctors) {
                const doctor = authData.doctors[dId];
                if (doctor && doctor.username === cleanUsername && verifyPassword(password, doctor.passwordHash)) {
                    return {
                        userId: dId,
                        username: doctor.username,
                        name: doctor.name,
                        role: 'doctor',
                        isActive: doctor.isActive !== false,
                        ownerId: ownerId
                    };
                }
            }
        }

        console.error('❌ Invalid username or password');
        return null;
    } catch (error) {
        console.error('CRITICAL Authentication Error:', error);
        return null;
    }
}

/**
 * Check if a username is already taken by ANY user in the system
 * Iterates through all users and their sub-accounts
 */
export async function isUsernameTaken(username: string): Promise<boolean> {
    const cleanUsername = username.toLowerCase().trim();
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) return false;

    const users = snapshot.val();
    for (const ownerId in users) {
        const auth = users[ownerId].auth;
        if (!auth) continue;

        // Check Receptionist
        if (auth.receptionist?.username === cleanUsername) return true;
        // Check Lab
        if (auth.lab?.username === cleanUsername) return true;
        // Check Pharmacy
        if (auth.pharmacy?.username === cleanUsername) return true;
        // Check Doctors
        if (auth.doctors) {
            for (const docId in auth.doctors) {
                if (auth.doctors[docId].username === cleanUsername) return true;
            }
        }
    }
    return false;
}

/**
 * Complete profile setup for new owner
 * Updates profile with lab name and generates brand prefix
 * No credentials created (Single Admin)
 */
export async function completeProfileSetup(
    userId: string,
    labName: string
): Promise<void> {
    try {
        // Generate unique brand prefix (e.g., "spot", "spot1", "spot2")
        const brandPrefix = await generateUniqueBrandPrefix(labName);
        console.log(`Generated unique brand prefix: ${brandPrefix} for lab: ${labName}`);

        // Update user profile with ONLY lab details
        await set(ref(database, `users/${userId}/profile`), {
            role: 'owner',
            setupCompleted: true,
            labName,
            brandPrefix, // Store the unique prefix for future reference
            name: 'Reception', // Default name
            createdAt: new Date().toISOString()
        });

        // Save to global prefix index for O(1) login lookups
        await set(ref(database, `prefixes/${brandPrefix}`), userId);

        // Initialize Branding with defaults
        await set(ref(database, `branding/${userId}`), {
            labName: labName,
            createdAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error completing profile setup:', error);
        throw error;
    }
}

/**
 * Reset user password
 */
export async function resetPassword(
    ownerId: string,
    username: string,
    newPassword: string
): Promise<boolean> {
    try {
        const rolePart = username.split('@')[1];
        let path: string = '';

        if (rolePart === 'receptionist' || rolePart === 'admin') {
            path = `users/${ownerId}/auth/receptionist`;
        } else if (rolePart === 'lab') {
            path = `users/${ownerId}/auth/lab`;
        } else if (rolePart === 'pharmacy') {
            path = `users/${ownerId}/auth/pharmacy`;
        } else {
            // Doctor - find by username
            const doctorsRef = ref(database, `users/${ownerId}/auth/doctors`);
            const snapshot = await get(doctorsRef);
            if (!snapshot.exists()) return false;

            const doctors = snapshot.val();
            for (const doctorId in doctors) {
                if (doctors[doctorId].username === username) {
                    path = `users/${ownerId}/auth/doctors/${doctorId}`;
                    break;
                }
            }
            if (!path) return false;
        }

        // Hash and update password
        const hashedPassword = hashPassword(newPassword);
        console.log('🔐 Resetting password:', { username, path, hashedLength: hashedPassword.length });
        await set(ref(database, `${path}/passwordHash`), hashedPassword);
        console.log('✅ Password updated successfully for:', username);
        return true;
    } catch (error) {
        console.error('Password reset error:', error);
        return false;
    }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 12) {
        errors.push('Password must be at least 12 characters long');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*]/.test(password)) {
        errors.push('Password must contain at least one special character (!@#$%^&*)');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Check if user has completed setup
 */
export async function checkSetupCompleted(userId: string): Promise<boolean> {
    try {
        const profileRef = ref(database, `users/${userId}/profile`);
        const snapshot = await get(profileRef);

        if (!snapshot.exists()) return false;

        const profile = snapshot.val();
        return profile.setupCompleted === true;
    } catch (error) {
        console.error('Error checking setup:', error);
        return false;
    }
}
