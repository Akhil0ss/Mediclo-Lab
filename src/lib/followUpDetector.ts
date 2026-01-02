/**
 * Follow-up Detection Utility
 * Detects if a patient visit is a follow-up based on previous visits
 */

import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { database } from './firebase';

export interface FollowUpInfo {
    isFollowUp: boolean;
    daysSinceLastVisit: number;
    lastVisitDate: string;
    lastVisitId: string;
    lastComplaint: string;
    lastDiagnosis: string;
    lastMedicines: any[];
    lastAdvice: string;
}

/**
 * Check if visit is a follow-up
 * @param patientId - Patient ID
 * @param ownerId - Owner/Clinic ID
 * @param followUpWindowDays - Days to consider as follow-up (default: 7)
 * @returns Follow-up information
 */
export async function detectFollowUp(
    patientId: string,
    ownerId: string,
    followUpWindowDays: number = 7
): Promise<FollowUpInfo> {
    try {
        // Get patient's last visit
        const opdRef = ref(database, `opd/${ownerId}`);
        const snapshot = await get(opdRef);

        if (!snapshot.exists()) {
            return {
                isFollowUp: false,
                daysSinceLastVisit: 0,
                lastVisitDate: '',
                lastVisitId: '',
                lastComplaint: '',
                lastDiagnosis: '',
                lastMedicines: [],
                lastAdvice: ''
            };
        }

        // Find all visits for this patient
        const allVisits: any[] = [];
        snapshot.forEach((child) => {
            const visit = child.val();
            if (visit.patientId === patientId) {
                allVisits.push({
                    id: child.key,
                    ...visit
                });
            }
        });

        if (allVisits.length === 0) {
            return {
                isFollowUp: false,
                daysSinceLastVisit: 0,
                lastVisitDate: '',
                lastVisitId: '',
                lastComplaint: '',
                lastDiagnosis: '',
                lastMedicines: [],
                lastAdvice: ''
            };
        }

        // Sort by date (most recent first)
        allVisits.sort((a, b) => {
            const dateA = new Date(a.visitDate || a.createdAt);
            const dateB = new Date(b.visitDate || b.createdAt);
            return dateB.getTime() - dateA.getTime();
        });

        const lastVisit = allVisits[0];
        const lastVisitDate = new Date(lastVisit.visitDate || lastVisit.createdAt);
        const today = new Date();
        const daysDiff = Math.floor((today.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));

        const isFollowUp = daysDiff <= followUpWindowDays;

        return {
            isFollowUp,
            daysSinceLastVisit: daysDiff,
            lastVisitDate: lastVisit.visitDate || lastVisit.createdAt,
            lastVisitId: lastVisit.id,
            lastComplaint: lastVisit.complaint || lastVisit.complaints || '',
            lastDiagnosis: lastVisit.diagnosis || '',
            lastMedicines: lastVisit.medicines || [],
            lastAdvice: lastVisit.advice || ''
        };
    } catch (error) {
        console.error('Error detecting follow-up:', error);
        return {
            isFollowUp: false,
            daysSinceLastVisit: 0,
            lastVisitDate: '',
            lastVisitId: '',
            lastComplaint: '',
            lastDiagnosis: '',
            lastMedicines: [],
            lastAdvice: ''
        };
    }
}

/**
 * Get patient's visit history
 * @param patientId - Patient ID
 * @param ownerId - Owner/Clinic ID
 * @param limit - Number of visits to return (default: 5)
 * @returns Array of previous visits
 */
export async function getPatientHistory(
    patientId: string,
    ownerId: string,
    limit: number = 5
): Promise<any[]> {
    try {
        const opdRef = ref(database, `opd/${ownerId}`);
        const snapshot = await get(opdRef);

        if (!snapshot.exists()) {
            return [];
        }

        const visits: any[] = [];
        snapshot.forEach((child) => {
            const visit = child.val();
            if (visit.patientId === patientId) {
                visits.push({
                    id: child.key,
                    ...visit
                });
            }
        });

        // Sort by date (most recent first)
        visits.sort((a, b) => {
            const dateA = new Date(a.visitDate || a.createdAt);
            const dateB = new Date(b.visitDate || b.createdAt);
            return dateB.getTime() - dateA.getTime();
        });

        return visits.slice(0, limit);
    } catch (error) {
        console.error('Error getting patient history:', error);
        return [];
    }
}

/**
 * Format days since last visit
 * @param days - Number of days
 * @returns Formatted string
 */
export function formatDaysSince(days: number): string {
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) {
        const weeks = Math.floor(days / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
}

/**
 * Check if medicines are similar (for follow-up detection)
 * @param medicines1 - First medicine list
 * @param medicines2 - Second medicine list
 * @returns Similarity percentage (0-100)
 */
export function calculateMedicineSimilarity(medicines1: any[], medicines2: any[]): number {
    if (!medicines1 || !medicines2 || medicines1.length === 0 || medicines2.length === 0) {
        return 0;
    }

    const names1 = medicines1.map(m => m.name?.toLowerCase().trim()).filter(Boolean);
    const names2 = medicines2.map(m => m.name?.toLowerCase().trim()).filter(Boolean);

    if (names1.length === 0 || names2.length === 0) {
        return 0;
    }

    const matches = names1.filter(name => names2.includes(name)).length;
    const total = Math.max(names1.length, names2.length);

    return Math.round((matches / total) * 100);
}
