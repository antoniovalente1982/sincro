import { NextResponse } from 'next/server';
import { textToSpeechWithTimestamps } from '@/lib/elevenlabs';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Optional: Ensure the user is authenticated
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { text } = body;

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Testo mancante o non valido' }, { status: 400 });
        }

        // Generate the audio with Timestamps
        const ttsResult = await textToSpeechWithTimestamps(text);

        if (!ttsResult || !ttsResult.audioBase64) {
            return NextResponse.json({ error: 'Errore durante la generazione su ElevenLabs' }, { status: 500 });
        }

        // We receive characters, let's group them into Words so Remotion can render word by word easily.
        // ElevenLabs alignment: { characters: string[], character_start_times_seconds: number[], character_end_times_seconds: number[] }
        const { characters, character_start_times_seconds, character_end_times_seconds } = ttsResult.alignment;

        const words: { word: string, startMs: number, endMs: number }[] = [];
        let currentWord = '';
        let currentStart = -1;
        let currentEnd = -1;

        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            const start = character_start_times_seconds[i];
            const end = character_end_times_seconds[i];

            if (char === ' ' || char === '\n') {
                if (currentWord.trim().length > 0) {
                    words.push({ word: currentWord, startMs: currentStart * 1000, endMs: currentEnd * 1000 });
                    currentWord = '';
                    currentStart = -1;
                    currentEnd = -1;
                }
            } else {
                if (currentStart === -1) {
                    currentStart = start;
                }
                currentWord += char;
                currentEnd = end;
            }
        }

        // Push the last word if it didn't end with a space
        if (currentWord.trim().length > 0) {
            words.push({ word: currentWord, startMs: currentStart * 1000, endMs: currentEnd * 1000 });
        }

        return NextResponse.json({
            audioBase64: ttsResult.audioBase64,
            words: words
        });

    } catch (error) {
        console.error('Generazione Video Audio API Error:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
