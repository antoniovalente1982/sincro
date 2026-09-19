const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const origin=process.env.CHECK_ORIGIN||'http://localhost:3011'
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined})
const results=[]
const suffix=process.env.CHECK_LABEL ? '-'+process.env.CHECK_LABEL.replace(/[^a-zA-Z0-9_-]/g,'') : ''
async function context(width=390){
 const ctx=await browser.newContext({viewport:{width,height:844}});const events=[],submissions=[],pixels=[]
 await ctx.route('**/*',async route=>{
  const url=new URL(route.request().url())
  if(url.pathname.endsWith('/fbevents.js')){pixels.push(url.href);return route.fulfill({contentType:'text/javascript',body:'window.__metaEvents=[];window.fbq.callMethod=(...a)=>window.__metaEvents.push(a);for(const a of window.fbq.queue)window.fbq.callMethod(...a);window.fbq.queue=[];'})}
  if(url.pathname==='/api/track/editorial'){events.push(route.request().postDataJSON());return route.fulfill({json:{success:true}})}
  if(url.pathname==='/api/submit'){submissions.push(route.request().postDataJSON());if(submissions.length===1)return route.abort('connectionfailed');return route.fulfill({json:{success:true}})}
  if(url.origin!==origin)return route.abort()
  return route.continue()
 });return {ctx,events,submissions,pixels,page:await ctx.newPage()}
}
try{
 const t=await context();const p=t.page
 await p.goto(origin+'/blog/calciatrice-fiducia-calcio-femminile?utm_source=meta&utm_campaign=qa',{waitUntil:'networkidle'})
 await p.getByRole('button',{name:'Accetta tutti',exact:true}).waitFor()
 assert.equal(t.events.length,0);assert.equal(t.pixels.length,0)
 await p.getByRole('button',{name:'Accetta tutti',exact:true}).click()
 await p.waitForFunction(()=>window.__metaEvents?.some(e=>e[2]==='PageView'))
 assert.equal(t.events.filter(e=>e.event_name==='advertorial_view').length,1)
 const visitor=t.events[0].visitor_id
 const meta=await p.evaluate(()=>window.__metaEvents)
 assert.equal(meta.find(e=>e[0]==='init')[1],'311586900940615')
 assert.equal(meta.find(e=>e[2]==='PageView')[4].eventID,t.events[0].event_id)
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await p.screenshot({path:`outputs/editorial-tracking-2026-09-19/article-mobile${suffix}.png`})
 await p.locator('a[href*="/f/salto-di-qualita?"]').first().click()
 await p.waitForURL('**/f/salto-di-qualita?**')
 await p.waitForFunction(()=>window.__metaEvents?.some(e=>e[2]==='PageView'))
 await p.waitForTimeout(500)
 assert.equal(t.events.filter(e=>e.event_name==='landing_view').length,1)
 assert.equal(t.events.find(e=>e.event_name==='landing_view').visitor_id,visitor)
 assert.equal(t.events.find(e=>e.event_name==='landing_view').entry,'blog-calciatrice-fiducia-calcio-femminile')
 assert.equal(t.events.filter(e=>e.event_name==='advertorial_cta').length,1)
 const refusal=p.getByRole('button',{name:'Rifiuta analisi',exact:true});if(await refusal.isVisible())await refusal.click()
 const skip=p.getByRole('button',{name:'Non saprei, andiamo avanti'});if(await skip.isVisible()){await skip.click();await p.locator('.lp-sf-age').first().click()}
 await p.getByPlaceholder('Nome e Cognome *').fill('Verifica Tecnica')
 await p.getByPlaceholder('Telefono * (+39...)').fill('3331234567')
 await p.getByPlaceholder('Email *').fill('tracking-check@example.invalid')
 await p.locator('#ms-form .lp-btn-submit').last().click()
 await p.waitForTimeout(700)
 await p.locator('#ms-form .lp-btn-submit').last().click()
 await p.waitForTimeout(500)
 assert.equal(t.submissions.length,2)
 assert.equal(t.submissions[0].event_id,t.submissions[1].event_id)
 assert.equal(t.submissions[0].visitor_id,visitor)
 assert.equal(t.submissions[0].extra_data.editorial_entry,'blog-calciatrice-fiducia-calcio-femminile')
 assert.equal(t.submissions[0].utm_campaign,'qa')
 assert.equal(t.events.filter(e=>e.event_name==='form_start').length,1)
 const leadMeta=await p.evaluate(()=>window.__metaEvents.filter(e=>e[2]==='Lead'))
 assert.equal(leadMeta.length,1);assert.equal(leadMeta[0][4].eventID,t.submissions[0].event_id)
 results.push({check:'article -> personalized landing -> mocked form + failed-response retry, same visitor and event IDs',pass:true})
 await t.ctx.close()
 for(const mode of ['denied','analytics','preview']){
  const t=await context(320);const p=t.page
  await p.goto(origin+'/f/pochi-minuti'+(mode==='preview'?'?ab=A':''),{waitUntil:'networkidle'})
  if(mode!=='preview')await p.getByRole('button',{name:mode==='denied'?'Rifiuta facoltativi':'Solo analisi',exact:true}).click()
  await p.waitForTimeout(400)
  assert.equal(t.pixels.length,0)
  assert.equal(t.events.length,mode==='analytics'?1:0)
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  if(mode==='analytics'){
   await p.getByRole('button',{name:'Preferenze cookie e tracciamento',exact:true}).click()
   await p.getByRole('button',{name:'Rifiuta facoltativi',exact:true}).click()
   const before=t.events.length
   await p.locator('a[href*="/f/salto-di-qualita?"]').first().click()
   await p.waitForURL('**/f/salto-di-qualita?**');await p.waitForTimeout(800)
   assert.equal(t.events.length,before)
  }
  results.push({check:mode+' at 320px including consent persistence',pass:true});await t.ctx.close()
 }
 {
  const t=await context();const p=t.page
  await p.goto(origin+'/blog/calciatrice-fiducia-calcio-femminile?ab=B',{waitUntil:'networkidle'})
  await p.locator('a[href*="/f/salto-di-qualita?"]').first().click()
  await p.waitForURL('**/f/salto-di-qualita?**')
  assert.equal(new URL(p.url()).searchParams.get('ab'),'A')
  assert.equal(t.events.length,0);assert.equal(t.pixels.length,0)
  results.push({check:'blog preview B stays preview through landing CTA',pass:true});await t.ctx.close()
 }
 {
  const t=await context();const p=t.page
  await p.addInitScript(()=>{localStorage.setItem('ms_clarity_consent_v1_yjm4a7mui9',JSON.stringify({choice:'granted',at:Date.now()}));window.__clarity=[];window.clarity=(...a)=>window.__clarity.push(a)})
  await p.goto(origin+'/f/salto-di-qualita',{waitUntil:'networkidle'})
  await p.getByRole('button',{name:'Solo analisi',exact:true}).click();await p.waitForTimeout(200)
  await p.getByRole('button',{name:'Preferenze cookie e tracciamento',exact:true}).click()
  await p.getByRole('button',{name:'Rifiuta facoltativi',exact:true}).click();await p.waitForTimeout(200)
  assert.ok(await p.evaluate(()=>window.__clarity.some(x=>x[0]==='stop')))
  const first=t.events.find(x=>x.event_name==='landing_view').visitor_id
  await p.getByRole('button',{name:'Preferenze cookie e tracciamento',exact:true}).click()
  await p.getByRole('button',{name:'Solo analisi',exact:true}).click();await p.waitForTimeout(200)
  assert.equal(t.events.filter(x=>x.event_name==='landing_view').length,2)
  assert.notEqual(t.events.filter(x=>x.event_name==='landing_view')[1].visitor_id,first)
  await p.evaluate(()=>{localStorage.removeItem('_sincro_vid');window.dispatchEvent(new StorageEvent('storage',{key:'_sincro_vid',newValue:null}))})
  await p.waitForTimeout(200)
  assert.equal(t.events.filter(x=>x.event_name==='landing_view').length,3)
  results.push({check:'Clarity stops on global withdrawal; regrant and cross-tab identity reset keep valid pageviews',pass:true});await t.ctx.close()
 }
 console.log(JSON.stringify({results}));await fs.writeFile(`outputs/editorial-tracking-2026-09-19/BROWSER_CHECK${suffix}.json`,JSON.stringify({at:new Date().toISOString(),origin,results},null,2))
}finally{await browser.close()}
