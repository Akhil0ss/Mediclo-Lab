import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

// Server-side only — NOT exposed to browser
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export async function POST(req: NextRequest) {
    if (!GROQ_API_KEY) {
        return NextResponse.json(
            { error: 'AI service not configured.' },
            { status: 503 }
        );
    }

    // AUTH CHECK: Verify request origin
    const origin = req.headers.get('origin') || req.headers.get('referer') || '';
    const isValidOrigin = origin.includes('localhost') || origin.includes('vercel.app') || origin.includes('mediclo');
    if (!isValidOrigin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { patientCount = 0, sampleCount = 0, reportCount = 0 } = body;

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
            return NextResponse.json({ suggestions });
        } catch {
            // If AI didn't return valid JSON, extract lines as suggestions
            const lines = text.split('\n').filter((l: string) => l.trim().length > 5).slice(0, 3);
            return NextResponse.json({ suggestions: lines });
        }

    } catch (error) {
        console.error('AI suggestions route error:', error);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
