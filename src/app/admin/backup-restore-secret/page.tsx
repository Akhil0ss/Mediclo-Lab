'use client';

import { useState } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function BackupRestorePage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [backupData, setBackupData] = useState<any>(null);

    // Backup Templates
    const handleBackup = async () => {
        setLoading(true);
        setMessage('🔄 Backing up templates...');

        try {
            // Get all users
            const usersRef = ref(database, 'users');
            const usersSnapshot = await get(usersRef);

            if (!usersSnapshot.exists()) {
                setMessage('❌ No users found');
                setLoading(false);
                return;
            }

            const users = usersSnapshot.val();
            const allTemplates: any = {};
            let totalTemplates = 0;

            // Get templates for each user
            for (const userId in users) {
                const templatesRef = ref(database, `templates/${userId}`);
                const templatesSnapshot = await get(templatesRef);

                if (templatesSnapshot.exists()) {
                    const userTemplates = templatesSnapshot.val();
                    allTemplates[userId] = userTemplates;
                    totalTemplates += Object.keys(userTemplates).length;
                }
            }

            const backup = {
                backupDate: new Date().toISOString(),
                totalUsers: Object.keys(allTemplates).length,
                totalTemplates: totalTemplates,
                templates: allTemplates
            };

            // Save backup data to state
            setBackupData(backup);

            // Download as JSON file
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `templates-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setMessage(`✅ Backup successful! ${totalTemplates} templates from ${Object.keys(allTemplates).length} users downloaded.`);
        } catch (error) {
            console.error('Backup error:', error);
            setMessage('❌ Backup failed: ' + (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    // Restore Templates
    const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setMessage('🔄 Restoring templates...');

        try {
            const text = await file.text();
            const backup = JSON.parse(text);

            if (!backup.templates) {
                setMessage('❌ Invalid backup file');
                setLoading(false);
                return;
            }

            const templates = backup.templates;
            let restoredCount = 0;

            // Restore templates for each user
            for (const userId in templates) {
                const templatesRef = ref(database, `templates/${userId}`);
                await set(templatesRef, templates[userId]);
                restoredCount += Object.keys(templates[userId]).length;
            }

            setMessage(`✅ Restore successful! ${restoredCount} templates restored for ${Object.keys(templates).length} users.`);
        } catch (error) {
            console.error('Restore error:', error);
            setMessage('❌ Restore failed: ' + (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-center">
                    <i className="fas fa-lock text-6xl mb-4"></i>
                    <p className="text-xl">Authentication Required</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">
                        🔐 Admin Backup & Restore
                    </h1>
                    <p className="text-gray-300">Templates Management System</p>
                    <p className="text-xs text-gray-500 mt-2">Secret Admin Panel</p>
                </div>

                {/* Message Display */}
                {message && (
                    <div className={`mb-6 p-4 rounded-lg ${message.includes('✅') ? 'bg-green-900/50 text-green-200' :
                            message.includes('❌') ? 'bg-red-900/50 text-red-200' :
                                'bg-blue-900/50 text-blue-200'
                        }`}>
                        {message}
                    </div>
                )}

                {/* Backup Section */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-6 border border-white/20">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">
                                📦 Backup Templates
                            </h2>
                            <p className="text-gray-300 text-sm">
                                Download all templates from Firebase
                            </p>
                        </div>
                        <i className="fas fa-download text-5xl text-blue-400"></i>
                    </div>

                    <button
                        onClick={handleBackup}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 px-6 rounded-xl font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                Processing...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-cloud-download-alt mr-2"></i>
                                Download Backup
                            </>
                        )}
                    </button>

                    {backupData && (
                        <div className="mt-4 p-4 bg-black/30 rounded-lg">
                            <p className="text-sm text-gray-300">
                                <strong>Backup Date:</strong> {new Date(backupData.backupDate).toLocaleString('en-IN')}
                            </p>
                            <p className="text-sm text-gray-300">
                                <strong>Total Users:</strong> {backupData.totalUsers}
                            </p>
                            <p className="text-sm text-gray-300">
                                <strong>Total Templates:</strong> {backupData.totalTemplates}
                            </p>
                        </div>
                    )}
                </div>

                {/* Restore Section */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">
                                🔄 Restore Templates
                            </h2>
                            <p className="text-gray-300 text-sm">
                                Upload backup file to restore templates
                            </p>
                        </div>
                        <i className="fas fa-upload text-5xl text-green-400"></i>
                    </div>

                    <label className="block">
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleRestore}
                            disabled={loading}
                            className="hidden"
                            id="restore-file"
                        />
                        <label
                            htmlFor="restore-file"
                            className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white py-4 px-6 rounded-xl font-bold text-lg transition disabled:opacity-50 cursor-pointer flex items-center justify-center"
                        >
                            <i className="fas fa-file-upload mr-2"></i>
                            Upload Backup File
                        </label>
                    </label>

                    <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
                        <p className="text-yellow-200 text-sm">
                            <i className="fas fa-exclamation-triangle mr-2"></i>
                            <strong>Warning:</strong> This will overwrite existing templates. Make sure you have a backup!
                        </p>
                    </div>
                </div>

                {/* Info */}
                <div className="mt-8 text-center">
                    <p className="text-gray-400 text-sm">
                        🔒 This page is hidden and accessible only to authenticated users
                    </p>
                    <p className="text-gray-500 text-xs mt-2">
                        URL: /admin/backup-restore-secret
                    </p>
                </div>
            </div>
        </div>
    );
}
