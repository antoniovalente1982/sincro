import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEditorialReport, buildLeadEditorialJourney, editorialJourneyWindows, editorialReportWindow, paginateEditorialEvents, type EditorialReportEvent } from './editorial-report'

let sequence = 0
function event(event_name: EditorialReportEvent['event_name'], occurred_at: string, overrides: Partial<EditorialReportEvent> = {}): EditorialReportEvent {
    return { id: String(++sequence), event_name, occurred_at, entry_key: 'blog-uno', visitor_id: 'browser-a', page_path: '/blog/uno', submission_id: null, lead_id: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null, ...overrides }
}
const articles = [{ entryKey: 'blog-uno', title: 'Uno', href: '/blog/uno' }, { entryKey: 'blog-due', title: 'Due', href: '/blog/due' }]
const window = editorialReportWindow('2026-08-01', '2026-08-02', new Date('2026-09-19T12:00:00Z'))

test('il percorso conta soltanto eventi successivi alla visita dello stesso articolo, entro 30 giorni', () => {
    const report = buildEditorialReport([
        event('landing_view', '2026-08-01T09:00:00Z'),
        event('advertorial_view', '2026-08-01T10:00:00Z'),
        event('advertorial_view', '2026-08-01T11:00:00Z'),
        event('landing_view', '2026-08-03T10:00:00Z'),
        event('form_start', '2026-09-01T10:00:00Z'),
        event('lead_submitted', '2026-08-04T10:00:00Z', { submission_id: 'request-1', lead_id: 'lead-1' }),
        event('lead_submitted', '2026-09-01T10:00:00Z', { submission_id: 'request-late', lead_id: 'lead-2' }),
        event('landing_view', '2026-08-01T12:00:00Z', { entry_key: 'blog-due' }),
    ], articles, window)
    assert.deepEqual(report.rows[0].metrics, { views: 2, visitors: 1, engagedVisitors: 0, ctaVisitors: 0, landingVisitors: 1, formVisitors: 0, requestingVisitors: 1, requests: 1, contacts: 1, pendingRequests: 0, unobservedRequests: 0 })
    assert.equal(report.rows[1].metrics.landingVisitors, 0)
    assert.equal(report.maturing, false)
})

test('un browser in due articoli conta una volta nei totali e ogni articolo mantiene i propri eventi', () => {
    const report = buildEditorialReport([
        event('advertorial_view', '2026-08-01T10:00:00Z'),
        event('advertorial_view', '2026-08-01T11:00:00Z', { entry_key: 'blog-due' }),
        event('landing_view', '2026-08-01T12:00:00Z', { entry_key: 'blog-due' }),
        event('lead_submitted', '2026-08-01T13:00:00Z', { entry_key: 'blog-due', submission_id: 'request-1', lead_id: 'lead-1' }),
    ], articles, window)
    assert.equal(report.rows[0].metrics.requests, 0)
    assert.equal(report.rows[1].metrics.requests, 1)
    assert.equal(report.totals.views, 2)
    assert.equal(report.totals.visitors, 1)
    assert.equal(report.totals.requests, 1)
})

test('richieste ripetute restano distinte dai contatti unici e dai browser convertiti', () => {
    const submission = event('lead_submitted', '2026-08-01T13:00:00Z', { submission_id: 'request-1', lead_id: 'lead-1' })
    const report = buildEditorialReport([
        event('advertorial_view', '2026-08-01T10:00:00Z'), submission, submission,
        event('lead_submitted', '2026-08-01T14:00:00Z', { submission_id: 'request-2', lead_id: 'lead-1' }),
        event('lead_submitted', '2026-08-01T15:00:00Z', { submission_id: 'request-3' }),
    ], articles, window)
    assert.equal(report.totals.requests, 3)
    assert.equal(report.totals.contacts, 1)
    assert.equal(report.totals.requestingVisitors, 1)
    assert.equal(report.totals.pendingRequests, 1)
})

test('la provenienza dichiarata senza visita osservata non aumenta la conversione', () => {
    const report = buildEditorialReport([
        event('lead_submitted', '2026-08-01T09:00:00Z', { submission_id: 'before-visit' }),
        event('advertorial_view', '2026-08-01T10:00:00Z'),
        event('lead_submitted', '2026-08-01T11:00:00Z', { submission_id: 'no-consent', visitor_id: null }),
        event('lead_submitted', '2026-08-01T12:00:00Z', { submission_id: 'other-browser', visitor_id: 'browser-b' }),
    ], articles, window)
    assert.equal(report.totals.requests, 0)
    assert.equal(report.totals.requestingVisitors, 0)
    assert.equal(report.totals.unobservedRequests, 3)
})

test('filtri articolo, limite corrente e coorti ancora in osservazione', () => {
    const recent = editorialReportWindow('2026-09-18', '2026-09-19', new Date('2026-09-19T12:00:00Z'))
    const report = buildEditorialReport([
        event('advertorial_view', '2026-09-19T10:00:00Z'),
        event('advertorial_view', '2026-09-19T10:00:00Z', { entry_key: 'blog-due' }),
        event('lead_submitted', '2026-09-19T13:00:00Z', { submission_id: 'future' }),
    ], articles, recent, 'blog-uno')
    assert.equal(report.rows.length, 1)
    assert.equal(report.totals.requests, 0)
    assert.equal(report.maturing, true)
})

