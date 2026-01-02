// Backup Tab Component for Settings Page
// Add this code to Settings page after the Billing tab section

{/* BACKUP TAB */ }
{
    settingsTab === 'backup' && (
        <div className="p-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
                <div>
                    <h3 className="font-bold text-lg text-gray-800">Database Backup</h3>
                    <p className="text-xs text-gray-500">Create and manage your data backups</p>
                </div>
                <button
                    onClick={async () => {
                        if (!user) return;
                        setBackupLoading(true);
                        try {
                            const backupData = await createBackup(user.uid);
                            if (backupData) {
                                const url = await uploadBackup(user.uid, backupData, 'manual');
                                if (url) {
                                    alert(`✅ Backup created successfully!\n\nYou can download it from the backup history below.`);
                                    // Refresh history
                                    const history = await listBackups(user.uid);
                                    setBackupHistory(history);
                                    const stats = await getBackupStats(user.uid);
                                    setBackupStats(stats);
                                }
                            }
                        } catch (error) {
                            console.error(error);
                            alert('❌ Backup failed. Please try again.');
                        } finally {
                            setBackupLoading(false);
                        }
                    }}
                    disabled={backupLoading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    {backupLoading ? (
                        <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Creating Backup...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-download mr-2"></i>
                            Create Backup Now
                        </>
                    )}
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{backupStats?.total || 0}</div>
                    <div className="text-sm text-gray-600">Total Backups</div>
                </div>
                <div className="bg-green-50 border border-green-100 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{backupStats?.manual || 0}</div>
                    <div className="text-sm text-gray-600">Manual Backups</div>
                </div>
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Latest Backup</div>
                    <div className="font-bold text-purple-600 text-sm">
                        {backupStats?.newestDate || 'No backups yet'}
                    </div>
                </div>
            </div>

            {/* Load Backups Button */}
            {backupHistory.length === 0 && (
                <div className="text-center py-8">
                    <button
                        onClick={async () => {
                            if (!user) return;
                            const history = await listBackups(user.uid);
                            setBackupHistory(history);
                            const stats = await getBackupStats(user.uid);
                            setBackupStats(stats);
                        }}
                        className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
                    >
                        <i className="fas fa-sync mr-2"></i>
                        Load Backup History
                    </button>
                </div>
            )}

            {/* Backup History Table */}
            {backupHistory.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Date Created</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-600">File Name</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {backupHistory.map((backup, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-700">{backup.createdAt}</td>
                                    <td className="px-4 py-3">
                                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                                            Manual
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{backup.name}</td>
                                    <td className="px-4 py-3 text-right">
                                        <a
                                            href={backup.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline font-medium"
                                        >
                                            <i className="fas fa-download mr-1"></i>
                                            Download
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-3">
                    <i className="fas fa-info-circle text-yellow-600 mt-0.5"></i>
                    <div className="text-sm text-yellow-800">
                        <strong className="block mb-1">Backup Information:</strong>
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong>Includes:</strong> Patients, OPD visits, Reports, Samples, Templates, Appointments, Doctors, and Branding settings</li>
                            <li><strong>Storage:</strong> Firebase Cloud Storage (secure and encrypted)</li>
                            <li><strong>Format:</strong> JSON file (can be restored anytime)</li>
                            <li><strong>Retention:</strong> Backups older than 90 days are automatically deleted</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
