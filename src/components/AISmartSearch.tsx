/**
 * AI Smart Search Component
 * 
 * Natural language search for medical records
 * Example: "Show diabetic patients from last month"
 * 
 * STAFF ONLY - Not visible to patients
 */

'use client';

import { useState } from 'react';
import { parseNaturalQuery } from '@/lib/groqAI';

interface AISmartSearchProps {
    onSearch: (filters: any) => void;
    placeholder?: string;
}

export default function AISmartSearch({ onSearch, placeholder }: AISmartSearchProps) {
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [parsedQuery, setParsedQuery] = useState<any>(null);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setSearching(true);
        try {
            const result = await parseNaturalQuery(query);
            setParsedQuery(result);
            onSearch(result.filters);
        } catch (err) {
            console.error(err);
            // Fallback to simple text search
            onSearch({ searchText: query });
        } finally {
            setSearching(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <i className={`fas ${searching ? 'fa-spinner fa-spin' : 'fa-brain'} text-purple-600`}></i>
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={placeholder || 'Ask anything... e.g., "Show diabetic patients from last month"'}
                    className="w-full pl-10 pr-24 py-3 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                    disabled={searching}
                />
                <button
                    onClick={handleSearch}
                    disabled={searching || !query.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                    {searching ? 'Searching...' : 'Search'}
                </button>
            </div>

            {/* Parsed Query Display */}
            {parsedQuery && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <i className="fas fa-lightbulb text-purple-600"></i>
                        <span className="text-sm font-semibold text-purple-800">AI understood:</span>
                    </div>
                    <p className="text-sm text-gray-700 italic">"{parsedQuery.intent}"</p>

                    {Object.keys(parsedQuery.filters).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {Object.entries(parsedQuery.filters).map(([key, value]: [string, any]) => {
                                if (!value) return null;
                                return (
                                    <span key={key} className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold">
                                        {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Quick Examples */}
            <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500">Try:</span>
                {[
                    'Show patients with diabetes',
                    'Reports from last week',
                    'Male patients aged 40-60',
                    'Pending lab samples'
                ].map((example, idx) => (
                    <button
                        key={idx}
                        onClick={() => setQuery(example)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition"
                    >
                        {example}
                    </button>
                ))}
            </div>
        </div>
    );
}
