import { NextResponse } from 'next/server';
import { textToSpeechWithTimestamps } from '@/lib/elevenlabs';
import { generateVideoVFXTags } from '@/lib/openrouter';
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

        // Generate the audio with Timestamps AND the AI tags in parallel for speed
        const [ttsResult, vfxData] = await Promise.all([
            textToSpeechWithTimestamps(text),
            generateVideoVFXTags(text)
        ]);

        if (!ttsResult || !ttsResult.audioBase64) {
            return NextResponse.json({ error: 'Errore durante la generazione su ElevenLabs' }, { status: 500 });
        }

        // We receive characters, let's group them into Words so Remotion can render word by word easily.
        const { characters, character_start_times_seconds, character_end_times_seconds } = ttsResult.alignment;

        const words: { word: string, startMs: number, endMs: number, emoji?: string, isImpact?: boolean }[] = [];
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

        if (currentWord.trim().length > 0) {
            words.push({ word: currentWord, startMs: currentStart * 1000, endMs: currentEnd * 1000 });
        }

        const vfxTags = vfxData.tags;
        
        // Map VFX tags from LLM to specific words
        for (let i = 0; i < words.length; i++) {
            const cleanWord = words[i].word.toLowerCase().replace(/[.,!?;:()]/g, '');
            const match = vfxTags.find(tag => tag.word.toLowerCase().replace(/[.,!?;:()]/g, '') === cleanWord);
            if (match) {
                words[i].emoji = match.emoji;
                words[i].isImpact = true;
                // Remove the match so it doesn't accidentally trigger twice for multiple same words in the script
                vfxTags.splice(vfxTags.indexOf(match), 1);
            }
        }

        // Map Visual Assets (Multi-layered Timeline)
        const visualAssets = vfxData.visualAssets.map(asset => {
            const cleanStart = asset.startWord.toLowerCase().replace(/[.,!?;:()]/g, '');
            const cleanEnd = asset.endWord.toLowerCase().replace(/[.,!?;:()]/g, '');

            const startIndex = words.findIndex(w => w.word.toLowerCase().replace(/[.,!?;:()]/g, '') === cleanStart);
            let endIndex = words.findIndex((w, i) => i > startIndex && w.word.toLowerCase().replace(/[.,!?;:()]/g, '') === cleanEnd);
            
            // Fallback se l'AI sbaglia le parole di endWord: fagli durare 2 secondi (approx 4 parole)
            if (endIndex === -1) endIndex = Math.min(words.length - 1, startIndex + 5);

            return {
                type: asset.type,
                query: asset.query,
                startMs: startIndex >= 0 ? words[startIndex].startMs : 0,
                endMs: endIndex >= 0 ? words[endIndex].endMs : (startIndex >= 0 ? words[startIndex].startMs + 2000 : 2000)
            };
        }).filter(a => a.startMs !== undefined && a.endMs !== undefined);

        return NextResponse.json({
            audioBase64: ttsResult.audioBase64,
            words: words,
            visualAssets: visualAssets
        });

    } catch (error) {
        console.error('Generazione Video Audio API Error:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
