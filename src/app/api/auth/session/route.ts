import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('medos_auth_token');

        if (!token || !token.value) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        const decodedString = Buffer.from(token.value, 'base64').toString('utf-8');
        const sessionData = JSON.parse(decodedString);

        return NextResponse.json({ authenticated: true, user: sessionData });
    } catch (e) {
        return NextResponse.json({ authenticated: false, error: 'Invalid Session Token' }, { status: 401 });
    }
}
