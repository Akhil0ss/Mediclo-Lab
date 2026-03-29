'use client';

import { useState } from 'react';

// Types for Google API
declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

interface GoogleDriveBackupProps {
    clientId: string;
    getData: () => Promise<any>;
    fileName: string;
    onSuccess?: () => void;
}

export default function GoogleDriveBackup({ clientId, getData, fileName, onSuccess }: GoogleDriveBackupProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadGoogleScript = () => {
        return new Promise((resolve) => {
            if (window.gapi) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => resolve(true);
            document.body.appendChild(script);
        });
    };

    const loadGisScript = () => {
        return new Promise((resolve) => {
            if (typeof window !== 'undefined' && window.google) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => resolve(true);
            document.body.appendChild(script);
        });
    };

    const handleUploadToDrive = async () => {
        setLoading(true);
        setError('');

        if (!clientId) {
            setError('Google Client ID not configured.');
            setLoading(false);
            return;
        }

        try {
            await Promise.all([loadGoogleScript(), loadGisScript()]);

            // Request Access Token using GIS
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: async (response: any) => {
                    if (response.error !== undefined) {
                        setError('Auth Error: ' + response.error);
                        setLoading(false);
                        return;
                    }
                    // Fetch Data AFTER Auth
                    const data = await getData();
                    if (!data) {
                        setError('Failed to generate backup data.');
                        setLoading(false);
                        return;
                    }
                    await uploadFile(response.access_token, data);
                },
            });

            // Request token, prompting for consent if needed
            tokenClient.requestAccessToken({ prompt: 'consent' });

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to authenticate with Google.');
            setLoading(false);
        }
    };

    const uploadFile = async (accessToken: string, data: any) => {
        try {
            const fileContent = JSON.stringify(data, null, 2);
            const file = new Blob([fileContent], { type: 'application/json' });

            const metadata = {
                name: fileName,
                mimeType: 'application/json',
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            // Use fetch for cleaner code than XHR
            const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + accessToken
                },
                body: form
            });

            if (res.ok) {
                const json = await res.json();
                alert(`Backup uploaded successfully! File ID: ${json.id}`);
                if (onSuccess) onSuccess();
            } else {
                const err = await res.text();
                setError('Upload failed: ' + err);
            }
        } catch (err: any) {
            console.error(err);
            setError('Error uploading file: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <button
                onClick={handleUploadToDrive}
                disabled={loading}
                className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 font-bold py-2 px-4 rounded-lg shadow-sm flex items-center gap-2 transition-all w-full justify-center"
            >
                {loading ? (
                    <i className="fas fa-spinner fa-spin"></i>
                ) : (
                    <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Drive" className="w-4 h-4" />
                )}
                {loading ? 'Uploading...' : 'Save to Google Drive'}
            </button>
        </div>
    );
}
