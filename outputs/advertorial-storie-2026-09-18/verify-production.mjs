import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const dir = 'outputs/advertorial-storie-2026-09-18'
const { records } = JSON.parse(await fs.readFile(dir + '/GENERAZIONE.json', 'utf8'))
const slugs = [...new Set(records.map(r => r.slug))]
const base = 'https://landing.metodosincro.com'
const checks = []
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const tasks = records.map(record => async () => {
  const url = base + '/' + record.target.replace(/^public\//, '')
  const response = await fetch(url)
  const actual = Buffer.from(await response.arrayBuffer())
  const expected = await fs.readFile(record.target)
  checks.push({ url, status: response.status, matchesLocalFile: digest(actual) === digest(expected), pass: response.ok && digest(actual) === digest(expected) })
})
for (const slug of slugs) tasks.push(async () => {
  const url = base + '/blog/' + slug
  const response = await fetch(url)
  await response.arrayBuffer()
  checks.push({ url, status: response.status, pass: response.status === 404 })
})
for (let start = 0; start < tasks.length; start += 6) await Promise.all(tasks.slice(start, start + 6).map(fn => fn()))
const sitemap = await fetch(base + '/sitemap.xml')
const xml = await sitemap.text()
checks.push({ url: base + '/sitemap.xml', status: sitemap.status, draftsExcluded: slugs.every(slug => !xml.includes('/blog/' + slug)), pass: sitemap.ok && slugs.every(slug => !xml.includes('/blog/' + slug)) })
const report = { verifiedAt: new Date().toISOString(), commit: '80318b04', passed: checks.filter(c => c.pass).length, total: checks.length, checks }
await fs.writeFile(dir + '/VERIFICA_PRODUZIONE.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ passed: report.passed, total: report.total, failures: checks.filter(c => !c.pass) }))
if (report.passed !== report.total) process.exitCode = 1
