import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import pg from 'pg'
import dotenv from 'dotenv'
import blogModule from '../../lib/blog.ts'
const { validateBlogInput } = blogModule
const dir='outputs/landing-editoriali-2026-09-18'
const {organizationId}=JSON.parse(await fs.readFile('outputs/advertorial-storie-2026-09-18/IMAGE_MAPPING.json','utf8'))
const patches=JSON.parse(await fs.readFile(dir+'/TESTI_ARTICOLI.json','utf8'))
const article=JSON.parse(await fs.readFile(dir+'/CALCIATRICE.json','utf8'))
assert.equal(patches.length,17)
assert.equal(validateBlogInput({...article,status:'active'}).ok,true)
for(let i=1;i<=3;i++) await fs.access(`public/images/blog/storie/${article.slug}-0${i}.webp`)
dotenv.config({path:'.env.local',quiet:true})
const client=new pg.Client({connectionString:process.env.DATABASE_URL})
await client.connect()
let transaction=false
try {
 await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE'); transaction=true
 const {rows:funnels}=await client.query("SELECT id, organization_id FROM funnels WHERE slug='salto-di-qualita' AND status='active'")
 assert.equal(funnels.length,1); assert.equal(funnels[0].organization_id,organizationId)
 const {rows}=await client.query('SELECT * FROM blog_posts WHERE organization_id=$1 AND slug=ANY($2::text[]) FOR UPDATE',[organizationId,patches.map(p=>p.slug)])
 assert.equal(rows.length,17)
 const now=new Date().toISOString()
 await fs.mkdir(dir+'/snapshots',{recursive:true})
 await fs.writeFile(dir+'/snapshots/before-'+now.replaceAll(':','-')+'.json',JSON.stringify({at:now,rows},null,2),{mode:0o600})
 for(const patch of patches) {
   const row=rows.find(r=>r.slug===patch.slug)
   assert.equal(row.status,'active'); assert.equal(row.settings.template,'blog_article')
   const source=JSON.parse(await fs.readFile('outputs/advertorial-completi-2026-09-18/articles/'+patch.slug+'.json','utf8'))
   for(const field of ['title','body','cover']) assert.equal(row.settings.blog[field],source[field], 'Contenuto cambiato: '+patch.slug+'/'+field)
   const {slug,...copy}=patch
   const updated={...row.settings.blog,...copy}
   assert.equal(validateBlogInput(updated).ok,true)
   const result=await client.query("UPDATE blog_posts SET settings=jsonb_set(settings,'{blog}',settings->'blog' || $1::jsonb), updated_at=$2 WHERE id=$3 AND organization_id=$4 RETURNING settings",[JSON.stringify(copy),now,row.id,organizationId])
   assert.equal(result.rowCount,1); assert.deepEqual(result.rows[0].settings,{...row.settings,blog:updated})
 }
 const {rows:existing}=await client.query('SELECT * FROM blog_posts WHERE organization_id=$1 AND slug=$2 FOR UPDATE',[organizationId,article.slug])
 assert.equal(existing.length,0,'Il nuovo articolo esiste già: non sovrascriverlo.')
 const {rows:created}=await client.query('INSERT INTO blog_posts (organization_id,name,slug,description,status,settings,updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING id,slug,status,updated_at',[organizationId,article.title,article.slug,article.excerpt,'draft',JSON.stringify({template:'blog_article',blog:{...article,publishedAt:null}}),now])
 await client.query('COMMIT');transaction=false
 await fs.writeFile(dir+'/APPLICAZIONE.json',JSON.stringify({at:now,organizationId,updated:patches.map(p=>p.slug),created:created[0]},null,2)+'\n')
 for(const patch of patches){ const path='outputs/advertorial-completi-2026-09-18/articles/'+patch.slug+'.json';const source=JSON.parse(await fs.readFile(path,'utf8'));await fs.writeFile(path,JSON.stringify({...source,...patch},null,2)+'\n') }
 console.log(JSON.stringify({updated:rows.length,created:created[0].slug,status:'draft'}))
} catch(error) {if(transaction) await client.query('ROLLBACK');throw error} finally {await client.end()}
