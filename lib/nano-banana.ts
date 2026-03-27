/**
 * Nano Banana 2 — Image Generation Client
 * 
 * Usa il modello Gemini 3.1 Flash Image Preview (Nano Banana 2)
 * per generare immagini ad alta qualità dalle creative pipeline.
 * 
 * Modello: gemini-3.1-flash-image-preview
 * API: Google Generative Language REST API
 * Formato output: PNG (base64)
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const MODEL = 'gemini-3.1-flash-image-preview'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export interface NanoBananaResult {
    success: boolean
    imageBuffer?: Buffer
    mimeType?: string
    error?: string
}

/**
 * Genera un'immagine ad per Meta Ads usando Nano Banana 2.
 * 
 * @param prompt - Il prompt descrittivo per l'immagine
 * @param aspectRatio - Aspect ratio (default: "4:5" per Meta feed)
 * @returns Buffer dell'immagine PNG + metadata
 */
export async function generateAdImage(
    prompt: string,
    aspectRatio: string = '4:5'
): Promise<NanoBananaResult> {
    if (!GEMINI_API_KEY) {
        return { success: false, error: 'GEMINI_API_KEY non configurata' }
    }

    try {
        const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseModalities: ['Image'],
                    imageConfig: {
                        aspectRatio: aspectRatio,
                    },
                },
            }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return {
                success: false,
                error: `API error ${response.status}: ${errorData?.error?.message || response.statusText}`,
            }
        }

        const data = await response.json()

        // Extract image from response
        const candidates = data.candidates || []
        if (candidates.length === 0) {
            return { success: false, error: 'Nessun candidato nella risposta' }
        }

        const parts = candidates[0]?.content?.parts || []
        const imagePart = parts.find((p: any) => p.inlineData)

        if (!imagePart?.inlineData?.data) {
            // Check if the response was blocked
            const blockReason = candidates[0]?.finishReason
            if (blockReason === 'SAFETY') {
                return { success: false, error: 'Immagine bloccata dal filtro safety — prova un prompt diverso' }
            }
            return { success: false, error: 'Nessuna immagine nella risposta' }
        }

        const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
        const mimeType = imagePart.inlineData.mimeType || 'image/png'

        return {
            success: true,
            imageBuffer,
            mimeType,
        }
    } catch (error: any) {
        return {
            success: false,
            error: `Errore generazione: ${error.message}`,
        }
    }
}

/**
 * Genera e carica un'immagine ad su Supabase Storage.
 * Restituisce l'URL pubblico dell'immagine.
 */
export async function generateAndUploadAdImage(
    prompt: string,
    orgId: string,
    fileName: string,
    aspectRatio: string = '4:5'
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // 1. Generate image
    const result = await generateAdImage(prompt, aspectRatio)
    if (!result.success || !result.imageBuffer) {
        return { success: false, error: result.error }
    }

    // 2. Upload to Supabase Storage
    const storagePath = `ad-creatives/${orgId}/${fileName}.png`
    const { error: uploadError } = await supabaseAdmin.storage
        .from('assets')
        .upload(storagePath, result.imageBuffer, {
            contentType: result.mimeType || 'image/png',
            upsert: true,
        })

    if (uploadError) {
        return { success: false, error: `Upload fallito: ${uploadError.message}` }
    }

    // 3. Get public URL
    const { data: urlData } = supabaseAdmin.storage
        .from('assets')
        .getPublicUrl(storagePath)

    return {
        success: true,
        imageUrl: urlData.publicUrl,
    }
}
