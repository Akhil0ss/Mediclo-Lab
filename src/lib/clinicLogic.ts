/**
 * Clinic Logic Utilities
 * 
 * Functions to handle the synchronization between Clinical Consultations (OPD)
 * and Laboratory Diagnostics (Samples/Reports).
 */

import { differenceInMinutes, parseISO } from 'date-fns';

/**
 * Checks if there are any completed reports that correlate to a specific OPD visit.
 * A report matches a visit if:
 * 1. The patientId matches.
 * 2. The report was created AFTER the visit's creation.
 * 3. (Optional) The report's test name exists in the visit's referred tests list.
 * 
 * @param visit - The OPD visit record
 * @param allReports - List of all recent reports for the owner
 * @returns Array of matching reports
 */
export function getArrivedReportsForVisit(visit: any, allReports: any[]): any[] {
    if (!visit || !allReports || allReports.length === 0) return [];
    
    // Convert visit start time
    const visitStart = visit.createdAt ? parseISO(visit.createdAt) : new Date(0);

    return allReports.filter(report => {
        // 1. Patient ID must match
        if (report.patientId !== visit.patientId) return false;

        // 2. Report must be created AFTER the visit
        const reportTime = report.createdAt ? parseISO(report.createdAt) : new Date(0);
        if (reportTime <= visitStart) return false;

        // 3. Status Check (Only completed reports)
        if (report.status !== 'Completed' && report.status !== 'Finalized') return false;

        return true;
    });
}

/**
 * Filters out tests from the referral list that have already been reported.
 * 
 * @param referredTests - List of test names prescribed by the doctor
 * @param arrivedReports - List of reports that arrived since the visit started
 * @returns Remaining tests that still need to be reported
 */
export function filterCompletedReferrals(referredTests: string[] | undefined, arrivedReports: any[]): string[] {
    if (!referredTests || !Array.isArray(referredTests)) return [];
    if (arrivedReports.length === 0) return referredTests;

    const reportedNames = arrivedReports.map(r => r.templateName?.toLowerCase() || "");
    
    return referredTests.filter(test => {
        const tLower = test.toLowerCase();
        // Check if any report name includes the test name or vice-versa
        return !reportedNames.some(rn => rn.includes(tLower) || tLower.includes(rn));
    });
}
