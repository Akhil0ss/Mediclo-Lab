/**
 * Backup Manager
 * Handles database backup and restore operations
 */

import { ref, get } from 'firebase/database';
import { ref as storageRef, uploadString, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { database, storage } from './firebase';

export interface BackupData {
    timestamp: string;
    version: string;
    data: {
        patients?: any;

        reports?: any;
        samples?: any;
        templates?: any;
        appointments?: any;
        doctors?: any;
        branding?: any;
    };
}

/**
 * Create full database backup
 * @param ownerId - Owner/Clinic ID
 * @returns Backup data
 */
export async function createBackup(ownerId: string): Promise<BackupData | null> {
    try {
        const backupData: BackupData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            data: {}
        };

        // Backup patients
        const patientsSnapshot = await get(ref(database, `patients/${ownerId}`));
        if (patientsSnapshot.exists()) {
            backupData.data.patients = patientsSnapshot.val();
        }



        // Backup reports
        const reportsSnapshot = await get(ref(database, `reports/${ownerId}`));
        if (reportsSnapshot.exists()) {
            backupData.data.reports = reportsSnapshot.val();
        }

        // Backup samples
        const samplesSnapshot = await get(ref(database, `samples/${ownerId}`));
        if (samplesSnapshot.exists()) {
            backupData.data.samples = samplesSnapshot.val();
        }

        // Backup templates
        const templatesSnapshot = await get(ref(database, `templates/${ownerId}`));
        if (templatesSnapshot.exists()) {
            backupData.data.templates = templatesSnapshot.val();
        }

        // Backup appointments
        const appointmentsSnapshot = await get(ref(database, `appointments/${ownerId}`));
        if (appointmentsSnapshot.exists()) {
            backupData.data.appointments = appointmentsSnapshot.val();
        }

        // Backup doctors
        const doctorsSnapshot = await get(ref(database, `doctors/${ownerId}`));
        if (doctorsSnapshot.exists()) {
            backupData.data.doctors = doctorsSnapshot.val();
        }

        // Backup branding
        const brandingSnapshot = await get(ref(database, `branding/${ownerId}`));
        if (brandingSnapshot.exists()) {
            backupData.data.branding = brandingSnapshot.val();
        }

        return backupData;
    } catch (error) {
        console.error('Error creating backup:', error);
        return null;
    }
}

/**
 * Upload backup to Firebase Storage
 * @param ownerId - Owner/Clinic ID
 * @param backupData - Backup data
 * @param type - Backup type (daily/weekly/monthly/manual)
 * @returns Download URL
 */
export async function uploadBackup(
    ownerId: string,
    backupData: BackupData,
    type: 'daily' | 'weekly' | 'monthly' | 'manual' = 'manual'
): Promise<string | null> {
    try {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');

        const filename = `backup-${type}-${dateStr}-${timeStr}.json`;
        const path = `backups/${ownerId}/${type}/${filename}`;

        const backupRef = storageRef(storage, path);
        const jsonString = JSON.stringify(backupData, null, 2);

        await uploadString(backupRef, jsonString, 'raw', {
            contentType: 'application/json'
        });

        const downloadURL = await getDownloadURL(backupRef);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading backup:', error);
        return null;
    }
}

/**
 * List all backups for owner
 * @param ownerId - Owner/Clinic ID
 * @param type - Backup type filter
 * @returns Array of backup references
 */
export async function listBackups(
    ownerId: string,
    type?: 'daily' | 'weekly' | 'monthly' | 'manual'
): Promise<any[]> {
    try {
        const path = type ? `backups/${ownerId}/${type}` : `backups/${ownerId}`;
        const listRef = storageRef(storage, path);
        const result = await listAll(listRef);

        const backups = await Promise.all(
            result.items.map(async (item) => {
                const url = await getDownloadURL(item);
                return {
                    name: item.name,
                    path: item.fullPath,
                    url,
                    createdAt: item.name.match(/\d{4}-\d{2}-\d{2}/)?.[0] || ''
                };
            })
        );

        // Sort by date (newest first)
        backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        return backups;
    } catch (error) {
        console.error('Error listing backups:', error);
        return [];
    }
}

/**
 * Delete old backups (older than specified days)
 * @param ownerId - Owner/Clinic ID
 * @param daysToKeep - Number of days to keep backups
 * @returns Number of deleted backups
 */
export async function deleteOldBackups(ownerId: string, daysToKeep: number = 90): Promise<number> {
    try {
        const backups = await listBackups(ownerId);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        let deletedCount = 0;

        for (const backup of backups) {
            const backupDate = new Date(backup.createdAt);
            if (backupDate < cutoffDate) {
                const backupRef = storageRef(storage, backup.path);
                await deleteObject(backupRef);
                deletedCount++;
            }
        }

        return deletedCount;
    } catch (error) {
        console.error('Error deleting old backups:', error);
        return 0;
    }
}

/**
 * Download backup data
 * @param url - Backup download URL
 * @returns Backup data
 */
export async function downloadBackup(url: string): Promise<BackupData | null> {
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data as BackupData;
    } catch (error) {
        console.error('Error downloading backup:', error);
        return null;
    }
}

/**
 * Get backup statistics
 * @param ownerId - Owner/Clinic ID
 * @returns Backup statistics
 */
export async function getBackupStats(ownerId: string): Promise<{
    total: number;
    daily: number;
    weekly: number;
    monthly: number;
    manual: number;
    oldestDate: string;
    newestDate: string;
}> {
    try {
        const allBackups = await listBackups(ownerId);
        const dailyBackups = await listBackups(ownerId, 'daily');
        const weeklyBackups = await listBackups(ownerId, 'weekly');
        const monthlyBackups = await listBackups(ownerId, 'monthly');
        const manualBackups = await listBackups(ownerId, 'manual');

        const dates = allBackups.map(b => b.createdAt).filter(Boolean).sort();

        return {
            total: allBackups.length,
            daily: dailyBackups.length,
            weekly: weeklyBackups.length,
            monthly: monthlyBackups.length,
            manual: manualBackups.length,
            oldestDate: dates[0] || '',
            newestDate: dates[dates.length - 1] || ''
        };
    } catch (error) {
        console.error('Error getting backup stats:', error);
        return {
            total: 0,
            daily: 0,
            weekly: 0,
            monthly: 0,
            manual: 0,
            oldestDate: '',
            newestDate: ''
        };
    }
}
