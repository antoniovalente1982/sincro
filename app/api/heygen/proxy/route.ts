import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const videoUrl = searchParams.get('url');

    if (!videoUrl) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        const response = await fetch(videoUrl);
        
        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch video' }, { status: response.status });
        }

        // Tunneling the body and overriding CORS headers
        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
        headers.set('Cache-Control', 'public, max-age=3600');

        return new NextResponse(response.body, {
            status: 200,
            headers,
        });
    } catch (e) {
        console.error('Proxy Fetch Error:', e);
        return NextResponse.json({ error: 'Proxy fetch failed' }, { status: 500 });
    }
}
