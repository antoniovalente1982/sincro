import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import editorialModule from '../../lib/editorial-landing.ts'
const { buildEditorialLanding }=editorialModule
const origin=process.argv[2] || 'http://127.0.0.1:3000'
const includeGirl=process.argv.includes('--include-girl')
const dir='outputs/landing-editoriali-2026-09-18'
const patches=JSON.parse(await fs.readFile(dir+'/TESTI_ARTICOLI.json','utf8'))
const decode=s=>s.replace(/<[^>]*>/g,'').replaceAll('&amp;','&').replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>')
const specs=await Promise.all(patches.map(async p=>{const article=JSON.parse(await fs.readFile('outputs/advertorial-completi-2026-09-18/articles/'+p.slug+'.json','utf8'));return {entry:'blog-'+p.slug,copy:buildEditorialLanding(article)}}))
if(includeGirl){const article=JSON.parse(await fs.readFile(dir+'/CALCIATRICE.json','utf8'));specs.push({entry:'blog-'+article.slug,copy:buildEditorialLanding(article)})}
const checks=[]
for(let i=0;i<specs.length;i+=3)await Promise.all(specs.slice(i,i+3).map(async ({entry,copy})=>{
 const response=await fetch(origin+'/f/salto-di-qualita?entry='+entry+'&ab=A')
 const html=await response.text()
 const h1=decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]||'')
 const h2=[...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(x=>decode(x[1]))
 const plain=decode(html)
 const pass=response.ok&&h1===copy.headline&&h2.includes(copy.theme.problem)&&h2.includes(copy.theme.work)&&h2.includes(copy.theme.closing)&&plain.includes(copy.faqs[0].q)&&plain.includes('Non serve essere professionisti.')&&html.includes(copy.image.split('/').pop())&&html.includes('id="ms-form"')
 checks.push({entry,status:response.status,h1,pass})
}))
for(const query of ['', '?entry=blog-non-esiste-2027','?entry=blog-uno&entry=blog-due',...(!includeGirl?['?entry=blog-calciatrice-fiducia-calcio-femminile']:[])]){
 const r=await fetch(origin+'/f/salto-di-qualita'+query)
 const html=await r.text();const h1=decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]||'')
 checks.push({entry:query||'generale',status:r.status,h1,pass:r.ok&&h1==='Aiutalo a fare il salto di categoria.'})
}
const legacy=await fetch(origin+'/f/salto-di-qualita?entry=advertorial-pochi-minuti&ab=A');const legacyHtml=decode(await legacy.text());checks.push({entry:'advertorial-pochi-minuti',status:legacy.status,pass:legacy.ok&&legacyHtml.includes('In allenamento è un altro. Aiutiamolo ad affrontare quei pochi minuti.')})
const report={at:new Date().toISOString(),origin,passed:checks.filter(c=>c.pass).length,total:checks.length,checks}
await fs.writeFile(dir+(origin.includes('127.0.0.1')?'/VERIFICA_LOCALE.json':'/VERIFICA_LIVE.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:checks.filter(c=>!c.pass)}))
assert.equal(report.passed,report.total)
