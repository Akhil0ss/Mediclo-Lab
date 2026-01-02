/**
 * Firebase RTDB Data Cleanup & Optimization
 * 
 * Automatically cleans up temporary/old data to keep database lean
 * WITHOUT deleting patient records, reports, templates, or samples
 */

import { ref, get, remove, update } from 'firebase/database';
import { database } from './firebase';

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
 * Run all cleanup tasks
 * Call this periodically (e.g., on login or once per day)
 */
export async function runDataCleanup(userId: string, ownerId: string) {
    console.log('🧹 Starting data cleanup...');

    try {
        await Promise.all([
            cleanupNotifications(userId),
            archiveOldChats(ownerId),
            cleanupOldAppointments(ownerId)
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
