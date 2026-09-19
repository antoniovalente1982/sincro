import test from 'node:test'
import assert from 'node:assert/strict'
import { getJourneySubmission, setJourneyConsent, sendJourneyEvent, synchronizeJourneyConsent } from './editorial-tracking-client'

test('denial avoids browser identity and network; granted analytics uses one persistent identity', async () => {
    const values = new Map<string,string>(), sent: string[] = []
    const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string,v: string) => values.set(key,v), removeItem: (key: string) => values.delete(key) }
    const documentMock = { cookie: '', head: { appendChild() {} }, createElement() { return {} } }
    Object.assign(globalThis, { window: { location: new URL('https://landing.metodosincro.com/blog/uno?utm_source=meta'), localStorage: storage, sessionStorage: storage, dispatchEvent() {} }, document: documentMock })
    const original = globalThis.fetch
    globalThis.fetch = (async (url: string) => { sent.push(url); return new Response('{}') }) as typeof fetch
    try {
        setJourneyConsent(false, false)
        await sendJourneyEvent('advertorial_view', null, true)
        assert.equal(sent.length, 0)
        assert.equal(getJourneySubmission().visitor_id, undefined)
        setJourneyConsent(true, false)
        await sendJourneyEvent('advertorial_view', null, true)
        const first = getJourneySubmission()
        const second = getJourneySubmission()
        assert.ok(first.visitor_id)
        assert.equal(first.visitor_id, second.visitor_id)
        assert.equal(first.extra_data.editorial_entry, 'blog-uno')
        assert.equal(sent.length, 1)
        setJourneyConsent(false, false)
        await sendJourneyEvent('advertorial_cta', null)
        assert.equal(sent.length, 1)
        setJourneyConsent(true, false)
        await sendJourneyEvent('advertorial_view', null, true)
        assert.equal(sent.length, 2)
        assert.notEqual(getJourneySubmission().visitor_id, first.visitor_id)
        const beforeCrossTab = getJourneySubmission().visitor_id
        values.delete('_sincro_vid')
        synchronizeJourneyConsent(true)
        await sendJourneyEvent('advertorial_view', null, true)
        assert.equal(sent.length, 3)
        assert.notEqual(getJourneySubmission().visitor_id, beforeCrossTab)
    } finally { globalThis.fetch = original }
})
