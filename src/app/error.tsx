'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('⚠️ Global App Error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Error</h2>
            <p className="text-gray-600 mb-6">
                {error.message || 'Something went wrong.'}
            </p>
            <button
                onClick={() => reset()}
                className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
            >
                Try again
            </button>
        </div>
    );
}
