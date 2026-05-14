'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';

/**
 * UX-03: Firebase connection status indicator.
 * Shows a warning banner when the real-time connection drops.
 */
export default function ConnectionStatus() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const connectedRef = ref(database, '.info/connected');
        const unsub = onValue(connectedRef, (snap) => {
            setIsOnline(snap.val() === true);
        });
        return () => unsub();
    }, []);

    if (isOnline) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-500">
            <div className="w-3 h-3 bg-red-300 rounded-full animate-pulse"></div>
            <span className="text-sm font-bold uppercase tracking-wider">Connection Lost — Reconnecting...</span>
        </div>
    );
}
