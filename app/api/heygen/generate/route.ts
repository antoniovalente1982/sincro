import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
        const HEYGEN_AVATAR_ID = process.env.HEYGEN_AVATAR_ID;
        const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

        if (!HEYGEN_API_KEY || !HEYGEN_AVATAR_ID) {
            return NextResponse.json({ error: 'Chiavi HeyGen non configurate' }, { status: 500 });
        }

        const body = await req.json();
        const { text, title = "Hormozi 3.0 Generation" } = body;

        if (!text) {
            return NextResponse.json({ error: 'Testo script mancante' }, { status: 400 });
        }

        // Chiamata REST API HeyGen v2 per Generazione Video
        const response = await fetch('https://api.heygen.com/v2/video/generate', {
            method: 'POST',
            headers: {
                'X-Api-Key': HEYGEN_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                video_inputs: [
                    {
                        character: {
                            type: 'avatar',
                            avatar_id: HEYGEN_AVATAR_ID,
                            avatar_style: 'normal'
                        },
                        voice: {
                            type: 'text',
                            input_text: text,
                            voice_id: ELEVENLABS_VOICE_ID, // Use ElevenLabs Voice inside HeyGen
                        }
                    }
                ],
                test: true, // IMPORTANT: Evita consumi eccessivi in fase di sviluppo
                aspect_ratio: '9:16', // TikTok/Reels Layout
                title: title
            })
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            console.error('HeyGen API Error:', response.status, errorMsg);
            return NextResponse.json({ error: 'Errore durante la generazione su HeyGen', details: errorMsg }, { status: response.status });
        }

        const data = await response.json();
        /*
          Expected Response:
          { "error": null, "data": { "video_id": "xxxxx" } }
        */

        if (data.error) {
            return NextResponse.json({ error: data.error }, { status: 400 });
        }

        return NextResponse.json({ video_id: data.data.video_id });
    } catch (error) {
        console.error('Generazione HeyGen API Error:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
