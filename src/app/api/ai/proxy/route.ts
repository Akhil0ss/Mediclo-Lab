import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
export async function POST(req: NextRequest) {
    const rawKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
    const GROQ_API_KEY = rawKey.trim();

    if (!GROQ_API_KEY) {
        console.warn('⚠️ AI Proxy: GROQ_API_KEY is missing in environment.');
        return NextResponse.json({ error: 'AI service not configured.' }, { status: 503 });
    }

    // Diagnostic logging for the user (visible in their terminal)
    console.log(`🤖 AI Proxy: Processing request using key (len: ${GROQ_API_KEY.length}, prefix: ${GROQ_API_KEY.slice(0, 7)}...)`);

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
            console.error('Groq API Error Detail:', errorBody);
            return NextResponse.json({ error: `Groq error: ${response.status}` }, { status: 502 });
        }

        const data = await response.json();
        
        return NextResponse.json({
            response: data.choices[0].message.content,
            tokens: data.usage.total_tokens
        });

    } catch (error) {
        console.error('AI Proxy Internal Error:', error);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
