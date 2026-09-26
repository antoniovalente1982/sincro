import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const dir = path.join(root, 'outputs/advertorial-storie-2026-09-18')
const { records } = JSON.parse(await fs.readFile(path.join(dir, 'GENERAZIONE.json'), 'utf8'))
if (records.length !== 50 || new Set(records.map(r => r.target)).size !== 50) throw new Error('Attesi 50 asset distinti')
const sizes = []
for (const record of records) {
  const target = path.join(root, record.target)
  await fs.mkdir(path.dirname(target), { recursive: true })
  const info = await sharp(record.source).resize({ width: 1440, withoutEnlargement: true }).webp({ quality: 84 }).toFile(target)
  sizes.push({ file: record.target, width: info.width, height: info.height, bytes: info.size })
}
await fs.writeFile(path.join(dir, 'ASSET.json'), JSON.stringify(sizes, null, 2) + '\n')
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const slugs = [...new Set(records.map(r => r.slug))]
const sections = []
const links = []
for (const slug of slugs) {
  const article = JSON.parse(await fs.readFile(path.join(root, 'outputs/advertorial-completi-2026-09-18/articles', slug + '.json'), 'utf8'))
  const preview = 'https://landing.metodosincro.com/dashboard/blog?articolo=' + slug + '&vista=anteprima'
  links.push(`- [${article.title}](${preview})`)
  sections.push(`<section><h2>${esc(article.title)}</h2><p><a href="${esc(preview)}">Apri advertorial nel gestionale →</a></p><div class="photos">${records.filter(r => r.slug === slug).map(r => `<figure><img loading="lazy" src="../../${esc(r.target)}" alt="${esc(r.label)}"><figcaption>${esc(r.label)}</figcaption></figure>`).join('')}</div></section>`)
}
await fs.writeFile(path.join(dir, 'GALLERIA.html'), `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dentro la partita · Storie e immagini</title><style>body{margin:0;background:#faf9f5;color:#232820;font:17px/1.5 system-ui,sans-serif}main{max-width:1380px;margin:auto;padding:40px 24px}h1,h2{font-family:Georgia,serif;line-height:1.15}h1{font-size:42px}h2{font-size:27px}section{padding:30px 0;border-top:1px solid #ccd0c8}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}figure{margin:0}img{width:100%;height:auto;display:block}figcaption{font-size:14px;color:#5c6657;margin-top:8px}a{color:#235438}@media(max-width:720px){.photos{grid-template-columns:1fr}h1{font-size:32px}}</style><main><h1>Dentro la partita</h1><p>17 protagonisti distinti, 50 immagini. Prevalenza di ragazzi e famiglie europee; lo stesso ragazzo accompagna le scene di ciascun advertorial.</p><p>Scene illustrative generate con AI. Le anteprime complete richiedono l’accesso al gestionale.</p>${sections.join('')}</main></html>`)
await fs.writeFile(path.join(dir, 'ANTEPRIME.md'), '# Dentro la partita — storie e immagini\n\n17 advertorial aggiornati con 50 immagini e protagonisti distinti. Scene illustrative generate con AI; prevalenza di ragazzi e famiglie europee.\n\n[Galleria di tutte le immagini](GALLERIA.html) · [Apri il Blog nel gestionale](https://landing.metodosincro.com/dashboard/blog)\n\n' + links.join('\n') + '\n\nGenerazione: strumento integrato image_gen. Prompt, riferimenti e sorgenti PNG sono registrati in [GENERAZIONE.json](GENERAZIONE.json). Gli asset WebP sono in `public/images/blog/storie/`.\n')
console.log(JSON.stringify({ assets: sizes.length, bytes: sizes.reduce((n, r) => n + r.bytes, 0), gallery: path.join(dir, 'GALLERIA.html') }))
