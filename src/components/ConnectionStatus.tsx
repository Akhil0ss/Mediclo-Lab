'use client';

import { useEffect, useRef, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';

/**
 * UX-03: Firebase connection status indicator.
 * Shows a warning banner only after a real disconnect, not during startup.
 */
export default function ConnectionStatus() {
    const [showOffline, setShowOffline] = useState(false);
    const hasConnectedOnce = useRef(false);
    const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const clearOfflineTimer = () => {
            if (offlineTimer.current) {
                clearTimeout(offlineTimer.current);
                offlineTimer.current = null;
            }
        };

        const scheduleOfflineBanner = () => {
            clearOfflineTimer();
            offlineTimer.current = setTimeout(() => {
                setShowOffline(true);
            }, 5000);
        };

        const connectedRef = ref(database, '.info/connected');
        const unsub = onValue(connectedRef, (snap) => {
            const connected = snap.val() === true;

            if (connected) {
                hasConnectedOnce.current = true;
                clearOfflineTimer();
                setShowOffline(false);
                return;
            }

            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                clearOfflineTimer();
                setShowOffline(true);
                return;
            }

            if (hasConnectedOnce.current) {
                scheduleOfflineBanner();
            } else {
                setShowOffline(false);
            }
        });

        const handleOffline = () => {
            clearOfflineTimer();
            setShowOffline(true);
        };

        const handleOnline = () => {
            clearOfflineTimer();
            setShowOffline(false);
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            clearOfflineTimer();
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
            unsub();
        };
    }, []);

    if (!showOffline) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-500">
            <div className="w-3 h-3 bg-red-300 rounded-full animate-pulse"></div>
            <span className="text-sm font-bold uppercase tracking-wider">Connection Lost - Reconnecting...</span>
        </div>
    );
}
