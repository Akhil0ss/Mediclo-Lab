'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '@/components/Toast';

interface ToastContextType {
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info'; duration?: number } | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 2000) => {
        setToast({ message, type, duration });
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                    duration={toast.duration}
                />
            )}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
