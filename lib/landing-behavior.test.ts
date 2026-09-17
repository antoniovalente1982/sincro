import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clarityProjectId, CONSENT_MAX_AGE, readAnalyticsConsent, startLandingAnalytics, stopLandingAnalytics, trackLandingEvent, type LandingEvent } from './landing-behavior'

test('only project IDs can become a script URL', () => {
    assert.equal(clarityProjectId(' abc123def4 '), 'abc123def4')
    for (const input of [undefined, 123, '', 'https://attacker.example', '../secret', '<script>', 'abc123?token=x']) {
        assert.equal(clarityProjectId(input), null)
    }
})

test('malformed, expired and future-dated consent cannot enable recording', () => {
    const now = 2_000_000_000_000
    for (const raw of [null, '{', 'true', '{}', JSON.stringify({ choice: 'granted', at: now + 1 }), JSON.stringify({ choice: 'granted', at: now - CONSENT_MAX_AGE })]) {
        assert.equal(readAnalyticsConsent(raw, now), null)
    }
    for (const choice of ['granted', 'denied'] as const) {
        assert.equal(readAnalyticsConsent(JSON.stringify({ choice, at: now - 1000 }), now), choice)
    }
})

test('recorder is gated, events are allowlisted, withdrawal stops collection and regrant reuses one script', () => {
    assert.equal(startLandingAnalytics('abc123def4', 'granted'), false) // server
    const scripts: HTMLScriptElement[] = []
    const browser = {} as Window
    const currentClarity = () => browser.clarity
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    Object.defineProperty(globalThis, 'window', { value: browser, configurable: true })
    Object.defineProperty(globalThis, 'document', { value: {
        createElement: () => ({ dataset: {} }),
        head: { appendChild: (script: HTMLScriptElement) => scripts.push(script) },
    }, configurable: true })
    try {
        assert.equal(startLandingAnalytics('abc123def4', null), false)
        assert.equal(startLandingAnalytics('abc123def4', 'denied'), false)
        assert.equal(startLandingAnalytics('abc123def4', 'granted', true), false)
        trackLandingEvent('form_submit_attempt')
        assert.equal(scripts.length, 0)
        assert.equal(currentClarity(), undefined)

        assert.equal(startLandingAnalytics('abc123def4', 'granted'), true)
        assert.equal(scripts.length, 1)
        assert.equal(scripts[0].src, 'https://www.clarity.ms/tag/abc123def4')
        assert.deepEqual(browser.clarity?.q, [['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }]])
        trackLandingEvent('form_phone_focused')
        trackLandingEvent('email=private@example.test' as LandingEvent)
        assert.deepEqual(browser.clarity?.q?.at(-1), ['event', 'form_phone_focused'])

        stopLandingAnalytics(true)
        const queueLength = browser.clarity?.q?.length
        trackLandingEvent('form_submit_success')
        assert.equal(browser.clarity?.q?.length, queueLength)
        assert.deepEqual(browser.clarity?.q?.slice(-2), [
            ['consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' }], ['stop'],
        ])
        // Also covers remount/Strict Mode before the downloaded SDK is ready.
        assert.equal(startLandingAnalytics('abc123def4', 'granted'), true)
        assert.deepEqual(browser.clarity?.q?.slice(-2), [
            ['start'], ['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }],
        ])
        assert.equal(startLandingAnalytics('other12345', 'granted'), false)
        assert.equal(scripts.length, 1)

        browser.clarity = () => { throw new Error('SDK unavailable') }
        assert.doesNotThrow(() => trackLandingEvent('form_submit_error'))
        assert.doesNotThrow(() => stopLandingAnalytics(true))
    } finally {
        if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow)
        else Reflect.deleteProperty(globalThis, 'window')
        if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    }
})
