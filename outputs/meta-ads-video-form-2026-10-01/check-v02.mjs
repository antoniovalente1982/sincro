import { graph } from './meta-client.mjs'
const ad = await graph('120251955045850047', { fields: 'name,status,effective_status,updated_time' })
console.log(JSON.stringify(ad))
const act = await graph('act_511099830249139/activities', { fields: 'event_time,event_type,translated_event_type,object_id,object_name,actor_name,extra_data', since: Math.floor(new Date('2026-09-30T14:00:00Z').getTime()/1000), limit: 50 })
for (const a of act.data.filter(a => ['120251955045850047','120251955029350047','120251955037690047'].includes(a.object_id) || /V02/.test(a.object_name || ''))) console.log(a.event_time, a.translated_event_type || a.event_type, '|', a.object_name, '|', a.actor_name, '|', (a.extra_data || '').slice(0, 160))
