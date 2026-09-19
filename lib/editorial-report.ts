const DAY = 24 * 60 * 60 * 1000
export const EDITORIAL_LOOKBACK = 30 * DAY
export const EDITORIAL_EVENT_SELECT = 'id,event_name,visitor_id,entry_key,page_path,occurred_at,submission_id,lead_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term'

export type EditorialEventName = 'advertorial_view' | 'advertorial_engaged' | 'advertorial_cta' | 'landing_view' | 'landing_engaged' | 'form_start' | 'lead_submitted'
export interface EditorialReportEvent {
    id: string
    event_name: EditorialEventName
    visitor_id: string | null
    entry_key: string | null
    page_path: string
    occurred_at: string
    submission_id: string | null
    lead_id: string | null
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    utm_content: string | null
    utm_term: string | null
}
export interface EditorialArticle { entryKey: string; title: string; href: string }
export interface EditorialReportWindow { from: string; to: string; start: string; endExclusive: string; followUpEnd: string; now: string }
export interface EditorialMetrics {
    views: number; visitors: number; engagedVisitors: number; ctaVisitors: number
    landingVisitors: number; formVisitors: number; requestingVisitors: number
    requests: number; contacts: number; pendingRequests: number; unobservedRequests: number
}
export interface EditorialReport {
    window: EditorialReportWindow
    maturing: boolean
    rows: Array<EditorialArticle & { metrics: EditorialMetrics }>
    totals: EditorialMetrics
}

function calendarDay(value: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date non valide.')
    const date = Date.parse(`${value}T00:00:00Z`)
    if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== value) throw new Error('Date non valide.')
    return date
}
function romeMidnight(day: number): string {
    // At UTC midnight Rome is always on the correct civil date, including DST changes.
    const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' }).formatToParts(day).find(part => part.type === 'timeZoneName')?.value
    const hours = Number(offset?.match(/GMT\+(\d+)/)?.[1] || 1)
    return new Date(day - hours * 60 * 60 * 1000).toISOString()
}
export function editorialReportWindow(from?: string | null, to?: string | null, now = new Date()): EditorialReportWindow {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
    const last = calendarDay(to || today)
    const first = from ? calendarDay(from) : last - 29 * DAY
    if (first > last || last > calendarDay(today)) throw new Error('Date non valide: scegli un periodo concluso o fino a oggi.')
    if ((last - first) / DAY + 1 > 90) throw new Error('Seleziona un periodo di massimo 90 giorni.')
    const start = romeMidnight(first)
    const endExclusive = romeMidnight(last + DAY)
    return { from: new Date(first).toISOString().slice(0, 10), to: new Date(last).toISOString().slice(0, 10), start, endExclusive, followUpEnd: new Date(Math.min(now.getTime(), Date.parse(endExclusive) + EDITORIAL_LOOKBACK)).toISOString(), now: now.toISOString() }
}

function articleFromEntry(entry: string): EditorialArticle | null {
    if (entry === 'advertorial-pochi-minuti') return { entryKey: entry, title: 'Pochi minuti', href: '/f/pochi-minuti?ab=A' }
    if (/^blog-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry) && entry.length <= 110) return { entryKey: entry, title: entry.slice(5).replaceAll('-', ' '), href: `/blog/${entry.slice(5)}` }
    return null
}
type MetricSet = { views: Set<string>; visitors: Set<string>; engagedVisitors: Set<string>; ctaVisitors: Set<string>; landingVisitors: Set<string>; formVisitors: Set<string>; requestingVisitors: Set<string>; requests: Set<string>; contacts: Set<string>; pendingRequests: Set<string>; unobservedRequests: Set<string> }
function metricSets(): MetricSet {
    return { views: new Set(), visitors: new Set(), engagedVisitors: new Set(), ctaVisitors: new Set(), landingVisitors: new Set(), formVisitors: new Set(), requestingVisitors: new Set(), requests: new Set(), contacts: new Set(), pendingRequests: new Set(), unobservedRequests: new Set() }
}
function counts(sets: MetricSet): EditorialMetrics {
    return Object.fromEntries(Object.entries(sets).map(([key, value]) => [key, value.size])) as unknown as EditorialMetrics
}

