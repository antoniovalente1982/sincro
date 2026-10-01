import { graph, pixel } from './meta-client.mjs';
const start = Math.floor(new Date('2026-09-30T15:30:00Z').getTime() / 1000), end = Math.floor(Date.now() / 1000);
for (const aggregation of ['event', 'event_source']) {
  try {
    const r = await graph(pixel + '/stats', { aggregation, start_time: start, end_time: end });
    for (const row of r.data || []) {
      const leads = (row.data || []).filter(d => /lead/i.test(d.value));
      if (leads.length) console.log(aggregation, row.start_time, JSON.stringify(leads));
    }
    if (aggregation === 'event_source') for (const row of r.data || []) console.log('source', row.start_time, JSON.stringify(row.data));
  } catch (e) { console.log(aggregation, 'ERR', String(e).slice(0, 300)); }
}
