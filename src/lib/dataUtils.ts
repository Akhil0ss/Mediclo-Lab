/**
 * Data Utilities for Owner-based Data Syncing
 * 
 * Staff users (Lab, Pharmacy, Receptionist, Doctor) should access data
 * from their Parent Owner's account, not their own UID.
 */

import { ref, get } from 'firebase/database';
import { database } from './firebase';

/**
 * Returns the correct Owner ID for data access.
 * 
 * - For Owner (Google login): Returns their own UID.
 * - For Staff (username login): Returns their ownerId (Admin's UID).
 * 
 * @param userProfile - The user profile from AuthContext
 * @param userId - The current user's UID
 * @returns The owner ID to use for data paths
 */
export function getDataOwnerId(userProfile: any, userId: string): string {
    // If ownerId exists in profile, user is a staff member
    if (userProfile?.ownerId) {
        return userProfile.ownerId;
    }

    // Check localStorage as fallback (for staff users)
    if (typeof window !== 'undefined') {
        const storedOwnerId = localStorage.getItem('ownerId');
        if (storedOwnerId) {
            return storedOwnerId;
        }
    }

    // Default to user's own UID (they are the owner)
    return userId;
}

/**
 * Gets branding data for a user (or their owner if staff).
 * 
 * @param userId - Current user's UID
 * @param userProfile - User profile from AuthContext
 * @returns Branding data object
 */
export async function getBrandingData(userId: string, userProfile: any): Promise<any> {
    const ownerId = getDataOwnerId(userProfile, userId);
    const brandingRef = ref(database, `branding/${ownerId}`);
    const snapshot = await get(brandingRef);

    if (snapshot.exists()) {
        return snapshot.val();
    }

    return null;
}
