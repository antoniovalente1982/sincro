import { graph } from './meta-client.mjs'
const fr: any = await import('../../lib/funnel-report.ts'); const { buildFunnelRows } = fr.buildFunnelRows ? fr : fr.default
const META_FIELDS = 'ad_id,ad_name,spend,impressions,reach,frequency,inline_link_clicks,actions,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions'
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
const r = await graph('act_511099830249139/insights', { fields: META_FIELDS, level: 'ad', time_range: { since: '2026-10-01', until: today }, filtering: [{ field: 'campaign.id', operator: 'IN', value: ['120251955029350047'] }], limit: 500 })
console.log('righe Meta:', r.data.length)
const { rows, total } = buildFunnelRows(r.data, [], [], [])
for (const x of rows) console.log(x.label.slice(-24), '| spesa', x.spend.toFixed(2), '| impr', x.impressions, '| 3s', x.videoViews3s, '| thru', x.thruplays, '| p25', x.p25, '| clic', x.linkClicks, '| leadMeta', x.metaLeads)
console.log('TOTALE spesa', total.spend.toFixed(2), 'impr', total.impressions, 'clic', total.linkClicks)