export function buildEditorialReport(events: EditorialReportEvent[], articles: EditorialArticle[], window: EditorialReportWindow, entryFilter?: string | null): EditorialReport {
    const known = new Map(articles.map(article => [article.entryKey, article]))
    for (const event of events) {
        const article = event.entry_key && articleFromEntry(event.entry_key)
        if (article && !known.has(article.entryKey)) known.set(article.entryKey, article)
    }
    const selected = [...known.values()].filter(article => !entryFilter || article.entryKey === entryFilter)
    const metrics = new Map(selected.map(article => [article.entryKey, metricSets()]))
    const start = Date.parse(window.start), end = Date.parse(window.endExclusive), now = Date.parse(window.now)
    const cohort = new Map<string, Map<string, number>>()
    const uniqueEvents = [...new Map(events.map(event => [event.id, event])).values()]
    for (const event of uniqueEvents) {
        const at = Date.parse(event.occurred_at)
        const set = metrics.get(event.entry_key || '')
        if (!set || event.event_name !== 'advertorial_view' || at < start || at >= end || at > now || !Number.isFinite(at)) continue
        set.views.add(event.id)
        if (!event.visitor_id) continue
        set.visitors.add(event.visitor_id)
        const visits = cohort.get(event.entry_key!) || new Map<string, number>()
        visits.set(event.visitor_id, Math.min(visits.get(event.visitor_id) ?? Infinity, at))
        cohort.set(event.entry_key!, visits)
    }
    const eventMetric = { advertorial_engaged: 'engagedVisitors', advertorial_cta: 'ctaVisitors', landing_view: 'landingVisitors', form_start: 'formVisitors' } as const
    for (const event of uniqueEvents) {
        const set = metrics.get(event.entry_key || '')
        const at = Date.parse(event.occurred_at)
        if (!set || !Number.isFinite(at) || at > now) continue
        const first = event.visitor_id ? cohort.get(event.entry_key!)?.get(event.visitor_id) : undefined
        const observed = first !== undefined && at >= first && at <= first + EDITORIAL_LOOKBACK
        if (event.event_name === 'lead_submitted') {
            const request = event.submission_id || event.id
            if (observed) {
                set.requests.add(request)
                set.requestingVisitors.add(event.visitor_id!)
                if (event.lead_id) set.contacts.add(event.lead_id)
                else set.pendingRequests.add(request)
            } else if (at >= start && at < end) set.unobservedRequests.add(request)
        } else if (observed && event.event_name in eventMetric) {
            set[eventMetric[event.event_name as keyof typeof eventMetric]].add(event.visitor_id!)
        }
    }
    const total = metricSets()
    for (const sets of metrics.values()) for (const key of Object.keys(total) as Array<keyof MetricSet>) for (const value of sets[key]) total[key].add(value)
    return { window, maturing: [...cohort.values()].some(visits => [...visits.values()].some(at => at + EDITORIAL_LOOKBACK > now)), rows: selected.map(article => ({ ...article, metrics: counts(metrics.get(article.entryKey)!) })), totals: counts(total) }
}

export const EDITORIAL_EVENT_LABELS: Record<EditorialEventName, string> = {
    advertorial_view: 'Advertorial aperto', advertorial_engaged: 'Coinvolgimento nell’articolo', advertorial_cta: 'Clic verso la landing', landing_view: 'Arrivo sulla landing', landing_engaged: 'Interazione con la landing', form_start: 'Compilazione iniziata', lead_submitted: 'Richiesta inviata',
}
export interface EditorialJourneyEvent {
    id: string; name: EditorialEventName; label: string; occurredAt: string; pagePath: string
    article: EditorialArticle | null; source: string | null; medium: string | null; campaign: string | null
}
export interface LeadEditorialJourney { events: EditorialJourneyEvent[]; requests: number; observed: boolean }
export function editorialJourneyWindows(submissions: EditorialReportEvent[]): Array<{ visitor: string; start: string; end: string }> {
    const windows: Array<{ visitor: string; start: number; end: number }> = []
    const requests = submissions.filter(event => event.event_name === 'lead_submitted' && event.visitor_id).sort((a, b) => a.visitor_id!.localeCompare(b.visitor_id!) || Date.parse(a.occurred_at) - Date.parse(b.occurred_at))
    for (const request of requests) {
        const end = Date.parse(request.occurred_at)
        const start = end - EDITORIAL_LOOKBACK
        const previous = windows.at(-1)
        if (previous?.visitor === request.visitor_id && previous.end >= start) previous.end = Math.max(previous.end, end)
        else windows.push({ visitor: request.visitor_id!, start, end })
    }
    return windows.map(window => ({ visitor: window.visitor, start: new Date(window.start).toISOString(), end: new Date(window.end).toISOString() }))
}
export function buildLeadEditorialJourney(submissions: EditorialReportEvent[], priorEvents: EditorialReportEvent[], articles: EditorialArticle[]): LeadEditorialJourney {
    const linked = submissions.filter(event => event.event_name === 'lead_submitted')
    const byId = new Map(linked.map(event => [event.id, event]))
    for (const event of priorEvents) {
        if (event.event_name === 'lead_submitted' || !event.visitor_id) continue
        const at = Date.parse(event.occurred_at)
        if (linked.some(request => request.visitor_id === event.visitor_id && at <= Date.parse(request.occurred_at) && at >= Date.parse(request.occurred_at) - EDITORIAL_LOOKBACK)) byId.set(event.id, event)
    }
    const known = new Map(articles.map(article => [article.entryKey, article]))
    const events = [...byId.values()].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || a.id.localeCompare(b.id)).map(event => ({
        id: event.id, name: event.event_name, label: EDITORIAL_EVENT_LABELS[event.event_name], occurredAt: event.occurred_at,
        pagePath: event.page_path, article: event.entry_key ? known.get(event.entry_key) || articleFromEntry(event.entry_key) : null,
        source: event.utm_source, medium: event.utm_medium, campaign: event.utm_campaign,
    }))
    return { events, requests: new Set(linked.map(event => event.submission_id || event.id)).size, observed: events.some(event => event.name === 'advertorial_view') }
}

export async function paginateEditorialEvents(read: (from: number, to: number) => PromiseLike<{ data: EditorialReportEvent[] | null; error: unknown }>, maximum = 100_000): Promise<EditorialReportEvent[]> {
    const rows: EditorialReportEvent[] = []
    const size = 1000
    for (let from = 0; ; from += size) {
        const to = Math.min(from + size - 1, maximum)
        const { data, error } = await read(from, to)
        if (error || !data) throw new Error('Non è stato possibile caricare il percorso editoriale. Riprova.')
        if (rows.length + data.length > maximum) throw new Error('Troppi eventi per un report completo. Riduci il periodo o seleziona un articolo.')
        rows.push(...data)
        if (data.length < to - from + 1) return rows
    }
}
