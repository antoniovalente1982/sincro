/**
 * Report del funnel per annuncio: unisce Meta (spesa, video, clic, Lead),
 * sito (visite, form iniziati) e CRM (lead, appuntamenti, show-up, vendite).
 * L'annuncio si riconosce dal nome, che arriva come utm_content sul sito e nel lead.
 */

export interface MetaAdRow {
    ad_id: string
    ad_name: string
    spend?: string
    impressions?: string
    reach?: string
    frequency?: string
    inline_link_clicks?: string
    actions?: { action_type: string; value: string }[]
    video_thruplay_watched_actions?: { action_type: string; value: string }[]
    video_p25_watched_actions?: { action_type: string; value: string }[]
    video_p50_watched_actions?: { action_type: string; value: string }[]
    video_p75_watched_actions?: { action_type: string; value: string }[]
    video_p95_watched_actions?: { action_type: string; value: string }[]
}

export interface SiteEvent { utm_content: string | null; fbadid?: string | null }
export interface CrmLead { id: string; utm_content: string | null; milestones: { appointment: boolean; showUp: boolean; sale: boolean } }

export interface FunnelRow {
    key: string
    label: string
    spend: number
    impressions: number
    reach: number
    videoViews3s: number
    thruplays: number
    p25: number; p50: number; p75: number; p95: number
    linkClicks: number
    metaLeads: number
    visits: number
    formStarts: number
    leads: number
    appointments: number
    showUps: number
    sales: number
}

const num = (v?: string | number | null) => Number(v) || 0
const actionValue = (list: { action_type: string; value: string }[] | undefined, ...types: string[]) =>
    num(list?.find(a => types.includes(a.action_type))?.value)
const firstValue = (list?: { action_type: string; value: string }[]) => num(list?.[0]?.value)

export const UNATTRIBUTED = '__senza_annuncio__'

function emptyRow(key: string, label: string): FunnelRow {
    return { key, label, spend: 0, impressions: 0, reach: 0, videoViews3s: 0, thruplays: 0, p25: 0, p50: 0, p75: 0, p95: 0, linkClicks: 0, metaLeads: 0, visits: 0, formStarts: 0, leads: 0, appointments: 0, showUps: 0, sales: 0 }
}

export function buildFunnelRows(meta: MetaAdRow[], visits: SiteEvent[], formStarts: SiteEvent[], leads: CrmLead[]) {
    const rows = new Map<string, FunnelRow>()
    const byId = new Map<string, string>()
    for (const ad of meta) {
        const row = rows.get(ad.ad_name) || emptyRow(ad.ad_name, ad.ad_name)
        row.spend += num(ad.spend)
        row.impressions += num(ad.impressions)
        row.reach += num(ad.reach)
        row.videoViews3s += actionValue(ad.actions, 'video_view')
        row.thruplays += firstValue(ad.video_thruplay_watched_actions)
        row.p25 += firstValue(ad.video_p25_watched_actions)
        row.p50 += firstValue(ad.video_p50_watched_actions)
        row.p75 += firstValue(ad.video_p75_watched_actions)
        row.p95 += firstValue(ad.video_p95_watched_actions)
        row.linkClicks += num(ad.inline_link_clicks)
        row.metaLeads += actionValue(ad.actions, 'offsite_conversion.fb_pixel_lead', 'lead')
        rows.set(ad.ad_name, row)
        byId.set(ad.ad_id, ad.ad_name)
    }
    // Il sito e il CRM conoscono l'annuncio dal nome (utm_content) o, in mancanza, dall'ID
    const keyFor = (e: { utm_content: string | null; fbadid?: string | null }) => {
        if (e.utm_content && rows.has(e.utm_content)) return e.utm_content
        if (e.fbadid && byId.has(e.fbadid)) return byId.get(e.fbadid)!
        return UNATTRIBUTED
    }
    const rowFor = (key: string) => {
        if (!rows.has(key)) rows.set(key, emptyRow(key, 'Senza annuncio (traffico organico o senza consenso)'))
        return rows.get(key)!
    }
    for (const v of visits) rowFor(keyFor(v)).visits++
    for (const f of formStarts) rowFor(keyFor(f)).formStarts++
    for (const l of leads) {
        const row = rowFor(keyFor(l))
        row.leads++
        if (l.milestones.appointment) row.appointments++
        if (l.milestones.showUp) row.showUps++
        if (l.milestones.sale) row.sales++
    }
    const list = [...rows.values()].sort((a, b) => (a.key === UNATTRIBUTED ? 1 : 0) - (b.key === UNATTRIBUTED ? 1 : 0) || b.spend - a.spend)
    const total = list.reduce((t, r) => {
        for (const k of Object.keys(t) as (keyof FunnelRow)[]) if (typeof t[k] === 'number') (t[k] as number) += r[k] as number
        return t
    }, emptyRow('__totale__', 'Totale'))
    return { rows: list, total }
}

/** Rapporto in percentuale; null se il denominatore è zero (mostrato come "—", non come 0%). */
export const pct = (part: number, whole: number) => whole > 0 ? (part / whole) * 100 : null
/** Costo per unità; null se non ci sono unità. */
export const costPer = (spend: number, units: number) => units > 0 ? spend / units : null

/**
 * Tappe raggiunte da un lead nella pipeline: vale lo stato attuale o uno stato
 * passato (dallo storico), così chi è passato da Appuntamento a Perso conta ancora.
 */
export function leadMilestones(
    currentStageId: string | null,
    historyStageIds: string[],
    stages: { id: string; slug: string; is_won: boolean }[],
) {
    const bySlug = (id: string) => stages.find(s => s.id === id)
    const reached = [currentStageId, ...historyStageIds].filter(Boolean).map(id => bySlug(id!)).filter(Boolean) as { slug: string; is_won: boolean }[]
    const has = (...slugs: string[]) => reached.some(s => slugs.some(x => s.slug.startsWith(x)))
    const sale = reached.some(s => s.is_won)
    const showUp = sale || has('show-up', 'prova')
    const appointment = showUp || has('appuntamento')
    return { appointment, showUp, sale }
}
