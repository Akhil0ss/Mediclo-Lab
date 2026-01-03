'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('⚠️ Dashboard Runtime Error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100 max-w-md">
                <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-red-500">
                    <i className="fas fa-exclamation-triangle text-xl"></i>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong!</h2>
                <p className="text-sm text-gray-600 mb-6 break-words">
                    {error.message || 'An unexpected error occurred.'}
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => reset()}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition"
                    >
                        Try again
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-white text-gray-700 border border-gray-300 text-sm font-semibold rounded-lg hover:bg-gray-50 transition"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        </div>
    );
}
