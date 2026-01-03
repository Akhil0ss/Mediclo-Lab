// Authentication service for username/password login
import { ref, get, set } from 'firebase/database';
import { database } from './firebase';
import { generateUsername, generatePassword, hashPassword, generateUniqueBrandPrefix, type UserRole } from './userUtils';

export interface AuthUser {
    userId: string;
    username: string;
    role: UserRole;
    name: string;
    isActive: boolean;
    doctorId?: string;
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
        console.log(`Debug: Auth attempt for '${username}'`);

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            console.error('Debug: Auth failed with status:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.success && data.user) {
            console.log('Debug: Auth successful');
            return data.user;
        }

        return null;
    } catch (error) {
        console.error('Authentication error:', error);
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
            name: 'Lab Admin', // Default name
            createdAt: new Date().toISOString()
        });

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
