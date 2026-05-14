'use client';
import React from 'react';

interface SkeletonTableProps {
    rows?: number;
    columns?: number;
}

export default function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
    return (
        <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-4">
            <div className="flex bg-gray-50 border-b border-gray-100 p-4 gap-4">
                {Array.from({ length: columns }).map((_, i) => (
                    <div key={i} className="h-3 bg-gray-200 rounded-full animate-pulse flex-1 max-w-[100px]"></div>
                ))}
            </div>
            <div className="divide-y divide-gray-50">
                {Array.from({ length: rows }).map((_, r) => (
                    <div key={r} className="flex p-4 gap-4 items-center">
                        {Array.from({ length: columns }).map((_, c) => (
                            <div key={c} className="flex-1">
                                <div className={`h-4 bg-gray-100 rounded animate-pulse w-${c === 0 ? '3/4' : 'full'} mb-2`}></div>
                                {c === 0 && <div className="h-3 bg-gray-50 rounded animate-pulse w-1/2"></div>}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