test('le date seguono il calendario italiano, con massimo 90 giorni e rifiuto di date invalide', () => {
    assert.equal(window.start, '2026-07-31T22:00:00.000Z')
    assert.equal(window.endExclusive, '2026-08-02T22:00:00.000Z')
    const defaultWindow = editorialReportWindow(null, null, new Date('2026-09-19T22:30:00Z'))
    assert.equal(defaultWindow.from, '2026-08-22')
    assert.equal(defaultWindow.to, '2026-09-20')
    assert.throws(() => editorialReportWindow('2026-02-30', '2026-03-01'), /Date/)
    assert.throws(() => editorialReportWindow('2026-01-01', '2026-09-19'), /90/)
    assert.throws(() => editorialReportWindow('2026-08-02', '2026-08-01'), /Date/)
    const dst = editorialReportWindow('2026-03-29', '2026-03-29', new Date('2026-09-19T12:00:00Z'))
    assert.equal(Date.parse(dst.endExclusive) - Date.parse(dst.start), 23 * 60 * 60 * 1000)
})

test('la cronologia collega soltanto il passato di ogni richiesta, senza richieste altrui o attività futura', () => {
    const request = event('lead_submitted', '2026-08-10T12:00:00Z', { submission_id: 'own', lead_id: 'lead-1' })
    const old = event('advertorial_view', '2026-07-01T10:00:00Z')
    const prior = event('advertorial_view', '2026-08-01T10:00:00Z')
    const future = event('advertorial_view', '2026-08-11T10:00:00Z')
    const other = event('lead_submitted', '2026-08-09T10:00:00Z', { submission_id: 'other', lead_id: 'lead-2' })
    const journey = buildLeadEditorialJourney([request], [old, prior, future, other, request], articles)
    assert.deepEqual(journey.events.map(item => item.id), [prior.id, request.id])
    assert.equal(journey.events[0].article?.title, 'Uno')
    assert.equal(journey.requests, 1)
    assert.equal(journey.observed, true)
})

test('senza consenso la cronologia mostra la richiesta senza inventare visite', () => {
    const request = event('lead_submitted', '2026-08-10T12:00:00Z', { submission_id: 'own', visitor_id: null, lead_id: 'lead-1' })
    const journey = buildLeadEditorialJourney([request], [event('advertorial_view', '2026-08-01T10:00:00Z')], articles)
    assert.equal(journey.events.length, 1)
    assert.equal(journey.observed, false)
})

test('le query della cronologia non leggono intervalli non pertinenti fra richieste lontane', () => {
    const requests = [
        event('lead_submitted', '2026-08-10T12:00:00Z'),
        event('lead_submitted', '2026-08-11T12:00:00Z'),
        event('lead_submitted', '2026-10-10T12:00:00Z'),
        event('lead_submitted', '2026-10-10T12:00:00Z', { visitor_id: null }),
    ]
    assert.deepEqual(editorialJourneyWindows(requests), [
        { visitor: 'browser-a', start: '2026-07-11T12:00:00.000Z', end: '2026-08-11T12:00:00.000Z' },
        { visitor: 'browser-a', start: '2026-09-10T12:00:00.000Z', end: '2026-10-10T12:00:00.000Z' },
    ])
})

test('la cronologia ordina gli istanti anche con offset di fuso diversi', () => {
    const request = event('lead_submitted', '2026-08-10T12:00:00Z', { lead_id: 'lead-1' })
    const first = event('advertorial_view', '2026-08-10T12:30:00+02:00')
    const second = event('landing_view', '2026-08-10T11:00:00Z')
    assert.deepEqual(buildLeadEditorialJourney([request], [second, first], articles).events.map(item => item.id), [first.id, second.id, request.id])
})

test('il coinvolgimento nella landing compare in cronologia senza aumentare gli arrivi', () => {
    const request = event('lead_submitted', '2026-08-01T12:00:00Z', { lead_id: 'lead-1' })
    const engaged = event('landing_engaged', '2026-08-01T11:00:00Z')
    const view = event('advertorial_view', '2026-08-01T10:00:00Z')
    const journey = buildLeadEditorialJourney([request], [view, engaged], articles)
    assert.equal(journey.events[1].label, 'Interazione con la landing')
    assert.equal(buildEditorialReport([request, view, engaged], articles, window).totals.landingVisitors, 0)
})

test('il report aggregato non espone identificatori di browser, richieste o contatti', () => {
    const request = event('lead_submitted', '2026-08-01T12:00:00Z', { submission_id: 'secret-request', lead_id: 'secret-contact' })
    const report = buildEditorialReport([event('advertorial_view', '2026-08-01T10:00:00Z'), request], articles, window)
    const json = JSON.stringify(report)
    for (const secret of ['browser-a', 'secret-request', 'secret-contact']) assert.equal(json.includes(secret), false)
})

test('la lettura paginata supera le 1000 righe e rifiuta risultati incompleti o errori', async () => {
    const rows = Array.from({ length: 1001 }, () => event('advertorial_view', '2026-08-01T10:00:00Z'))
    const result = await paginateEditorialEvents(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }))
    assert.equal(result.length, 1001)
    await assert.rejects(() => paginateEditorialEvents(async () => ({ data: rows.slice(0, 1000), error: null }), 1000), /Troppi/)
    await assert.rejects(() => paginateEditorialEvents(async () => ({ data: null, error: { message: 'database unavailable' } })), /caricare/)
})
