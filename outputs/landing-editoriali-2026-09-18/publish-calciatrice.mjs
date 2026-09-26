import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import pg from 'pg'
import dotenv from 'dotenv'
import blogModule from '../../lib/blog.ts'
const {validateBlogInput}=blogModule
const dir='outputs/landing-editoriali-2026-09-18'
const receipt=JSON.parse(await fs.readFile(dir+'/APPLICAZIONE.json','utf8'))
const source=JSON.parse(await fs.readFile(dir+'/CALCIATRICE.json','utf8'))
const origin='https://landing.metodosincro.com'
for(let i=1;i<=3;i++){
 const r=await fetch(`${origin}/images/blog/storie/${source.slug}-0${i}.webp`)
 assert.ok(r.ok,'Immagine non pubblicata: '+i)
 assert.ok(r.headers.get('content-type')?.startsWith('image/'))
}
const deployed=await fetch(origin+'/f/salto-di-qualita?entry=blog-mio-figlio-gioca-poco&ab=A')
assert.ok((await deployed.text()).includes('Non serve essere professionisti.'),'Landing aggiornata non ancora disponibile')
dotenv.config({path:'.env.local',quiet:true})
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect()
let transaction=false
try {
 await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');transaction=true
 const {rows}=await client.query('SELECT * FROM blog_posts WHERE id=$1 AND organization_id=$2 FOR UPDATE',[receipt.created.id,receipt.organizationId])
 assert.equal(rows.length,1);const row=rows[0]
 assert.equal(row.slug,source.slug);assert.equal(row.status,'draft')
 for(const [key,value] of Object.entries(source)) assert.deepEqual(row.settings.blog[key],value,'Campo modificato: '+key)
 const parsed=validateBlogInput({...source,status:'active'});assert.equal(parsed.ok,true)
 const now=new Date().toISOString()
 await fs.writeFile(dir+'/snapshots/calciatrice-before-publication.json',JSON.stringify(row,null,2),{mode:0o600})
 const result=await client.query("UPDATE blog_posts SET status='active',updated_at=$1::text::timestamptz,settings=jsonb_set(jsonb_set(settings,'{blog,status}','\"active\"'::jsonb),'{blog,publishedAt}',to_jsonb($1::text)) WHERE id=$2 AND organization_id=$3 AND status='draft' RETURNING id,slug,status,settings",[now,row.id,receipt.organizationId])
 assert.equal(result.rowCount,1)
 assert.deepEqual(result.rows[0].settings,{...row.settings,blog:{...source,status:'active',publishedAt:now}})
 await client.query('COMMIT');transaction=false
 await fs.writeFile(dir+'/PUBBLICAZIONE_CALCIATRICE.json',JSON.stringify({publishedAt:now,id:row.id,slug:source.slug,url:origin+'/blog/'+source.slug,landing:origin+'/f/salto-di-qualita?entry=blog-'+source.slug+'#ms-form',status:'active'},null,2)+'\n')
 await fs.writeFile(dir+'/CALCIATRICE.json',JSON.stringify({...source,status:'active'},null,2)+'\n')
 await fs.writeFile('outputs/advertorial-completi-2026-09-18/articles/'+source.slug+'.json',JSON.stringify({...source,status:'active'},null,2)+'\n')
 console.log(JSON.stringify({published:source.slug,status:'active'}))
}catch(error){if(transaction)await client.query('ROLLBACK');throw error}finally{await client.end()}
