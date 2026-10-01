import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFunnelRows, leadMilestones, pct, costPer, UNATTRIBUTED } from './funnel-report'

const stages = [
    { id: 'lead', slug: 'lead', is_won: false }, { id: 'app', slug: 'appuntamento', is_won: false },
    { id: 'show', slug: 'show-up', is_won: false }, { id: 'sale', slug: 'vendita', is_won: true }, { id: 'lost', slug: 'perso', is_won: false },
]

test('una tappa raggiunta resta contata anche se il lead poi è perso', () => {
    assert.deepEqual(leadMilestones('lost', ['app'], stages), { appointment: true, showUp: false, sale: false })
    assert.deepEqual(leadMilestones('sale', [], stages), { appointment: true, showUp: true, sale: true })
    assert.deepEqual(leadMilestones('lead', [], stages), { appointment: false, showUp: false, sale: false })
})

test('sito e CRM si agganciano all annuncio per nome o per ID, il resto va in "senza annuncio"', () => {
    const meta = [{ ad_id: '1', ad_name: 'V01', spend: '10', impressions: '1000', inline_link_clicks: '20', actions: [{ action_type: 'video_view', value: '300' }, { action_type: 'offsite_conversion.fb_pixel_lead', value: '2' }] }]
    const { rows, total } = buildFunnelRows(meta,
        [{ utm_content: 'V01' }, { utm_content: null, fbadid: '1' }, { utm_content: null }],
        [{ utm_content: 'V01' }],
        [{ id: 'a', utm_content: 'V01', milestones: { appointment: true, showUp: false, sale: false } }, { id: 'b', utm_content: null, milestones: { appointment: false, showUp: false, sale: false } }])
    const v01 = rows.find(r => r.key === 'V01')!
    assert.equal(v01.visits, 2); assert.equal(v01.formStarts, 1); assert.equal(v01.leads, 1); assert.equal(v01.appointments, 1)
    assert.equal(v01.videoViews3s, 300); assert.equal(v01.metaLeads, 2)
    assert.equal(rows.at(-1)!.key, UNATTRIBUTED)
    assert.equal(total.visits, 3); assert.equal(total.leads, 2); assert.equal(total.spend, 10)
})

test('rapporti senza denominatore non diventano zero', () => {
    assert.equal(pct(1, 0), null); assert.equal(pct(1, 4), 25)
    assert.equal(costPer(100, 0), null); assert.equal(costPer(100, 4), 25)
})
