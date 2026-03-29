import { push, ref } from 'firebase/database';
import { database } from '@/lib/firebase';

export async function logAudit(ownerId: string, action: string, details: string, performedBy: string) {
    try {
        const auditRef = ref(database, `audit_logs/${ownerId}`);
        await push(auditRef, {
            action,
            details,
            performedBy,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Audit log failed:', err);
    }
}
