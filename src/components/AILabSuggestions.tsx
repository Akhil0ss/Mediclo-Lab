'use client';

import { useState, useEffect } from 'react';
import { ref, get, query, limitToLast } from 'firebase/database';
import { database } from '@/lib/firebase';

const FALLBACK_TIPS: { icon: string; text: string }[] = [
    { icon: "fas fa-microscope", text: "Perform daily internal quality control (IQC) checks." },
    { icon: "fas fa-vial", text: "Rotate reagent stock using FIFO method." },
    { icon: "fas fa-clipboard-check", text: "Verify results exceeding critical alert limits." },
    { icon: "fas fa-thermometer-half", text: "Monitor and log incubator temperatures hourly." },
    { icon: "fas fa-tint", text: "Minimize pre-analytical errors in sample collection." },
];

export default function AILabSuggestions({ dataOwnerId }: { dataOwnerId: string }) {
    const [suggestions, setSuggestions] = useState<{icon: string, text: string}[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!dataOwnerId) return;

        const fetchSuggestions = async () => {
            // 1. Time-based scheduling (1 PM and 4 PM IST)
            const now = new Date();
            const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            const hours = istDate.getHours();
            const minutes = istDate.getMinutes();
            const todayStr = istDate.toISOString().split('T')[0];

            // Check cache first
            const cacheKey = `ai_lab_tips_v4_${dataOwnerId}_${todayStr}`;
            const cachedData = sessionStorage.getItem(cacheKey);
            const isRefreshWindow = (hours === 13 && minutes < 30) || (hours === 16 && minutes < 30);

            if (cachedData && !isRefreshWindow) {
                setSuggestions(JSON.parse(cachedData));
                setLoading(false);
                return;
            }

            try {
                // Fetch today's lab stats for context
                const reportsRef = query(ref(database, `reports/${dataOwnerId}`), limitToLast(20));
                const snapshot = await get(reportsRef);
                const reportCount = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;

                // Call secure server-side API route (Groq key NOT in browser bundle)
                const res = await fetch('/api/ai/suggestions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reportCount, patientCount: 0, sampleCount: 0 }),
                });

                if (res.ok) {
                    const data = await res.json();
                    const rawTips: string[] = data.suggestions || [];
                    const finalTips = rawTips.slice(0, 5).map((text: string) => ({
                        icon: 'fas fa-lightbulb',
                        text,
                    }));

                    if (finalTips.length > 0) {
                        setSuggestions(finalTips);
                        sessionStorage.setItem(cacheKey, JSON.stringify(finalTips));
                        setLoading(false);
                        return;
                    }
                }
            } catch {
                // Silent fail — show fallback
            }

            // Fallback tips if API unavailable
            setSuggestions(FALLBACK_TIPS);
            sessionStorage.setItem(cacheKey, JSON.stringify(FALLBACK_TIPS));
            setLoading(false);
        };

        fetchSuggestions();
    }, [dataOwnerId]);

    return (
        <div className="flex-1 mt-4 bg-slate-950/80 backdrop-blur-xl rounded-xl border border-white/20 p-3 flex flex-col min-h-0 overflow-hidden relative shadow-2xl">
            {/* Thematic gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none"></div>

            <div className="flex items-center gap-2 mb-3 w-full flex-shrink-0 px-1 relative z-10">
                <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-sm flex-shrink-0 border border-white/30">
                    <i className="fas fa-brain text-[11px] animate-pulse"></i>
                </div>
                <h4 className="font-bold text-white text-[12px] truncate tracking-wide uppercase drop-shadow-sm">Lab AI Insights</h4>
                <div className="flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded-full border border-white/30 ml-auto flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]"></span>
                    <span className="text-white text-[7px] font-bold uppercase tracking-tight">Active</span>
                </div>
                {loading && <i className="fas fa-spinner fa-spin text-white/50 text-[10px] ml-1"></i>}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-0.5">
                {!loading && suggestions.map((tip, i) => (
                    <div key={i} className="relative bg-white/15 backdrop-blur-md p-3.5 rounded-xl border border-white/10 hover:bg-white/20 transition-all group animate-in fade-in slide-in-from-bottom-2">
                        {/* Icon in corner */}
                        <div className="absolute top-2 right-2 opacity-40 group-hover:opacity-80 transition-opacity">
                            <i className={`${tip.icon || 'fas fa-lightbulb'} text-[10px] text-white`}></i>
                        </div>

                        {/* Full width text */}
                        <p className="text-[10.5px] font-medium text-white leading-relaxed pr-4 select-none drop-shadow-sm">
                            {tip.text}
                        </p>
                    </div>
                ))}

                {loading && (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-white/50 text-[10px] animate-pulse italic font-medium">Analyzing Lab Data...</div>
                    </div>
                )}
                {!loading && suggestions.length === 0 && (
                     <div className="h-full flex items-center justify-center text-white/50 text-[10px] italic text-center px-4">No insights available for this session.</div>
                )}
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
            `}</style>
        </div>
    );
}
