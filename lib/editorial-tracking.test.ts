import test from 'node:test'
import assert from 'node:assert/strict'
import { readTrackingConsent, resolveEntry, resolvePixelId, normalizePageUrl, validateEditorialEvent, sessionIsCurrent, TRACKING_COOKIE, leadAttempt, actionTime } from './editorial-tracking'

const now = Date.parse('2026-09-19T12:00:00Z')
const id = '4d28e75c-5e0f-45a8-ae40-c54d93bf18b1'
test('consent expires and analytics does not imply marketing', () => {
    const c = { analytics: true, marketing: false, at: now }
    assert.deepEqual(readTrackingConsent(JSON.stringify(c), now), c)
    assert.equal(readTrackingConsent(JSON.stringify(c), now + 181 * 86400000), null)
    assert.equal(readTrackingConsent(JSON.stringify({ ...c, at: now + 1 }), now), null)
    assert.equal(readTrackingConsent('{bad', now), null)
    assert.equal(TRACKING_COOKIE, 'ms_tracking_consent_v1')
})
test('invalid explicit entry never falls back to a previously read article', () => {
    const saved = { entry: 'blog-uno', at: now - 1000 }
    assert.deepEqual(resolveEntry(null, saved, now), { entry: 'blog-uno', attribution: 'previous_visit' })
    assert.deepEqual(resolveEntry('blog-due', saved, now), { entry: 'blog-due', attribution: 'direct' })
    assert.equal(resolveEntry('bad', saved, now).entry, null)
    assert.equal(resolveEntry(null, { ...saved, at: now - 31 * 86400000 }, now).entry, null)
})
test('pixel comes from organization and rejects conflicting configuration', () => {
    assert.equal(resolvePixelId('', '311586900940615'), '311586900940615')
    assert.equal(resolvePixelId('311586900940615', '311586900940615'), '311586900940615')
    assert.throws(() => resolvePixelId('111111', '222222'), /Pixel/)
    assert.equal(resolvePixelId('script', null), null)
})
test('source URL keeps supported path, allowed campaign and entry only', () => {
    assert.equal(normalizePageUrl('https://landing.metodosincro.com/f/salto-di-qualita?entry=blog-uno&email=private%40test.it'), 'https://landing.metodosincro.com/f/salto-di-qualita?entry=blog-uno')
    assert.equal(normalizePageUrl('landing.metodosincro.com/f/salto-di-qualita'), 'https://landing.metodosincro.com/f/salto-di-qualita')
    assert.equal(normalizePageUrl('https://evil.test/f/salto-di-qualita'), null)
    assert.equal(normalizePageUrl('javascript:alert(1)'), null)
})
test('public endpoint only accepts supported stage/page pairs and valid identifiers', () => {
    const e = { event_id: id, visitor_id: id, session_id: id, event_name: 'advertorial_view', page_path: '/blog/uno' }
    assert.ok(validateEditorialEvent(e))
    assert.equal(validateEditorialEvent({ ...e, event_name: 'lead_submitted' }), null)
    assert.equal(validateEditorialEvent({ ...e, page_path: '/f/salto-di-qualita' }), null)
    assert.equal(validateEditorialEvent({ ...e, visitor_id: 'email@example.com' }), null)
    assert.equal(validateEditorialEvent({ ...e, page_path: '/blog/uno?ab=A' }), null)
    assert.ok(validateEditorialEvent({ ...e, event_name: 'landing_view', page_path: '/f/salto-di-qualita' }))
})
test('sessions roll over after 30 minutes and reject future timestamps', () => {
    assert.ok(sessionIsCurrent({ id, at: now - 1000 }, now))
    assert.equal(sessionIsCurrent({ id, at: now - 1800001 }, now), false)
    assert.equal(sessionIsCurrent({ id, at: now + 1 }, now), false)
})
test('a saved request retried with identical data retains its idempotency key', () => {
    const first = leadAttempt(null, 'same payload', () => 'first')
    assert.equal(leadAttempt(first, 'same payload', () => 'second').id, 'first')
    assert.equal(leadAttempt(first, 'different payload', () => 'second').id, 'second')
})
test('action time preserves ordering despite reversed network completion, bounds untrusted clocks', () => {
    const start = now - 5000
    assert.equal(actionTime(new Date(start).toISOString(), now), new Date(start).toISOString())
    assert.ok(actionTime(new Date(start).toISOString(), now) < actionTime(new Date(start+100).toISOString(), now-1000))
    assert.equal(actionTime('2020-01-01', now), new Date(now).toISOString())
    assert.equal(actionTime(new Date(now+60000).toISOString(), now), new Date(now).toISOString())
})
