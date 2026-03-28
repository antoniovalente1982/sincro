import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
        const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

        if (!HEYGEN_API_KEY) {
            return NextResponse.json({ error: 'Chiavi HeyGen non configurate' }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const video_id = searchParams.get('video_id');

        if (!video_id) {
            return NextResponse.json({ error: 'Video ID mancante' }, { status: 400 });
        }

        // Chiamata REST API HeyGen v1 per Controllo Status
        const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${video_id}`, {
            method: 'GET',
            headers: {
                'X-Api-Key': HEYGEN_API_KEY,
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            console.error('HeyGen Status API Error:', response.status, errorMsg);
            return NextResponse.json({ error: 'Errore durante la verifica su HeyGen', details: errorMsg }, { status: response.status });
        }

        const data = await response.json();
        
        /* Expected Returns from HeyGen V1 Status:
           {
             code: 100,
             data: {
               status: "processing" | "completed" | "failed" | "pending",
               video_url: "https://...."
             }
           }
        */
        if (data.code !== 100) {
            return NextResponse.json({ error: data.message || 'Errore HeyGen' }, { status: 400 });
        }

        return NextResponse.json({
            status: data.data.status,
            video_url: data.data.video_url || null,
            error: data.data.error || null
        });

    } catch (error) {
        console.error('HeyGen Status Error:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
