import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 20;
const MAX_CACHE_ENTRIES = 100;

// Server-side only — NOT exposed to browser
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const suggestionCache = new Map<string, { expiresAt: number; suggestions: string[] }>();
const rateBuckets = new Map<string, { resetAt: number; count: number }>();

function isAllowedOrigin(req: NextRequest): boolean {
    const source = req.headers.get('origin') || req.headers.get('referer') || '';
    if (!source) return true;

    try {
        const sourceOrigin = new URL(source).origin;
        if (sourceOrigin === req.nextUrl.origin) return true;
        return ['localhost', 'vercel.app', 'mediclo', 'spotnet.in'].some(host => sourceOrigin.includes(host));
    } catch {
        return false;
    }
}

function getClientKey(req: NextRequest): string {
    const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    return forwardedFor || req.headers.get('x-real-ip') || 'local';
}

function isRateLimited(key: string): boolean {
    const now = Date.now();
    const current = rateBuckets.get(key);
    if (!current || current.resetAt <= now) {
        rateBuckets.set(key, { resetAt: now + RATE_WINDOW_MS, count: 1 });
        return false;
    }

    current.count += 1;
    return current.count > RATE_LIMIT;
}

function getCached(cacheKey: string): string[] | null {
    const now = Date.now();
    const cached = suggestionCache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= now) {
        suggestionCache.delete(cacheKey);
        return null;
    }
    return cached.suggestions;
}

function setCached(cacheKey: string, suggestions: string[]) {
    if (suggestionCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = suggestionCache.keys().next().value;
        if (oldestKey) suggestionCache.delete(oldestKey);
    }
    suggestionCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, suggestions });
}

export async function POST(req: NextRequest) {
    if (!GROQ_API_KEY) {
        return NextResponse.json(
            { error: 'AI service not configured.' },
            { status: 503 }
        );
    }

    // AUTH CHECK: Verify request origin
    if (!isAllowedOrigin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const clientKey = getClientKey(req);
        if (isRateLimited(clientKey)) {
            return NextResponse.json({ error: 'AI request limit reached. Please wait a minute.' }, { status: 429 });
        }

        const body = await req.json();
        const { patientCount = 0, sampleCount = 0, reportCount = 0 } = body;
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = JSON.stringify({ today, patientCount, sampleCount, reportCount });
        const cached = getCached(cacheKey);
        if (cached) {
            return NextResponse.json({ suggestions: cached, cached: true });
        }

        const prompt = `You are a lab workflow assistant for a medical diagnostic lab in India. 
Based on today's stats: ${patientCount} patients registered, ${sampleCount} samples collected, ${reportCount} reports generated.
Give exactly 3 short, practical workflow tips (each under 15 words) to improve lab efficiency today.
Format: Return ONLY a JSON array of 3 strings. No markdown, no explanation.
Example: ["Tip 1 here", "Tip 2 here", "Tip 3 here"]`;

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200,
                temperature: 0.4,
            }),
        });

        if (!response.ok) {
            console.error('Groq API error:', response.status);
            return NextResponse.json({ error: 'AI service unavailable.' }, { status: 502 });
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '[]';

        // Parse the JSON array from response
        try {
            const suggestions = JSON.parse(text);
            if (Array.isArray(suggestions)) setCached(cacheKey, suggestions);
            return NextResponse.json({ suggestions });
        } catch {
            // If AI didn't return valid JSON, extract lines as suggestions
            const lines = text.split('\n').filter((l: string) => l.trim().length > 5).slice(0, 3);
            setCached(cacheKey, lines);
            return NextResponse.json({ suggestions: lines });
        }

    } catch (error) {
        console.error('AI suggestions route error:', error);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
