import { NextResponse } from 'next/server';
import { textToSpeechWithTimestamps } from '@/lib/elevenlabs';
import { generateVideoVFXTags } from '@/lib/openrouter';
import { createClient } from '@/lib/supabase/server';

// ElevenLabs TTS + OpenRouter VFX in parallel can take 20-40s for long scripts
export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { text, voiceId } = body;

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Testo mancante o non valido' }, { status: 400 });
        }

        // Generate audio + AI VFX tags in parallel
        const [ttsResult, vfxData] = await Promise.all([
            textToSpeechWithTimestamps(text, voiceId),
            generateVideoVFXTags(text)
        ]);

        if (!ttsResult || !ttsResult.audioBase64) {
            return NextResponse.json({ error: 'Errore durante la generazione su ElevenLabs' }, { status: 500 });
        }

        // Parse characters into words
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
                if (currentStart === -1) currentStart = start;
                currentWord += char;
                currentEnd = end;
            }
        }
        if (currentWord.trim().length > 0) {
            words.push({ word: currentWord, startMs: currentStart * 1000, endMs: currentEnd * 1000 });
        }

        // Map VFX tags to words
        const vfxTags = vfxData.tags;
        for (let i = 0; i < words.length; i++) {
            const cleanWord = words[i].word.toLowerCase().replace(/[.,!?;:()]/g, '');
            const match = vfxTags.find(tag => tag.word.toLowerCase().replace(/[.,!?;:()]/g, '') === cleanWord);
            if (match) {
                words[i].emoji = match.emoji;
                words[i].isImpact = true;
                vfxTags.splice(vfxTags.indexOf(match), 1);
            }
        }

        // Map visual assets to timeline — passa TUTTE le proprietà per i nuovi componenti
        const visualAssets = vfxData.visualAssets.map(asset => {
            const cleanStart = asset.startWord.toLowerCase().replace(/[.,!?;:()]/g, '');
            const cleanEnd = asset.endWord.toLowerCase().replace(/[.,!?;:()]/g, '');

            const startIndex = words.findIndex(w => w.word.toLowerCase().replace(/[.,!?;:()]/g, '') === cleanStart);
            let endIndex = words.findIndex((w, i) => i > startIndex && w.word.toLowerCase().replace(/[.,!?;:()]/g, '') === cleanEnd);
            
            // Se è il CTA, posizionalo alla fine del video
            if (asset.type === 'cta' && endIndex === -1) {
                endIndex = words.length - 1;
            }
            if (endIndex === -1) endIndex = Math.min(words.length - 1, startIndex + 5);

            return {
                type: asset.type,
                query: asset.query,
                variant: asset.variant,
                position: asset.position,
                imageUrl: (asset as any).imageUrl,
                // Nuove props 5.0
                line2: asset.line2,
                highlightWord: asset.highlightWord,
                textStyle: asset.textStyle,
                color: asset.color,
                toValue: asset.toValue,
                emojis: asset.emojis,
                intensity: asset.intensity,
                // Timing
                startMs: startIndex >= 0 ? words[startIndex].startMs : 0,
                endMs: endIndex >= 0 ? words[endIndex].endMs : (startIndex >= 0 ? words[startIndex].startMs + 2000 : 2000)
            };
        }).filter(a => a.startMs !== undefined && a.endMs !== undefined);

        return NextResponse.json({
            audioBase64: ttsResult.audioBase64,
            words: words,
            visualAssets: visualAssets,
            backgroundMood: vfxData.backgroundMood || 'warm-studio',
        });

    } catch (error) {
        console.error('Generazione Video Audio API Error:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}

