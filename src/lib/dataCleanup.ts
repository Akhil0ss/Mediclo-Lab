/**
 * Firebase RTDB Data Cleanup & Optimization
 * 
 * Automatically cleans up temporary/old data to keep database lean
 * WITHOUT deleting patient records, reports, templates, or samples
 */

import { ref, get, remove, update, set } from 'firebase/database';
import { database } from './firebase';
import { logAudit, AUDIT_ACTIONS } from './audit';

/**
 * Clean up read notifications older than 7 days
 */
export async function cleanupNotifications(userId: string) {
    try {
        const notifRef = ref(database, `notifications/${userId}`);
        const snapshot = await get(notifRef);

        if (!snapshot.exists()) return;

        const notifications = snapshot.val();
        const now = new Date().getTime();
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        let cleanedCount = 0;

        for (const notifId in notifications) {
            const notif = notifications[notifId];

            // Delete if read AND older than 7 days
            if (notif.read && notif.timestamp) {
                const notifTime = new Date(notif.timestamp).getTime();
                if (notifTime < sevenDaysAgo) {
                    await remove(ref(database, `notifications/${userId}/${notifId}`));
                    cleanedCount++;
                }
            }
        }

        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned ${cleanedCount} old notifications for ${userId}`);
        }
    } catch (error) {
        console.error('Notification cleanup error:', error);
    }
}

/**
 * Archive old chat messages (>30 days) to reduce active chat size
 */
export async function archiveOldChats(ownerId: string) {
    try {
        const chatsRef = ref(database, `chats/direct/${ownerId}`);
        const snapshot = await get(chatsRef);

        if (!snapshot.exists()) return;

        const chats = snapshot.val();
        const now = new Date().getTime();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

        let archivedCount = 0;

        for (const chatId in chats) {
            const messages = chats[chatId].messages;
            if (!messages) continue;

            for (const msgId in messages) {
                const msg = messages[msgId];

                // Archive if older than 30 days
                if (msg.timestamp) {
                    const msgTime = new Date(msg.timestamp).getTime();
                    if (msgTime < thirtyDaysAgo) {
                        // Move to archive instead of deleting
                        const archiveRef = ref(database, `chats/archive/${ownerId}/${chatId}/messages/${msgId}`);
                        await update(archiveRef, msg);
                        await remove(ref(database, `chats/direct/${ownerId}/${chatId}/messages/${msgId}`));
                        archivedCount++;
                    }
                }
            }
        }

        if (archivedCount > 0) {
            console.log(`📦 Archived ${archivedCount} old chat messages`);
        }
    } catch (error) {
        console.error('Chat archive error:', error);
    }
}

/**
 * Clean up old completed appointments (>90 days)
 */
export async function cleanupOldAppointments(ownerId: string) {
    try {
        const appointmentsRef = ref(database, `appointments/${ownerId}`);
        const snapshot = await get(appointmentsRef);

        if (!snapshot.exists()) return;

        const appointments = snapshot.val();
        const now = new Date().getTime();
        const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

        let cleanedCount = 0;

        for (const apptId in appointments) {
            const appt = appointments[apptId];

            // Delete if completed/cancelled AND older than 90 days
            if ((appt.status === 'completed' || appt.status === 'cancelled') && appt.date) {
                const apptTime = new Date(appt.date).getTime();
                if (apptTime < ninetyDaysAgo) {
                    await remove(ref(database, `appointments/${ownerId}/${apptId}`));
                    cleanedCount++;
                }
            }
        }

        if (cleanedCount > 0) {
            console.log(`🗑️ Cleaned ${cleanedCount} old appointments`);
        }
    } catch (error) {
        console.error('Appointment cleanup error:', error);
    }
}

/**
 * Clean up stale OPD queue items (pending/in-consultation) from previous days.
 * This keeps the queue fresh and prevents yesterday's missed patients from
 * cluttering today's workspace.
 */
export async function cleanupStaleOPDQueues(ownerId: string) {
    try {
        const opdRef = ref(database, `opd/${ownerId}`);
        const snapshot = await get(opdRef);

        if (!snapshot.exists()) return;

        const visits = snapshot.val();
        const today = new Date().toISOString().split('T')[0];
        let archivedCount = 0;

        for (const visitId in visits) {
            const visit = visits[visitId];
            const visitDate = visit.visitDate || (visit.createdAt ? visit.createdAt.split('T')[0] : '');

            // If visit is from a previous day AND still in queue (not finished)
            if (visitDate && visitDate < today) {
                if (visit.status === 'pending' || visit.status === 'in-consultation') {
                    // ARCHIVE instead of DELETE — preserves data integrity
                    await set(ref(database, `opd_archive/${ownerId}/${visitId}`), {
                        ...visit,
                        archivedAt: new Date().toISOString(),
                        archiveReason: 'stale_queue_cleanup'
                    });
                    await remove(ref(database, `opd/${ownerId}/${visitId}`));
                    archivedCount++;
                }
            }
        }

        if (archivedCount > 0) {
            logAudit(ownerId, AUDIT_ACTIONS.DATA_CLEANUP, `Archived ${archivedCount} stale OPD queue items from previous days`, 'SYSTEM');
        }
    } catch (error) {
        console.error('OPD cleanup error:', error);
    }
}

/**
 * INFRA-04: Clean up date-based counter keys older than 90 days.
 * Counters accumulate keys like `counters/{ownerId}/ptIds/260401` forever.
 */
export async function cleanupOldCounters(ownerId: string) {
    try {
        const counterTypes = ['ptIds', 'sampleIds', 'reportIds', 'invoiceIds', 'rxIds'];
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);

        for (const type of counterTypes) {
            const counterRef = ref(database, `counters/${ownerId}/${type}`);
            const snap = await get(counterRef);
            if (!snap.exists()) continue;

            const data = snap.val();
            let cleaned = 0;
            for (const dateKey in data) {
                // Date keys are in YYMMDD format
                if (dateKey.length === 6) {
                    const year = 2000 + parseInt(dateKey.substring(0, 2));
                    const month = parseInt(dateKey.substring(2, 4)) - 1;
                    const day = parseInt(dateKey.substring(4, 6));
                    const keyDate = new Date(year, month, day);
                    if (keyDate < cutoff) {
                        await remove(ref(database, `counters/${ownerId}/${type}/${dateKey}`));
                        cleaned++;
                    }
                }
            }
            if (cleaned > 0) {
                logAudit(ownerId, AUDIT_ACTIONS.DATA_CLEANUP, `Cleaned ${cleaned} old ${type} counter keys (>90 days)`, 'SYSTEM');
            }
        }
    } catch (error) {
        console.error('Counter cleanup error:', error);
    }
}

/**
 * Run all cleanup tasks
 * Call this periodically (e.g., on login or once per day)
 */
export async function runDataCleanup(userId: string, ownerId: string) {
    console.log('🧹 Starting data cleanup...');

    try {
        await Promise.all([
            cleanupNotifications(ownerId),
            archiveOldChats(ownerId),
            cleanupOldAppointments(ownerId),
            cleanupStaleOPDQueues(ownerId),
            cleanupOldCounters(ownerId)
        ]);

        console.log('✅ Data cleanup completed');
    } catch (error) {
        console.error('Data cleanup error:', error);
    }
}

/**
 * Get database size estimate (for monitoring)
 */
export async function estimateDatabaseSize(ownerId: string) {
    try {
        const paths = [
            `patients/${ownerId}`,
            `reports/${ownerId}`,
            `samples/${ownerId}`,
            `templates/${ownerId}`,
            `chats/direct/${ownerId}`,
            `notifications/${ownerId}`,
            `appointments/${ownerId}`
        ];

        const sizes: Record<string, number> = {};

        for (const path of paths) {
            const snapshot = await get(ref(database, path));
            if (snapshot.exists()) {
                const data = snapshot.val();
                const jsonSize = JSON.stringify(data).length;
                sizes[path] = jsonSize;
            }
        }

        return sizes;
    } catch (error) {
        console.error('Size estimate error:', error);
        return {};
    }
}
