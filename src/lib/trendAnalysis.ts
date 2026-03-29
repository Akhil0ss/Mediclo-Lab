import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { database } from './firebase';

export interface TrendPoint {
    date: string;
    value: number;
    unit: string;
}

/**
 * Fetches historical trend data for a specific test parameter for a patient.
 */
export async function getParameterTrend(ownerId: string, patientId: string, parameterName: string): Promise<TrendPoint[]> {
    try {
        const reportsRef = ref(database, `reports/${ownerId}`);
        // Fetch ALL reports and filter locally to bypass "Index not defined" Firebase error
        const snapshot = await get(reportsRef);

        if (!snapshot.exists()) return [];

        const trends: TrendPoint[] = [];
        snapshot.forEach(child => {
            const report = child.val();
            // Search through testDetails -> subtests
            if (report.testDetails) {
                report.testDetails.forEach((test: any) => {
                    if (test.subtests) {
                        const subtest = test.subtests.find((s: any) => s.name === parameterName);
                        if (subtest && subtest.value && !isNaN(parseFloat(subtest.value))) {
                            trends.push({
                                date: report.reportDate || report.createdAt,
                                value: parseFloat(subtest.value),
                                unit: subtest.unit || ''
                            });
                        }
                    }
                });
            }
        });

        // Sort by date ascending
        return trends.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
        console.error('Error fetching trend data:', error);
        return [];
    }
}
