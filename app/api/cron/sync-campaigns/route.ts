import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Trigger the sync
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL 
        ? new URL(req.url).origin 
        : 'http://localhost:3000'

    const syncRes = await fetch(`${baseUrl}/api/meta/sync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cronSecret}`,
        },
    })

    const result = await syncRes.json()
    
    console.log('[CRON] Meta sync result:', JSON.stringify(result))
    
    return NextResponse.json({ 
        success: true,
        timestamp: new Date().toISOString(),
        ...result 
    })
}
