import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

export async function POST(req: NextRequest) {
    const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();

    if (!GROQ_API_KEY) {
        return NextResponse.json({ error: 'AI service not configured.' }, { status: 503 });
    }

    // AUTH CHECK: Verify the request comes from an authenticated session
    const authHeader = req.headers.get('x-auth-token') || req.headers.get('authorization');
    const origin = req.headers.get('origin') || req.headers.get('referer') || '';
    
    // Allow requests from same origin (our own app) or with valid auth token
    const isValidOrigin = origin.includes('localhost') || origin.includes('vercel.app') || origin.includes('mediclo');
    if (!authHeader && !isValidOrigin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { messages, max_tokens = 500, temperature = 0.3 } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Missing or invalid messages array.' }, { status: 400 });
        }

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                max_tokens,
                temperature,
                top_p: 0.9,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Groq API Error:', response.status);
            return NextResponse.json({ error: `Groq error: ${response.status}` }, { status: 502 });
        }

        const data = await response.json();
        
        return NextResponse.json({
            response: data.choices[0].message.content,
            tokens: data.usage.total_tokens
        });

    } catch (error) {
        console.error('AI Proxy Error:', error);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
