import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { prompt } = body;

        if (!prompt || typeof prompt !== 'string') {
            return NextResponse.json({ error: 'Prompt mancante o non valido' }, { status: 400 });
        }

        console.log(`Richiesta generazione immagine. Prompt: "${prompt}"`);

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: 'Configurazione Gemini API mancante' }, { status: 500 });
        }

        // Chiamata all'API Imagen 3 tramite Google Generative Language API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [
                    { prompt: `Photorealistic, super detailed, cinematic lighting, 8k quality, realistic photography of: ${prompt}` }
                ],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "9:16",
                    outputOptions: { mimeType: "image/jpeg" }
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini Imagen Error:', errorText);
            return NextResponse.json({ error: 'Errore generazione con Gemini' }, { status: 500 });
        }

        const data = await response.json();
        const base64Image = data?.predictions?.[0]?.bytesBase64Encoded;

        if (!base64Image) {
            return NextResponse.json({ error: 'Nessuna immagine generata' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            imageUrl: `data:image/jpeg;base64,${base64Image}`,
        });

    } catch (error) {
        console.error('Generazione Immagine API Error:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
