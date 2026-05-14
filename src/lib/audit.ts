import { push, ref } from 'firebase/database';
import { database } from '@/lib/firebase';

/**
 * Log an audit event for compliance and accountability tracking.
 * All clinical and administrative actions should be logged through this function.
 */
export async function logAudit(
    ownerId: string,
    action: string,
    details: string,
    performedBy: string,
    metadata?: Record<string, any>
) {
    try {
        const auditRef = ref(database, `audit_logs/${ownerId}`);
        await push(auditRef, {
            action,
            details,
            performedBy,
            timestamp: new Date().toISOString(),
            ...(metadata ? { metadata } : {})
        });
    } catch (err) {
        console.error('Audit log failed:', err);
    }
}

// ==========================================
// Pre-defined audit action constants
// ==========================================

export const AUDIT_ACTIONS = {
    // Authentication
    STAFF_LOGIN: 'STAFF_LOGIN',
    STAFF_LOGOUT: 'STAFF_LOGOUT',
    PASSWORD_CHANGED: 'PASSWORD_CHANGED',

    // Patient Management
    PATIENT_CREATED: 'PATIENT_CREATED',
    PATIENT_UPDATED: 'PATIENT_UPDATED',
    PATIENT_DELETED: 'PATIENT_DELETED',

    // Clinical
    OPD_VISIT_CREATED: 'OPD_VISIT_CREATED',
    RX_CREATED: 'RX_CREATED',
    RX_UPDATED: 'RX_UPDATED',

    // Laboratory
    SAMPLE_COLLECTED: 'SAMPLE_COLLECTED',
    REPORT_CREATED: 'REPORT_CREATED',
    REPORT_FINALIZED: 'REPORT_FINALIZED',
    REPORT_DELETED: 'REPORT_DELETED',

    // Pharmacy
    RX_DISPENSED: 'RX_DISPENSED',

    // Administration
    STAFF_CREATED: 'STAFF_CREATED',
    STAFF_DELETED: 'STAFF_DELETED',
    TEMPLATE_MODIFIED: 'TEMPLATE_MODIFIED',
    INVOICE_GENERATED: 'INVOICE_GENERATED',
    SETTINGS_UPDATED: 'SETTINGS_UPDATED',
    DATA_CLEANUP: 'DATA_CLEANUP',
} as const;
