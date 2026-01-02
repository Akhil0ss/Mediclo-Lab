'use client';

import { useEffect } from 'react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
    onClose: () => void;
}

export default function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[9999] animate-slide-up">
            <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 whitespace-nowrap">
                <i className="fas fa-info-circle text-lg"></i>
                <p className="font-semibold text-sm">{message}</p>
                <button
                    onClick={onClose}
                    className="text-white hover:text-gray-200 transition ml-2"
                >
                    <i className="fas fa-times"></i>
                </button>
            </div>
        </div>
    );
}
