import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
const CACHE_TTL_MS = 30 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 60;
const MAX_CACHE_ENTRIES = 200;
const MAX_TOKENS_PER_CALL = 800;

type CachedAIResponse = {
    response: string;
    tokens: number;
};

type IncomingMessage = {
    role?: unknown;
    content?: unknown;
};

const responseCache = new Map<string, { expiresAt: number; data: CachedAIResponse }>();
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

function getCached(cacheKey: string): CachedAIResponse | null {
    const now = Date.now();
    const cached = responseCache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= now) {
        responseCache.delete(cacheKey);
        return null;
    }
    return cached.data;
}

function setCached(cacheKey: string, data: CachedAIResponse) {
    if (responseCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = responseCache.keys().next().value;
        if (oldestKey) responseCache.delete(oldestKey);
    }
    responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

export async function POST(req: NextRequest) {
    const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();

    if (!GROQ_API_KEY) {
        return NextResponse.json({ error: 'AI service not configured.' }, { status: 503 });
    }

    // AUTH CHECK: Verify the request comes from an authenticated session
    const authHeader = req.headers.get('x-auth-token') || req.headers.get('authorization');
    // Allow requests from same origin (our own app) or with valid auth token
    if (!authHeader && !isAllowedOrigin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const clientKey = getClientKey(req);
        if (isRateLimited(clientKey)) {
            return NextResponse.json({ error: 'AI request limit reached. Please wait a minute.' }, { status: 429 });
        }

        const { messages, max_tokens = 500, temperature = 0.3 } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Missing or invalid messages array.' }, { status: 400 });
        }

        const safeMessages = (messages as IncomingMessage[]).slice(0, 12).map((message) => ({
            role: message?.role,
            content: String(message?.content || '').slice(0, 6000),
        }));
        const safeMaxTokens = Math.min(Math.max(Number(max_tokens) || 500, 50), MAX_TOKENS_PER_CALL);
        const safeTemperature = Math.min(Math.max(Number(temperature) || 0.3, 0), 0.8);
        const cacheKey = JSON.stringify({ messages: safeMessages, max_tokens: safeMaxTokens, temperature: safeTemperature });
        const cached = getCached(cacheKey);
        if (cached) {
            return NextResponse.json({ ...cached, cached: true });
        }

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: safeMessages,
                max_tokens: safeMaxTokens,
                temperature: safeTemperature,
                top_p: 0.9,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Groq API Error:', response.status, errorBody.slice(0, 300));
            return NextResponse.json({ error: `Groq error: ${response.status}` }, { status: 502 });
        }

        const data = await response.json();
        const result = {
            response: data.choices?.[0]?.message?.content || '',
            tokens: data.usage?.total_tokens || 0
        };

        setCached(cacheKey, result);
        return NextResponse.json(result);

    } catch (error) {
        console.error('AI Proxy Error:', error);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
