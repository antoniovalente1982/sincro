import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 10

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const vpsUrl = process.env.HERMES_VPS_URL || 'http://76.13.136.176:8643'
        fetch(`${vpsUrl}/trigger?action=pulse`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ type: 'cron_trigger_pulse' })
        }).catch(e => console.error(e))

        return NextResponse.json({ ok: true, message: 'VPS Hermes Pulse Cron Triggered' })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
