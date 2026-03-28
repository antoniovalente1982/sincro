const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// Read custom cloned voice from ENV ("Antonio Valente" etc), fallback to "Brando M"
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'o5tUAYEqld5GJZ1Lv8uC'
const MODEL_ID = 'eleven_multilingual_v2'

/**
 * Convert text to speech using ElevenLabs API
 * Returns an audio buffer (mp3)
 */
export async function textToSpeech(text: string): Promise<Uint8Array | null> {
    if (!ELEVENLABS_API_KEY) {
        console.error('ElevenLabs API key not configured')
        return null
    }

    // Limit text length for TTS (Telegram voice messages should be concise)
    const truncatedText = text.length > 2000 ? text.substring(0, 2000) + '...' : text

    // Strip HTML tags for TTS
    const cleanText = truncatedText
        .replace(/<[^>]*>/g, '')               // HTML tags
        .replace(/\[ACTION:\{[\s\S]*?\}\]/g, '') // ACTION tags (should not be read aloud)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Currency: €132.43 → '132 euro' (drop cents for clean speech)
        .replace(/€\s*(\d+)[.,]\d+/g, '$1 euro')
        .replace(/€\s*(\d+)/g, '$1 euro')
        .replace(/\$\s*(\d+)[.,]\d+/g, '$1 dollari')
        .replace(/\$\s*(\d+)/g, '$1 dollari')
        .replace(/£\s*(\d+)[.,]\d+/g, '$1 sterline')
        .replace(/£\s*(\d+)/g, '$1 sterline')
        .replace(/€/g, ' euro ')
        // Clean up decimal separators in remaining numbers (132,43 → 132)
        .replace(/(\d+)[.,](\d{1,2})\s*euro/g, '$1 euro')
        .replace(/\s{2,}/g, ' ')
        // Remove emoji that TTS tries to pronounce
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
        // Clean up formatting artifacts
        .replace(/\|/g, ', ')                   // pipe separators → comma
        .replace(/━+/g, '')                     // horizontal rules
        .replace(/#{1,3}\s*/g, '')              // markdown headers
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // markdown bold/italic
        .replace(/N\/A/g, 'non disponibile')    // N/A → spoken form
        // Format phone numbers with spaces for clearer pronunciation (3358455317 → 335 845 5317)
        .replace(/(\d{3})(\d{3,4})(\d{3,4})/g, '$1 $2 $3')
        // Format large numbers: 2250 → 2.250 for Italian reading
        .replace(/\n{3,}/g, '\n\n')            // collapse triple+ newlines
        .trim()

    try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text: cleanText,
                model_id: MODEL_ID,
                voice_settings: {
                    stability: 0.92,        // Alta stabilità → voce ferma, diretta, zero emotività eccessiva
                    similarity_boost: 0.8,
                    style: 0.0,             // Zero stile → niente oscillazioni emotive, tono piatto e professionale
                    use_speaker_boost: true,
                    speed: 1.1,
                },
            }),
        })

        if (!res.ok) {
            const errorText = await res.text()
            console.error('ElevenLabs TTS error:', res.status, errorText)
            return null
        }

        const arrayBuffer = await res.arrayBuffer()
        return new Uint8Array(arrayBuffer)
    } catch (err) {
        console.error('ElevenLabs TTS error:', err)
        return null
    }
}

/**
 * Enhanced TTS that returns both the audio and precise character/word timestamps.
 * Returns an object with the base64 audio and word timings array.
 */
export async function textToSpeechWithTimestamps(text: string): Promise<{ audioBase64: string, alignment: any } | null> {
    if (!ELEVENLABS_API_KEY) {
        console.error('ElevenLabs API key not configured');
        return null;
    }

    const cleanText = text.replace(/<[^>]*>/g, '').trim();

    try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}/with-timestamps`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Accept': 'application/json', // We request JSON because the response contains audio_base64 + alignment object
            },
            body: JSON.stringify({
                text: cleanText,
                model_id: MODEL_ID,
                voice_settings: {
                    stability: 0.92,
                    similarity_boost: 0.8,
                    style: 0.0,
                    use_speaker_boost: true,
                    speed: 1.0, // For video sync, standard speed is usually safer
                },
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('ElevenLabs TTS with Timestamps error:', res.status, errorText);
            return null;
        }

        const data = await res.json();
        // data looks like: { audio_base64: '...', alignment: { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] } }
        return {
            audioBase64: data.audio_base64,
            alignment: data.alignment,
        };
    } catch (err) {
        console.error('ElevenLabs TTS Timestamps error:', err);
        return null;
    }
}

/**
 * Transcribe a voice message to text using ElevenLabs Speech-to-Text
 * Accepts an audio buffer (ogg/wav/mp3)
 */
export async function speechToText(audioBuffer: Uint8Array, mimeType: string = 'audio/ogg'): Promise<string | null> {
    if (!ELEVENLABS_API_KEY) {
        console.error('ElevenLabs API key not configured')
        return null
    }

    try {
        // Use ElevenLabs STT API
        const formData = new FormData()
        const blob = new Blob([audioBuffer as any], { type: mimeType })
        formData.append('file', blob, 'audio.ogg')
        formData.append('model_id', 'scribe_v1')
        formData.append('language_code', 'ita')

        const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
            method: 'POST',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: formData,
        })

        if (!res.ok) {
            const errorText = await res.text()
            console.error('ElevenLabs STT error:', res.status, errorText)
            return null
        }

        const data = await res.json()
        return data.text || null
    } catch (err) {
        console.error('ElevenLabs STT error:', err)
        return null
    }
}
