/**
 * Notification Manager
 * Handles patient portal notifications for critical alerts, reports, appointments
 */

import { ref, push, update, get } from 'firebase/database';
import { database } from './firebase';

export interface Notification {
    id?: string;
    userId: string;
    type: 'critical_alert' | 'report_ready' | 'appointment' | 'prescription' | 'general' | 'chat';
    title: string;
    message: string;
    data?: any;
    read: boolean;
    acknowledged: boolean;
    createdAt: string;
    readAt?: string;
    acknowledgedAt?: string;
}

/**
 * Create notification for patient
 * @param userId - Patient user ID
 * @param type - Notification type
 * @param title - Notification title
 * @param message - Notification message
 * @param data - Additional data
 * @returns Notification ID
 */
export async function createNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    data?: any
): Promise<string | null> {
    try {
        const notification: Notification = {
            userId,
            type,
            title,
            message,
            data,
            read: false,
            acknowledged: false,
            createdAt: new Date().toISOString()
        };

        const notificationRef = push(ref(database, `notifications/${userId}`));
        await update(notificationRef, notification);

        return notificationRef.key;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

/**
 * Create critical alert notification
 * @param userId - Patient user ID
 * @param reportId - Report ID
 * @param parameter - Parameter name
 * @param value - Parameter value
 * @param threshold - Threshold value
 * @returns Notification ID
 */
export async function createCriticalAlert(
    userId: string,
    reportId: string,
    parameter: string,
    value: string,
    threshold: string
): Promise<string | null> {
    return createNotification(
        userId,
        'critical_alert',
        '⚠️ Critical Lab Result',
        `Your ${parameter} level is ${value}, which is ${threshold}. Please consult your doctor immediately.`,
        {
            reportId,
            parameter,
            value,
            threshold,
            severity: 'critical'
        }
    );
}

/**
 * Create report ready notification
 * @param userId - Patient user ID
 * @param reportId - Report ID
 * @param testName - Test name
 * @returns Notification ID
 */
export async function createReportReadyNotification(
    userId: string,
    reportId: string,
    testName: string
): Promise<string | null> {
    return createNotification(
        userId,
        'report_ready',
        '📋 Report Ready',
        `Your ${testName} report is ready. You can view and download it from your dashboard.`,
        {
            reportId,
            testName
        }
    );
}

/**
 * Create prescription notification
 * @param userId - Patient user ID
 * @param rxId - Prescription ID
 * @param doctorName - Doctor name
 * @returns Notification ID
 */
export async function createPrescriptionNotification(
    userId: string,
    rxId: string,
    doctorName: string
): Promise<string | null> {
    return createNotification(
        userId,
        'prescription',
        '💊 New Prescription',
        `Dr. ${doctorName} has created a new prescription for you. View it in your dashboard.`,
        {
            rxId,
            doctorName
        }
    );
}

/**
 * Create appointment reminder
 * @param userId - Patient user ID
 * @param appointmentId - Appointment ID
 * @param date - Appointment date
 * @param time - Appointment time
 * @param doctorName - Doctor name
 * @returns Notification ID
 */
export async function createAppointmentReminder(
    userId: string,
    appointmentId: string,
    date: string,
    time: string,
    doctorName: string
): Promise<string | null> {
    return createNotification(
        userId,
        'appointment',
        '📅 Appointment Reminder',
        `You have an appointment with Dr. ${doctorName} on ${date} at ${time}.`,
        {
            appointmentId,
            date,
            time,
            doctorName
        }
    );
}

/**
 * Mark notification as read
 * @param userId - User ID
 * @param notificationId - Notification ID
 */
export async function markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
        await update(ref(database, `notifications/${userId}/${notificationId}`), {
            read: true,
            readAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

/**
 * Mark notification as acknowledged
 * @param userId - User ID
 * @param notificationId - Notification ID
 */
export async function markAsAcknowledged(userId: string, notificationId: string): Promise<void> {
    try {
        await update(ref(database, `notifications/${userId}/${notificationId}`), {
            acknowledged: true,
            acknowledgedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error marking notification as acknowledged:', error);
    }
}

/**
 * Get unread notification count
 * @param userId - User ID
 * @returns Unread count
 */
export async function getUnreadCount(userId: string): Promise<number> {
    try {
        const snapshot = await get(ref(database, `notifications/${userId}`));
        if (!snapshot.exists()) return 0;

        let count = 0;
        snapshot.forEach((child) => {
            const notification = child.val();
            if (!notification.read) count++;
        });

        return count;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
}

/**
 * Get all notifications for user
 * @param userId - User ID
 * @param limit - Maximum number to return
 * @returns Array of notifications
 */
export async function getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    try {
        const snapshot = await get(ref(database, `notifications/${userId}`));
        if (!snapshot.exists()) return [];

        const notifications: Notification[] = [];
        snapshot.forEach((child) => {
            notifications.push({
                id: child.key!,
                ...child.val()
            });
        });

        // Sort by date (newest first)
        notifications.sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        return notifications.slice(0, limit);
    } catch (error) {
        console.error('Error getting notifications:', error);
        return [];
    }
}
