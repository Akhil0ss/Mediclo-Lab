'use client';

import { ToastProvider } from '@/contexts/ToastContext';
import Intercom from '@/components/Intercom';

export default function PatientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ToastProvider>
            {children}
            <Intercom />
        </ToastProvider>
    );
}
