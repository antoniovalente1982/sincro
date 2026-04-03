import { NextResponse } from 'next/server'

// Cache models for 1 hour to avoid hitting OpenRouter on every request
let cachedModels: any[] | null = null
let cacheTime = 0
const CACHE_TTL = 3600000 // 1h

export async function GET() {
    const now = Date.now()
    
    if (cachedModels && now - cacheTime < CACHE_TTL) {
        return NextResponse.json({ models: cachedModels })
    }

    try {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            },
        })

        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 })
        }

        const data = await res.json()
        
        // Transform to a simpler shape for the frontend
        const models = (data.data || [])
            .filter((m: any) => m.id && m.name)
            .map((m: any) => ({
                id: m.id,
                name: m.name,
                description: m.description || '',
                context_length: m.context_length || 0,
                pricing: {
                    prompt: m.pricing?.prompt || '0',
                    completion: m.pricing?.completion || '0',
                },
                top_provider: m.top_provider?.max_completion_tokens || 4096,
                architecture: m.architecture?.modality || 'text',
            }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name))

        cachedModels = models
        cacheTime = now

        return NextResponse.json({ models })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
