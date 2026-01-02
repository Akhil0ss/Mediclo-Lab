'use client';

import { useState } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '@/lib/firebase';

export default function BackupRestorePage() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [backupData, setBackupData] = useState<any>(null);
    const [stats, setStats] = useState({ users: 0, templates: 0 });

    // Backup Templates
    const handleBackup = async () => {
        setLoading(true);
        setMessage('🔄 Backing up all templates from Firebase...');

        try {
            // Get all users
            const usersRef = ref(database, 'users');
            const usersSnapshot = await get(usersRef);

            const allTemplates: any = {};
            let totalTemplates = 0;

            // Get user templates
            if (usersSnapshot.exists()) {
                const users = usersSnapshot.val();

                for (const userId in users) {
                    const templatesRef = ref(database, `templates/${userId}`);
                    const templatesSnapshot = await get(templatesRef);

                    if (templatesSnapshot.exists()) {
                        const userTemplates = templatesSnapshot.val();
                        allTemplates[userId] = userTemplates;
                        totalTemplates += Object.keys(userTemplates).length;
                    }
                }
            }

            // Get common templates
            const commonTemplatesRef = ref(database, 'commonTemplates');
            const commonSnapshot = await get(commonTemplatesRef);

            let commonTemplates = null;
            if (commonSnapshot.exists()) {
                commonTemplates = commonSnapshot.val();
                totalTemplates += Object.keys(commonTemplates).length;
            }

            const backup = {
                backupDate: new Date().toISOString(),
                totalUsers: Object.keys(allTemplates).length,
                totalTemplates: totalTemplates,
                templates: allTemplates,
                commonTemplates: commonTemplates // Add common templates
            };

            // Save backup data to state
            setBackupData(backup);
            setStats({ users: backup.totalUsers, templates: backup.totalTemplates });

            // Download as JSON file
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `templates-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setMessage(`✅ Backup successful! Downloaded ${totalTemplates} templates (${Object.keys(allTemplates).length} users + common templates).`);
        } catch (error: any) {
            console.error('Backup error:', error);

            // Check for permission error
            if (error.message && error.message.includes('Permission denied')) {
                setMessage(
                    '❌ Permission Denied!\n\n' +
                    'Firebase database rules need to be updated to allow admin access.\n\n' +
                    'Please update Firebase Realtime Database Rules to:\n' +
                    '{\n' +
                    '  "rules": {\n' +
                    '    ".read": "auth != null",\n' +
                    '    ".write": "auth != null"\n' +
                    '  }\n' +
                    '}\n\n' +
                    'Or contact your Firebase administrator.'
                );
            } else {
                setMessage('❌ Backup failed: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // Restore Templates
    const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const confirmed = confirm(
            '⚠️ WARNING: This will OVERWRITE all existing templates!\n\n' +
            'Are you sure you want to restore from backup?\n\n' +
            'This action cannot be undone.'
        );

        if (!confirmed) {
            event.target.value = '';
            return;
        }

        setLoading(true);
        setMessage('🔄 Restoring templates from backup file...');

        try {
            const text = await file.text();
            const backup = JSON.parse(text);

            if (!backup.templates) {
                setMessage('❌ Invalid backup file format');
                setLoading(false);
                event.target.value = '';
                return;
            }

            const templates = backup.templates;
            const commonTemplates = backup.commonTemplates;
            let restoredCount = 0;

            // Restore user templates
            for (const userId in templates) {
                const templatesRef = ref(database, `templates/${userId}`);
                await set(templatesRef, templates[userId]);
                restoredCount += Object.keys(templates[userId]).length;
            }

            // Restore common templates
            if (commonTemplates) {
                const commonTemplatesRef = ref(database, 'commonTemplates');
                await set(commonTemplatesRef, commonTemplates);
                restoredCount += Object.keys(commonTemplates).length;
            }

            setMessage(`✅ Restore successful! ${restoredCount} templates restored (${Object.keys(templates).length} users + common templates).`);
            setStats({ users: Object.keys(templates).length, templates: restoredCount });
        } catch (error) {
            console.error('Restore error:', error);
            setMessage('❌ Restore failed: ' + (error as Error).message);
        } finally {
            setLoading(false);
            event.target.value = '';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">🗄️ Backup & Restore</h1>
                        <p className="text-purple-100">Manage database templates backup and restoration</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 text-center">
                        <div className="text-4xl font-bold">{stats.templates}</div>
                        <div className="text-sm text-purple-100">Templates</div>
                    </div>
                </div>
            </div>

            {/* Message Display */}
            {message && (
                <div className={`p-4 rounded-xl border-2 ${message.includes('✅') ? 'bg-green-50 border-green-500 text-green-800' :
                    message.includes('❌') ? 'bg-red-50 border-red-500 text-red-800' :
                        'bg-blue-50 border-blue-500 text-blue-800'
                    }`}>
                    <p className="font-semibold">{message}</p>
                </div>
            )}

            {/* Backup Section */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-4 rounded-xl">
                            <i className="fas fa-cloud-download-alt text-3xl text-blue-600"></i>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-1">
                                Download Backup
                            </h2>
                            <p className="text-gray-600">
                                Export all templates from Firebase database
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                    <h3 className="font-bold text-gray-800 mb-3">📋 What will be backed up:</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-center gap-2">
                            <i className="fas fa-check-circle text-green-600"></i>
                            All test templates from all users
                        </li>
                        <li className="flex items-center gap-2">
                            <i className="fas fa-check-circle text-green-600"></i>
                            Template parameters and ranges
                        </li>
                        <li className="flex items-center gap-2">
                            <i className="fas fa-check-circle text-green-600"></i>
                            Auto-calculation formulas
                        </li>
                        <li className="flex items-center gap-2">
                            <i className="fas fa-check-circle text-green-600"></i>
                            Categories and metadata
                        </li>
                    </ul>
                </div>

                <button
                    onClick={handleBackup}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 px-6 rounded-xl font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    {loading ? (
                        <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Processing...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-download mr-2"></i>
                            Download Templates Backup
                        </>
                    )}
                </button>

                {backupData && (
                    <div className="mt-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                        <h4 className="font-bold text-green-800 mb-2">✅ Last Backup Info:</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-gray-600">Date</p>
                                <p className="font-semibold text-gray-800">
                                    {new Date(backupData.backupDate).toLocaleDateString('en-IN')}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-600">Users</p>
                                <p className="font-semibold text-gray-800">{backupData.totalUsers}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Templates</p>
                                <p className="font-semibold text-gray-800">{backupData.totalTemplates}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Restore Section */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-green-100 p-4 rounded-xl">
                            <i className="fas fa-cloud-upload-alt text-3xl text-green-600"></i>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-1">
                                Restore from Backup
                            </h2>
                            <p className="text-gray-600">
                                Upload backup file to restore templates
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6 mb-6">
                    <div className="flex items-start gap-3">
                        <i className="fas fa-exclamation-triangle text-2xl text-yellow-600 mt-1"></i>
                        <div>
                            <h3 className="font-bold text-yellow-800 mb-2">⚠️ Warning:</h3>
                            <ul className="space-y-1 text-sm text-yellow-700">
                                <li>• This will OVERWRITE all existing templates</li>
                                <li>• Make sure you have a current backup before restoring</li>
                                <li>• This action cannot be undone</li>
                                <li>• Only upload backup files created by this system</li>
                            </ul>
                        </div>
                    </div>
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
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-4 px-6 rounded-xl font-bold text-lg transition disabled:opacity-50 cursor-pointer flex items-center justify-center shadow-lg"
                    >
                        <i className="fas fa-file-upload mr-2"></i>
                        Upload Backup File (.json)
                    </label>
                </label>
            </div>

            {/* Info Section */}
            <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
                <h3 className="font-bold text-blue-900 mb-3">
                    <i className="fas fa-info-circle mr-2"></i>
                    Important Information
                </h3>
                <div className="space-y-2 text-sm text-blue-800">
                    <p>• Backup files are downloaded to your computer in JSON format</p>
                    <p>• Keep backup files in a safe location</p>
                    <p>• Backup before making major changes to templates</p>
                    <p>• Restore only from trusted backup files</p>
                    <p>• File name format: templates-backup-YYYY-MM-DD.json</p>
                </div>
            </div>
        </div>
    );
}
