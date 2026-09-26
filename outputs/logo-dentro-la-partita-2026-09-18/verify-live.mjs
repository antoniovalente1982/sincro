import fs from 'node:fs/promises'
import crypto from 'node:crypto'
const dir = 'outputs/logo-dentro-la-partita-2026-09-18'
const { posts } = JSON.parse(await fs.readFile('outputs/advertorial-storie-2026-09-18/PUBBLICAZIONE.json', 'utf8'))
const urls = [...posts.map(p => p.url), 'https://landing.metodosincro.com/f/pochi-minuti']
const checks = []
for (let i = 0; i < urls.length; i += 4) await Promise.all(urls.slice(i, i + 4).map(async url => {
  const response = await fetch(url)
  const html = await response.text()
  const containsLogo = html.includes('dentro-la-partita-logo.png') && html.includes('Dentro la partita — Calcio, mente e crescita')
  checks.push({ url, status: response.status, containsLogo, pass: response.ok && containsLogo })
}))
const hash = data => crypto.createHash('sha256').update(data).digest('hex')
for (const file of ['dentro-la-partita-logo.png', 'dentro-la-partita-symbol.png', 'dentro-la-partita-symbol.webp']) {
  const url = 'https://landing.metodosincro.com/images/brand/' + file
  const response = await fetch(url)
  const downloaded = Buffer.from(await response.arrayBuffer())
  const local = await fs.readFile('public/images/brand/' + file)
  checks.push({ url, status: response.status, pass: response.ok && hash(downloaded) === hash(local) })
}
const report = { checkedAt: new Date().toISOString(), commit: 'b54dd596', passed: checks.filter(c => c.pass).length, total: checks.length, checks }
await fs.writeFile(dir + '/VERIFICA_PRODUZIONE.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ passed: report.passed, total: report.total, failures: checks.filter(c => !c.pass) }))
if (report.passed !== report.total) process.exitCode = 1
