/**
 * ID Generator Library - Enhanced Version
 * Generates unique, sequential IDs for patients, RX, reports, and samples
 * With daily/monthly reset functionality
 */

import { ref, get, set, runTransaction } from 'firebase/database';
import { database } from './firebase';

/**
 * Generate Auto Patient ID
 * Format: {CLINIC_CODE}-{YYYYMM}-{SEQUENCE}
 * Example: SPOT-202512-0001
 */
export async function generatePatientId(ownerId: string, clinicName: string = 'CLINIC'): Promise<string> {
    try {
        // Get clinic code (first 4 letters, uppercase, remove spaces)
        const clinicCode = clinicName
            .replace(/[^A-Za-z]/g, '')
            .substring(0, 4)
            .toUpperCase()
            .padEnd(4, 'X');

        // Get current month in YYYYMM format
        const now = new Date();
        const monthKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Get and increment counter using transaction (prevents duplicates)
        const counterRef = ref(database, `counters/${ownerId}/patientIds/${monthKey}`);

        const newCount = await runTransaction(counterRef, (currentCount) => {
            return (currentCount || 0) + 1;
        });

        const sequence = String(newCount.snapshot.val()).padStart(4, '0');

        return `${clinicCode}-${monthKey}-${sequence}`;
    } catch (error) {
        console.error('Error generating patient ID:', error);
        // Fallback to timestamp-based ID
        return `PAT-${Date.now()}`;
    }
}

/**
 * Generate Auto RX ID
 * Format: RX-{YYYYMMDD}-{SEQUENCE}
 * Example: RX-20251223-001
 */
export async function generateRxId(ownerId: string, clinicName: string = 'CLINIC'): Promise<string> {
    try {
        const clinicCode = clinicName
            .replace(/[^A-Za-z]/g, '')
            .substring(0, 4)
            .toUpperCase()
            .padEnd(4, 'X');

        const now = new Date();
        const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

        const counterRef = ref(database, `counters/${ownerId}/rxIds/${dateKey}`);

        const newCount = await runTransaction(counterRef, (currentCount) => {
            return (currentCount || 0) + 1;
        });

        const sequence = String(newCount.snapshot.val()).padStart(3, '0');

        return `${clinicCode}-RX-${dateKey}-${sequence}`;
    } catch (error) {
        console.error('Error generating RX ID:', error);
        return `RX-${Date.now()}`;
    }
}

/**
 * Generate Auto Report ID
 * Format: {CLINIC_CODE}-LAB-{YYYYMMDD}-{SEQUENCE}
 * Example: SPOT-LAB-20251223-001
 */
export async function generateReportId(ownerId: string, clinicName: string = 'CLINIC'): Promise<string> {
    try {
        const clinicCode = clinicName
            .replace(/[^A-Za-z]/g, '')
            .substring(0, 4)
            .toUpperCase()
            .padEnd(4, 'X');

        const now = new Date();
        const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

        const counterRef = ref(database, `counters/${ownerId}/reportIds/${dateKey}`);

        const newCount = await runTransaction(counterRef, (currentCount) => {
            return (currentCount || 0) + 1;
        });

        const sequence = String(newCount.snapshot.val()).padStart(3, '0');

        return `${clinicCode}-LAB-${dateKey}-${sequence}`;
    } catch (error) {
        console.error('Error generating report ID:', error);
        return `LAB-${Date.now()}`;
    }
}

/**
 * Generate Auto Sample ID
 * Format: {CLINIC_CODE}-SMP-{YYYYMMDD}-{SEQUENCE}
 * Example: SPOT-SMP-20251223-001
 */
export async function generateSampleId(ownerId: string, clinicName: string = 'CLINIC'): Promise<string> {
    try {
        const clinicCode = clinicName
            .replace(/[^A-Za-z]/g, '')
            .substring(0, 4)
            .toUpperCase()
            .padEnd(4, 'X');

        const now = new Date();
        const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

        const counterRef = ref(database, `counters/${ownerId}/sampleIds/${dateKey}`);

        const newCount = await runTransaction(counterRef, (currentCount) => {
            return (currentCount || 0) + 1;
        });

        const sequence = String(newCount.snapshot.val()).padStart(3, '0');

        return `${clinicCode}-SMP-${dateKey}-${sequence}`;
    } catch (error) {
        console.error('Error generating sample ID:', error);
        return `SMP-${Date.now()}`;
    }
}

/**
 * Generate Auto Token Number
 * Format: {SEQUENCE}
 * Example: 1, 2, 3...
 * Resets daily at midnight
 */
export async function generateTokenNumber(ownerId: string): Promise<number> {
    try {
        const now = new Date();
        const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const counterRef = ref(database, `counters/${ownerId}/tokens/${dateKey}`);

        const newCount = await runTransaction(counterRef, (currentCount) => {
            return (currentCount || 0) + 1;
        });

        return newCount.snapshot.val();
    } catch (error) {
        console.error('Error generating token number:', error);
        return Math.floor(Math.random() * 1000);
    }
}

/**
 * Get current counter value (for display purposes)
 */
export async function getCurrentCounter(ownerId: string, type: 'patientIds' | 'rxIds' | 'reportIds' | 'sampleIds' | 'tokens'): Promise<number> {
    try {
        const now = new Date();
        let dateKey: string;

        if (type === 'patientIds') {
            dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        } else if (type === 'tokens') {
            dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        } else {
            dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        }

        const counterRef = ref(database, `counters/${ownerId}/${type}/${dateKey}`);
        const snapshot = await get(counterRef);

        return snapshot.val() || 0;
    } catch (error) {
        console.error('Error getting counter:', error);
        return 0;
    }
}

// ===== LEGACY FUNCTIONS (Keep for backward compatibility) =====

/**
 * @deprecated Use generateReportId, generateSampleId, or generateRxId instead
 */
export async function generateSequentialId(
    userId: string,
    type: 'report' | 'sample' | 'rx',
    labName?: string,
    isPremium: boolean = false
): Promise<string> {
    let prefix = 'SPOT';

    if (isPremium && labName && labName !== 'My Medical Lab') {
        prefix = labName
            .replace(/[^A-Za-z]/g, '')
            .substring(0, 4)
            .toUpperCase()
            .padEnd(4, 'X');
    }

    const counterRef = ref(database, `counters/${userId}/${type}`);
    const snapshot = await get(counterRef);

    let counter = 1;
    if (snapshot.exists()) {
        counter = snapshot.val() + 1;
    }

    await set(counterRef, counter);

    const sequentialNumber = counter.toString().padStart(6, '0');

    return `${prefix}-${sequentialNumber}`;
}

/**
 * @deprecated Use getCurrentCounter instead
 */
export async function previewNextId(
    userId: string,
    type: 'report' | 'sample' | 'rx',
    labName?: string,
    isPremium: boolean = false
): Promise<string> {
    let prefix = 'SPOT';

    if (isPremium && labName && labName !== 'My Medical Lab') {
        prefix = labName
            .replace(/[^A-Za-z]/g, '')
            .substring(0, 4)
            .toUpperCase()
            .padEnd(4, 'X');
    }

    const counterRef = ref(database, `counters/${userId}/${type}`);
    const snapshot = await get(counterRef);

    let counter = 1;
    if (snapshot.exists()) {
        counter = snapshot.val() + 1;
    }

    const sequentialNumber = counter.toString().padStart(6, '0');
    return `${prefix}-${sequentialNumber}`;
}
