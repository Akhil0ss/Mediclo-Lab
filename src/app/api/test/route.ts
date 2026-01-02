import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json({
        success: true,
        message: 'Test route working',
        sessionId: 'test123',
        user: { role: 'doctor', name: 'Test' }
    });
}

export async function GET() {
    return NextResponse.json({ message: 'Use POST method' });
}
