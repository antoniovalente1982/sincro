import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

        if (!HEYGEN_API_KEY) {
            return NextResponse.json({ error: 'HEYGEN_API_KEY non configurata' }, { status: 500 });
        }

        const response = await fetch('https://api.heygen.com/v2/avatars', {
            headers: {
                'X-Api-Key': HEYGEN_API_KEY,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            console.error('HeyGen Avatars API Error:', response.status, errorMsg);
            return NextResponse.json({ error: 'Errore nel recupero degli avatar' }, { status: response.status });
        }

        const data = await response.json();
        
        // Estrai gli avatar e ritorna solo i campi necessari
        const avatars = (data.data?.avatars || []).map((avatar: any) => ({
            avatar_id: avatar.avatar_id,
            avatar_name: avatar.avatar_name || 'Senza nome',
            preview_image_url: avatar.preview_image_url || null,
            gender: avatar.gender || 'unknown',
        }));

        return NextResponse.json({ avatars });
    } catch (error) {
        console.error('HeyGen List Avatars Error:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
