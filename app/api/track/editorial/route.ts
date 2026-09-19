import { after, NextRequest, NextResponse } from 'next/server'
import { readTrackingConsent, TRACKING_COOKIE, validateEditorialEvent } from '@/lib/editorial-tracking'
import { editorialBot, resolveEditorialPage, resolveEditorialEntry, saveEditorialEvent, sendEditorialMeta } from '@/lib/editorial-tracking-server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const limits = new Map<string,{ count: number; until: number }>()
export async function POST(req: NextRequest) {
    const origin = req.headers.get('origin')
    if (!origin || origin !== req.nextUrl.origin) return NextResponse.json({ error:'Origine non consentita.' }, { status:403 })
    if (editorialBot(req.headers.get('user-agent') || '')) return NextResponse.json({ skipped:'bot' })
    const key = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const now = Date.now(), limit = limits.get(key)
    if (limit && limit.until > now && limit.count >= 120) return NextResponse.json({ error:'Troppe richieste.' }, { status:429 })
    if (!limit || limit.until <= now) { if (limits.size > 5000) limits.clear(); limits.set(key,{count:1,until:now+60000}) } else limit.count++
    try {
        const raw = await req.text()
        if (raw.length > 6000) return NextResponse.json({ error:'Richiesta troppo grande.' }, { status:413 })
        const input = validateEditorialEvent(JSON.parse(raw))
        if (!input) return NextResponse.json({ error:'Evento non valido.' }, { status:400 })
        const consent = readTrackingConsent(decodeURIComponent(req.cookies.get(TRACKING_COOKIE)?.value || ''))
        if (!consent?.analytics && !consent?.marketing) return NextResponse.json({ skipped:'consent' })
        const found = await resolveEditorialPage(input.page_path)
        if (!found) return NextResponse.json({ error:'Pagina non disponibile.' }, { status:404 })
        const context = { ...found }
        if (!context.entry && input.entry) {
            const source = await resolveEditorialEntry(context.orgId,input.entry)
            context.entry = source?.entry || null; context.articleId = source?.articleId || null
        }
        const saved = await saveEditorialEvent(context,input,consent)
        if (consent.marketing) {
            const headers = new Headers(req.headers)
            after(async () => {
                try {
                    const result = await sendEditorialMeta(context,input,headers)
                    if (saved === 'saved') await getSupabaseAdmin().from('editorial_events').update({ metadata: { attribution: context.entry ? input.attribution : 'none', marketing_consent:true, page_variant:input.page_variant, received_at:new Date().toISOString(), meta:result } }).eq('organization_id',context.orgId).eq('event_id',input.event_id)
                } catch { console.error('[Editorial] Meta dispatch failed') }
            })
        }
        return NextResponse.json({ success:true, stored:saved })
    } catch (error) { console.error('[Editorial] Collection failed:', error instanceof Error ? error.message : 'unknown'); return NextResponse.json({ error:'Tracciamento non disponibile.' }, { status:503 }) }
}
