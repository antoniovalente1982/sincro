import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getOrgContext } from '@/lib/org-context'
import { canAccessSection } from '@/lib/permissions'
import { buildFunnelRows, leadMilestones, type MetaAdRow } from '@/lib/funnel-report'
import FunnelReport from './FunnelReport'

export const metadata: Metadata = { title: 'Report Funnel | Gestionale Metodo Sincro', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const META_FIELDS = 'ad_id,ad_name,spend,impressions,reach,frequency,inline_link_clicks,actions,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions'
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const one = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v

/** Mezzanotte del giorno indicato a Roma, in UTC (gestisce ora legale e solare). */
function romeMidnight(day: string) {
    const guess = new Date(`${day}T00:00:00Z`)
    const rome = new Date(guess.toLocaleString('en-US', { timeZone: 'Europe/Rome' }))
    return new Date(guess.getTime() - (rome.getTime() - guess.getTime()))
}
const todayRome = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })

async function paginate<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
    const all: T[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await query(from, from + 999)
        if (error) throw new Error(error.message)
        all.push(...(data || []))
        if (!data || data.length < 1000) return all
    }
}

export default async function FunnelReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const supabase = await createClient()
    const org = await getOrgContext(supabase)
    if (!org) redirect('/login')
    if (!canAccessSection(org.role, org.department, 'funnels')) return <main style={{ padding: 32 }}><h1>Report non disponibile per il tuo ruolo.</h1></main>

    const params = await searchParams
    const db = getSupabaseAdmin()
    const orgId = org.organization_id

    // Funnel con campagne Meta collegate (settings.meta_campaign_ids)
    const { data: funnelRows } = await db.from('funnels').select('id, name, slug, settings, created_at').eq('organization_id', orgId).eq('status', 'active')
    const funnels = (funnelRows || []).filter(f => Array.isArray(f.settings?.meta_campaign_ids) && f.settings.meta_campaign_ids.length)
    const funnel = funnels.find(f => f.slug === one(params.funnel)) || funnels[0]
    if (!funnel) return <FunnelReport funnels={[]} error="Nessun funnel ha campagne Meta collegate (impostazione meta_campaign_ids)." />

    const campaignIds: string[] = funnel.settings.meta_campaign_ids
    const defaultFrom = isDate(funnel.settings.report_since) ? funnel.settings.report_since : funnel.created_at.slice(0, 10)
    const from = isDate(one(params.from)) ? one(params.from)! : defaultFrom
    const to = isDate(one(params.to)) ? one(params.to)! : todayRome()
    const since = romeMidnight(from).toISOString()
    const until = new Date(romeMidnight(to).getTime() + 86400000).toISOString()

    const errors: string[] = []

    // 1. Meta: metriche per annuncio delle campagne collegate
    let meta: MetaAdRow[] = []
    const { data: conn } = await db.from('connections').select('credentials').eq('organization_id', orgId).eq('provider', 'meta_ads').eq('status', 'active').maybeSingle()
    if (conn?.credentials?.access_token) {
        const url = new URL(`https://graph.facebook.com/v21.0/act_${conn.credentials.ad_account_id}/insights`)
        url.searchParams.set('fields', META_FIELDS)
        url.searchParams.set('level', 'ad')
        url.searchParams.set('time_range', JSON.stringify({ since: from, until: to }))
        url.searchParams.set('filtering', JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: campaignIds }]))
        url.searchParams.set('limit', '500')
        const res = await fetch(url, { headers: { Authorization: `Bearer ${conn.credentials.access_token}` }, cache: 'no-store' })
        const json = await res.json()
        if (json.error) errors.push(`Meta: ${json.error.message}`)
        else meta = json.data || []
    } else errors.push('Meta Ads non collegato: mancano spesa, video e clic.')

    // 2. Sito: visite e form iniziati (con consenso e anonimi)
    const [visits, formStarts, leads, stages] = await Promise.all([
        paginate<{ utm_content: string | null; fbadid: string | null }>((a, b) => db.from('page_views').select('utm_content, fbadid').eq('funnel_id', funnel.id).gte('created_at', since).lt('created_at', until).range(a, b)),
        paginate<{ utm_content: string | null; metadata: { fbadid?: string } | null }>((a, b) => db.from('editorial_events').select('utm_content, metadata').eq('funnel_id', funnel.id).eq('event_name', 'form_start').gte('occurred_at', since).lt('occurred_at', until).range(a, b)),
        // 3. CRM: lead del funnel e tappe raggiunte
        paginate<{ id: string; stage_id: string | null; meta_data: { utm_content?: string } | null }>((a, b) => db.from('leads').select('id, stage_id, meta_data').eq('funnel_id', funnel.id).gte('created_at', since).lt('created_at', until).range(a, b)),
        db.from('pipeline_stages').select('id, slug, is_won').eq('organization_id', orgId).then(r => r.data || []),
    ]).catch(err => { errors.push(`Database: ${err.message}`); return [[], [], [], []] as [never[], never[], never[], never[]] })

    const history = new Map<string, string[]>()
    const leadIds = leads.map(l => l.id)
    for (let i = 0; i < leadIds.length; i += 200) {
        const { data } = await db.from('lead_activities').select('lead_id, to_stage_id').in('lead_id', leadIds.slice(i, i + 200)).not('to_stage_id', 'is', null)
        for (const a of data || []) history.set(a.lead_id, [...(history.get(a.lead_id) || []), a.to_stage_id])
    }

    const report = buildFunnelRows(
        meta,
        visits,
        formStarts.map(f => ({ utm_content: f.utm_content, fbadid: f.metadata?.fbadid })),
        leads.map(l => ({ id: l.id, utm_content: l.meta_data?.utm_content || null, milestones: leadMilestones(l.stage_id, history.get(l.id) || [], stages) })),
    )

    return (
        <FunnelReport
            funnels={funnels.map(f => ({ slug: f.slug, name: f.name }))}
            funnelSlug={funnel.slug}
            funnelName={funnel.name}
            from={from}
            to={to}
            rows={report.rows}
            total={report.total}
            error={errors.join(' · ') || undefined}
        />
    )
}
