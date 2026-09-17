import assert from 'node:assert/strict'
import { test } from 'node:test'
import { advertorialConsultationHref } from './advertorial'

test('the consultation keeps campaign attribution and opens the existing form', () => {
    const url = new URL(advertorialConsultationHref('?utm_source=facebook&utm_campaign=123&utm_content=video%20A&fbclid=click123&fbadid=456'), 'https://landing.metodosincro.com')
    assert.equal(url.pathname, '/f/salto-di-qualita')
    assert.equal(url.hash, '#ms-form')
    assert.equal(url.searchParams.get('utm_campaign'), '123')
    assert.equal(url.searchParams.get('utm_content'), 'video A')
    assert.equal(url.searchParams.get('fbclid'), 'click123')
    assert.equal(url.searchParams.get('fbadid'), '456')
})

test('unknown query values cannot redirect the CTA or propagate contact details', () => {
    const url = new URL(advertorialConsultationHref('?next=https://example.org&email=private@example.org&phone=123&ab=B'), 'https://landing.metodosincro.com')
    assert.equal(url.origin, 'https://landing.metodosincro.com')
    assert.equal(url.searchParams.has('email'), false)
    assert.equal(url.searchParams.has('phone'), false)
    assert.equal(url.searchParams.has('next'), false)
    assert.equal(url.searchParams.has('ab'), false)
    assert.equal(url.searchParams.get('entry'), 'advertorial-pochi-minuti')
})

test('preview links stay outside the destination analytics', () => {
    const url = new URL(advertorialConsultationHref('?utm_source=test', true), 'https://landing.metodosincro.com')
    assert.equal(url.searchParams.get('ab'), 'A')
    assert.equal(url.searchParams.get('utm_source'), 'test')
})
