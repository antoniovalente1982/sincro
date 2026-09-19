import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs/promises'
import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config({path:'.env.local',quiet:true})
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});await db.connect()
const origin='http://localhost:3011', visitor=randomUUID(), session=randomUUID(), base=Date.now()-5000
const consent=encodeURIComponent(JSON.stringify({analytics:true,marketing:false,at:Date.now()}))
const headers={'Content-Type':'application/json',origin,'User-Agent':'Mozilla/5.0 Chrome/120.0 Safari/537.36',cookie:`ms_tracking_consent_v1=${consent}`}
const results=[]
async function send(data,extra={}){return fetch(origin+'/api/track/editorial',{method:'POST',headers:{...headers,...extra},body:JSON.stringify({visitor_id:visitor,session_id:session,...data})})}
try{
 const landing={event_id:randomUUID(),event_name:'landing_view',page_path:'/f/salto-di-qualita',page_variant:'B',entry:'blog-calciatrice-fiducia-calcio-femminile',occurred_at:new Date(base+100).toISOString()}
 const article={event_id:randomUUID(),event_name:'advertorial_view',page_path:'/blog/calciatrice-fiducia-calcio-femminile',occurred_at:new Date(base).toISOString()}
 assert.equal((await send(landing)).status,200)
 assert.equal((await send(article)).status,200)
 assert.equal((await send(article)).status,200)
 const rows=await db.query('select event_name, occurred_at, metadata from editorial_events where visitor_id=$1 order by occurred_at',[visitor])
 assert.deepEqual(rows.rows.map(x=>x.event_name),['advertorial_view','landing_view'])
 const pv=await db.query('select page_variant from page_views where visitor_id=$1',[visitor]);assert.equal(pv.rows[0].page_variant,'B')
 assert.equal((await send({...article,event_id:randomUUID(),event_name:'lead_submitted'})).status,400)
 assert.equal((await send({...article,event_id:randomUUID()},{origin:'https://evil.example'})).status,403)
 const denial=await send({...article,event_id:randomUUID()},{cookie:''});assert.equal((await denial.json()).skipped,'consent')
 assert.equal((await fetch(origin+'/api/blog/results')).status,401)
 assert.equal((await fetch(origin+`/api/leads/${randomUUID()}/editorial-journey`)).status,401)
 results.push({check:'saved actions ordered despite reversed request arrival; duplicate event suppressed; variant B retained; Lead injection/origin/consent/auth checked',pass:true})
 console.log(JSON.stringify({results}));await fs.writeFile('outputs/editorial-tracking-2026-09-19/SERVER_CHECK.json',JSON.stringify({at:new Date().toISOString(),results},null,2))
}finally{await db.query('delete from editorial_events where visitor_id=$1',[visitor]);await db.query('delete from page_views where visitor_id=$1',[visitor]);await db.end()}
