import fs from 'node:fs/promises'
const dir = 'outputs/advertorial-storie-2026-09-18'
const publication = JSON.parse(await fs.readFile(dir + '/PUBBLICAZIONE.json', 'utf8'))
const checks = []
const decode = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"')
for (let i = 0; i < publication.posts.length; i += 4) await Promise.all(publication.posts.slice(i, i + 4).map(async post => {
  const response = await fetch(post.url)
  const html = await response.text()
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1]
  const robots = html.match(/<meta[^>]*name="robots"[^>]*content="([^"]+)"/)?.[1] || ''
  const schemas = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => JSON.parse(m[1]))
  const schema = schemas.find(s => s['@type'] === 'Article')
  const source = JSON.parse(await fs.readFile('outputs/advertorial-completi-2026-09-18/articles/' + post.slug + '.json', 'utf8'))
  const localImages = [source.cover, ...[...source.body.matchAll(/!\[[^\]]*\]\(([^\s)]+)/g)].map(m => m[1])]
  const checksForPost = { status200: response.status === 200, canonicalCorrect: decode(canonical || '') === post.url, indexable: robots.includes('index') && !robots.includes('noindex') && !(response.headers.get('x-robots-tag') || '').includes('noindex'), articleSchema: schema?.headline === post.title && schema?.datePublished === post.publishedAt, allImagesIncluded: localImages.every(src => html.includes(encodeURIComponent(src)) || html.includes(src)), consultationLink: html.includes('entry=blog-' + post.slug) }
  checks.push({ url: post.url, status: response.status, checks: checksForPost, pass: Object.values(checksForPost).every(Boolean) })
}))
const sitemapResponse = await fetch('https://landing.metodosincro.com/sitemap.xml')
const sitemap = await sitemapResponse.text()
checks.push({ url: 'https://landing.metodosincro.com/sitemap.xml', pass: sitemapResponse.ok && publication.posts.every(post => sitemap.includes(post.url)) && sitemap.includes('/f/pochi-minuti') })
const firstResponse = await fetch('https://landing.metodosincro.com/f/pochi-minuti')
checks.push({ url: firstResponse.url, status: firstResponse.status, pass: firstResponse.ok })
const report = { checkedAt: new Date().toISOString(), publicArticles: 18, checks, passed: checks.filter(c => c.pass).length, total: checks.length }
await fs.writeFile(dir + '/VERIFICA_PUBBLICAZIONE.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ passed: report.passed, total: report.total, publicArticles: 18, failures: checks.filter(c => !c.pass) }))
if (report.passed !== report.total) process.exitCode = 1
