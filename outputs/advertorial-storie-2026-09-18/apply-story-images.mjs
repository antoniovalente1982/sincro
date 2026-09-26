#!/usr/bin/env node
// Default: read-only local plan. Mutations require one explicit, separate mode.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const folder = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(folder, '../..')
const sourceDir = path.join(root, 'outputs/advertorial-completi-2026-09-18/articles')
const organizationId = 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5'
const aiLabel = 'Scena illustrativa generata con AI.'
const realPhoto = '/images/team/antonio-valente.jpg'
const knownSlugs = [
  'incoraggiare-figlio-calcio', 'salto-di-categoria-fiducia', 'cosa-dire-dopo-brutta-partita',
  'mio-figlio-gioca-poco', 'figlio-non-si-diverte-calcio', 'paura-rientro-infortunio-calcio',
  'allenamento-extra-partita', 'fiducia-dopo-errore-calcio', 'pressione-prima-della-partita',
  'genitori-pressione-calcio', 'pressione-provino-calcio', 'confronto-fisico-calcio-ragazzi',
  'figlio-rifiuta-mental-coach', 'figlio-escluso-gruppo-squadra', 'scuola-famiglia-calcio',
  'figlio-non-confermato-squadra', 'mental-coaching-calcio-ragazzi',
]
const args = new Set(process.argv.slice(2))
const validArgs = new Set(['--apply-local', '--write-db', '--check-db', '--require-assets', '--help'])
const modes = ['--apply-local', '--write-db', '--check-db'].filter(a => args.has(a))
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const stable = value => value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
const digest = value => sha(value === undefined ? '<undefined>' : JSON.stringify(stable(value)))
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')
const imagePattern = () => /^!\[[^\r\n]*\]\([^\r\n]*\)$/gm
const imageBlocks = body => [...body.matchAll(imagePattern())].map(match => match[0])
const withoutImages = body => body.replace(imagePattern(), '<BODY_IMAGE>')
const parseImage = block => {
  const match = block.match(/^!\[([^\[\]<>\r\n]+)\]\(([^\s()]+) "([^"<>\r\n]+)"\)$/)
  assert(match, `Blocco immagine non riconosciuto: ${block.slice(0, 100)}`)
  return { alt: match[1], src: match[2], caption: match[3] }
}
const markdownImage = image => `![${image.alt}](${image.src} "${image.caption}")`
const sameSourceFields = (candidate, expected) => candidate && Object.entries(expected)
  .every(([key, value]) => digest(candidate[key]) === digest(value))

function validateSet(items, label) {
  assert(Array.isArray(items) && items.length === 17, `${label}: servono esattamente 17 articoli.`)
  assert(new Set(items.map(item => item.slug)).size === 17, `${label}: slug duplicato.`)
  assert(knownSlugs.every(slug => items.some(item => item.slug === slug)), `${label}: lotto inatteso.`)
}

function preparePlan() {
  const mapping = readJson(path.join(folder, 'IMAGE_MAPPING.json'))
  const baselineBytes = fs.readFileSync(path.join(folder, 'BASELINE.json'))
  const baseline = JSON.parse(baselineBytes)
  const characters = readJson(path.join(folder, 'PERSONAGGI.json'))
  assert(mapping.schemaVersion === 1 && baseline.schemaVersion === 1, 'Versione metadata inattesa.')
  assert(mapping.organizationId === organizationId, 'Organizzazione inattesa nella mappatura.')
  assert(mapping.baselineFile === 'BASELINE.json' && sha(baselineBytes) === mapping.baselineSha256,
    'Snapshot originale modificato: rivedere esplicitamente la baseline.')
  assert(mapping.sourceDirectory === 'outputs/advertorial-completi-2026-09-18/articles', 'Directory sorgente inattesa.')
  validateSet(mapping.articles, 'Mappatura')
  validateSet(baseline.articles, 'Baseline')
  validateSet(characters, 'Personaggi')
  assert(new Set(characters.map(item => item.identity)).size === 17, 'Le 17 identità devono essere distinte.')
  assert(digest(mapping.expected) === digest({ stories: 17, distinctFictionalIdentities: 17, generatedAssets: 50, preservedRealPhotos: 1 }),
    'Conteggi attesi inattesi.')

  const generatedPaths = []
  let realPhotos = 0
  const plan = knownSlugs.map(slug => {
    const item = mapping.articles.find(a => a.slug === slug)
    const saved = baseline.articles.find(a => a.slug === slug)
    const character = characters.find(a => a.slug === slug)
    const old = saved.article
    const sourceFile = path.join(sourceDir, `${slug}.json`)
    const raw = fs.readFileSync(sourceFile)
    const current = JSON.parse(raw)
    const count = slug === 'mental-coaching-calcio-ragazzi' ? 2 : 3
    assert(saved.source === `outputs/advertorial-completi-2026-09-18/articles/${slug}.json`, `Sorgente inattesa: ${slug}`)
    assert(item.fictional === true && item.identity === character.identity, `Identità modificata: ${slug}`)
    assert(character.scenes.length === count && character.labels.length === count, `Scene inattese: ${slug}`)
    assert(old.slug === slug && old.status === 'draft' && old.publishedAt == null, `Baseline non in bozza: ${slug}`)
    assert(digest(old) === saved.articleSha256 && sha(old.body) === saved.bodySha256, `Hash baseline non valido: ${slug}`)
    assert(digest(imageBlocks(old.body)) === digest(saved.imageBlocks) && saved.imageBlocks.length === 2,
      `I due blocchi immagine originali non corrispondono: ${slug}`)
    assert(item.cover === `/images/blog/storie/${slug}-01.webp`, `Copertina inattesa: ${slug}`)
    assert(typeof item.coverAlt === 'string' && item.coverAlt.length <= 300 && item.coverAlt.endsWith(aiLabel),
      `Alt copertina non valido: ${slug}`)
    generatedPaths.push(item.cover)
    assert(Array.isArray(item.bodyImages) && item.bodyImages.length === 2, `Servono due immagini interne: ${slug}`)
    item.bodyImages.forEach((image, index) => {
      assert(image.position === index + 1, `Ordine immagini inatteso: ${slug}`)
      assert(typeof image.alt === 'string' && image.alt.length <= 300 && image.alt.length > 0,
        `Alt interno non valido: ${slug}`)
      assert(typeof image.caption === 'string' && image.caption.length > 0, `Didascalia vuota: ${slug}`)
      assert(digest(parseImage(markdownImage(image))) === digest({ src: image.src, alt: image.alt, caption: image.caption }),
        `Markdown immagine non valido: ${slug}`)
      if (slug === 'mental-coaching-calcio-ragazzi' && index === 1) {
        const oldImage = parseImage(saved.imageBlocks[index])
        assert(image.src === realPhoto && oldImage.src === realPhoto && image.generated === false && image.scene === null,
          'La foto reale di Antonio deve essere conservata.')
        assert(!/AI|generat[ao]/i.test(image.alt) && image.caption === oldImage.caption,
          'Per la foto reale è consentita soltanto la correzione dell’alt.')
        realPhotos++
      } else {
        assert(image.scene === index + 2 && image.generated === true,
          `Numero scena inatteso: ${slug}`)
        assert(image.src === `/images/blog/storie/${slug}-${String(index + 2).padStart(2, '0')}.webp`,
          `Asset interno inatteso: ${slug}`)
        assert(image.alt.endsWith(aiLabel) && image.caption.endsWith(aiLabel), `Etichetta AI mancante: ${slug}`)
        generatedPaths.push(image.src)
      }
    })
    let imageIndex = 0
    const body = old.body.replace(imagePattern(), block => {
      assert(block === saved.imageBlocks[imageIndex], `Blocco originale inatteso: ${slug}`)
      return markdownImage(item.bodyImages[imageIndex++])
    })
    const next = { ...old, cover: item.cover, coverAlt: item.coverAlt, body }
    assert(imageIndex === 2 && withoutImages(next.body) === withoutImages(old.body),
      `Il testo editoriale sarebbe modificato: ${slug}`)
    const changedKeys = Object.keys(old).filter(key => digest(old[key]) !== digest(next[key]))
    assert(changedKeys.every(key => ['cover', 'coverAlt', 'body'].includes(key)), `Campo non consentito: ${slug}`)
    const alreadyApplied = digest(current) === digest(next)
    assert(alreadyApplied || (sha(raw) === saved.rawSha256 && digest(current) === saved.articleSha256),
      `Modifica concorrente rilevata in ${slug}: nessuna sovrascrittura. Rivedere il nuovo contenuto prima di rigenerare una baseline.`)
    return { slug, sourceFile, saved, before: old, after: next, currentRawSha256: sha(raw), alreadyApplied, changedKeys }
  })
  assert(generatedPaths.length === 50 && new Set(generatedPaths).size === 50 && realPhotos === 1,
    'Servono 50 asset generati unici e una fotografia reale conservata.')
  return { mapping, plan, generatedPaths }
}

async function inspectAssets(generatedPaths) {
  const missing = []
  const assets = []
  const byContent = new Map()
  const { default: sharp } = await import('sharp')
  for (const src of generatedPaths) {
    const file = path.join(root, 'public', src)
    if (!fs.existsSync(file)) { missing.push(src); continue }
    const bytes = fs.readFileSync(file)
    assert(bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
      `Il file non è WebP: ${src}`)
    const hash = sha(bytes)
    assert(!byContent.has(hash), `Immagini duplicate: ${src} e ${byContent.get(hash)}`)
    byContent.set(hash, src)
    const metadata = await sharp(bytes).metadata()
    assert(metadata.format === 'webp' && metadata.width > 0 && metadata.height > 0, `Immagine non decodificabile: ${src}`)
    assets.push({ src, sha256: hash, bytes: bytes.length, width: metadata.width, height: metadata.height })
  }
  assert(fs.existsSync(path.join(root, 'public', realPhoto)), 'Fotografia reale di Antonio mancante.')
  return { missing, assets }
}

function createSnapshot(kind, content) {
  const snapshots = path.join(folder, 'snapshots')
  fs.mkdirSync(snapshots, { recursive: true })
  const file = path.join(snapshots, `${kind}-${stamp()}-${crypto.randomUUID()}.json`)
  fs.writeFileSync(file, JSON.stringify(content, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  return file
}

function applyLocal(plan, assets) {
  const changed = plan.filter(item => !item.alreadyApplied)
  if (!changed.length) { console.log('Le 17 sorgenti locali corrispondono già alla mappatura.'); return }
  for (const item of plan) {
    assert(sha(fs.readFileSync(item.sourceFile)) === item.currentRawSha256, `Modifica concorrente: ${item.slug}`)
  }
  const snapshot = createSnapshot('local-before', {
    at: new Date().toISOString(), organizationId, assets,
    articles: plan.map(item => ({ slug: item.slug, file: path.relative(root, item.sourceFile),
      raw: fs.readFileSync(item.sourceFile, 'utf8'), sha256: item.currentRawSha256 })),
  })
  let applied = 0
  try {
    for (const item of changed) {
      const temporary = `${item.sourceFile}.story-images-${crypto.randomUUID()}.tmp`
      try {
        fs.writeFileSync(temporary, JSON.stringify(item.after, null, 2) + '\n', { flag: 'wx' })
        assert(sha(fs.readFileSync(item.sourceFile)) === item.currentRawSha256, `Modifica concorrente: ${item.slug}`)
        fs.renameSync(temporary, item.sourceFile)
        applied++
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
      }
    }
    for (const item of plan) assert(digest(readJson(item.sourceFile)) === digest(item.after), `Verifica locale fallita: ${item.slug}`)
    const receipt = createSnapshot('local-after', { at: new Date().toISOString(), snapshot,
      changed: changed.map(item => item.slug), unchanged: plan.filter(item => item.alreadyApplied).map(item => item.slug) })
    console.log(`Aggiornate ${changed.length} sorgenti. Snapshot: ${snapshot}\nRicevuta: ${receipt}`)
  } catch (error) {
    console.error(`Applicazione locale interrotta dopo ${applied} file; nessun ripristino automatico sovrascrive altri lavori. Snapshot: ${snapshot}`)
    throw error
  }
}

async function databaseAction(plan, assets, write) {
  const { default: dotenv } = await import('dotenv')
  const { default: pg } = await import('pg')
  dotenv.config({ path: path.join(root, '.env.local'), quiet: true })
  assert(process.env.DATABASE_URL, 'DATABASE_URL mancante.')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  let inTransaction = false
  try {
    await client.query(write ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN TRANSACTION READ ONLY')
    inTransaction = true
    const { rows } = await client.query(`SELECT * FROM blog_posts WHERE organization_id=$1 AND slug=ANY($2::text[])${write ? ' FOR UPDATE' : ''}`,
      [organizationId, knownSlugs])
    validateSet(rows, 'Database')
    const updates = []
    for (const item of plan) {
      const row = rows.find(record => record.slug === item.slug)
      const blog = row.settings?.blog
      assert(row.organization_id === organizationId && row.status === 'draft' && row.settings?.template === 'blog_article',
        `Articolo/tenant/stato inatteso: ${item.slug}`)
      assert(blog?.status === 'draft' && blog.publishedAt === null, `Bozza pubblicata o data inattesa: ${item.slug}`)
      assert(row.name === item.before.title && row.description === item.before.excerpt, `Metadati DB modificati: ${item.slug}`)
      if (sameSourceFields(blog, item.after)) continue
      assert(sameSourceFields(blog, item.before),
        `Il database contiene modifiche rispetto alla baseline: ${item.slug}. Nessuna sovrascrittura.`)
      updates.push({ item, row })
    }
    if (!write) {
      await client.query('COMMIT')
      inTransaction = false
      console.log(`Database verificato in sola lettura: ${updates.length} bozze da aggiornare; ${17 - updates.length} già conformi.`)
      return
    }
    const snapshot = createSnapshot('database-before', { at: new Date().toISOString(), organizationId, assets, rows })
    for (const { item, row } of updates) {
      // Change only the three image-bearing fields. Preserve every other settings key.
      const result = await client.query(`UPDATE blog_posts SET settings=
        jsonb_set(jsonb_set(jsonb_set(settings, '{blog,cover}', to_jsonb($1::text), false),
        '{blog,coverAlt}', to_jsonb($2::text), false), '{blog,body}', to_jsonb($3::text), false), updated_at=now()
        WHERE id=$4 AND organization_id=$5 AND slug=$6 AND status='draft'
          AND settings->'blog'->>'status'='draft' AND settings->'blog'->'publishedAt'='null'::jsonb
        RETURNING id`, [item.after.cover, item.after.coverAlt, item.after.body, row.id, organizationId, item.slug])
      assert(result.rowCount === 1, `Scrittura non riuscita: ${item.slug}`)
    }
    const { rows: checked } = await client.query('SELECT * FROM blog_posts WHERE organization_id=$1 AND slug=ANY($2::text[])',
      [organizationId, knownSlugs])
    validateSet(checked, 'Verifica database')
    for (const item of plan) {
      const row = checked.find(record => record.slug === item.slug)
      const original = rows.find(record => record.slug === item.slug)
      assert(row.status === 'draft' && row.settings.blog.publishedAt === null && sameSourceFields(row.settings.blog, item.after),
        `Verifica contenuto/stato fallita: ${item.slug}`)
      const expectedSettings = { ...original.settings, blog: { ...original.settings.blog,
        cover: item.after.cover, coverAlt: item.after.coverAlt, body: item.after.body } }
      assert(digest(row.settings) === digest(expectedSettings), `Un altro campo settings è cambiato: ${item.slug}`)
      const allowed = new Set(['settings', 'updated_at'])
      assert(Object.keys(original).filter(key => !allowed.has(key)).every(key => digest(original[key]) === digest(row[key])),
        `Un altro campo della riga è cambiato: ${item.slug}`)
    }
    await client.query('COMMIT')
    inTransaction = false
    const receipt = createSnapshot('database-after', { at: new Date().toISOString(), organizationId, snapshot,
      updated: updates.map(({ item }) => item.slug), publicArticlesChanged: false, allRemainDraft: true })
    console.log(`Aggiornate ${updates.length} bozze nel database in un’unica transazione. Snapshot: ${snapshot}\nRicevuta: ${receipt}`)
  } catch (error) {
    if (inTransaction) await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

async function main() {
  assert([...args].every(arg => validArgs.has(arg)), 'Opzione sconosciuta. Usare --help.')
  assert(modes.length <= 1, '--apply-local, --write-db e --check-db sono passaggi separati.')
  if (args.has('--help')) {
    console.log('Uso: node outputs/advertorial-storie-2026-09-18/apply-story-images.mjs [opzione]\n'
      + 'Senza opzioni: verifica locale e piano, nessuna modifica né connessione al database.\n'
      + '--require-assets  Richiede tutti i 50 WebP anche nel controllo locale.\n'
      + '--apply-local     Applica alle 17 sorgenti JSON dopo snapshot e verifica hash.\n'
      + '--check-db        Verifica il database in sola lettura.\n'
      + '--write-db        Aggiorna solo le 17 bozze nella transazione; non pubblica.\n'
      + 'Le due applicazioni sono distinte. Verificare visivamente le 50 immagini prima di applicare.')
    return
  }
  const { plan, generatedPaths } = preparePlan()
  const { missing, assets } = await inspectAssets(generatedPaths)
  console.log(`Validati 17 articoli, 17 identità distinte, 50 percorsi unici e una foto reale. Testi e struttura editoriale invariati.`)
  console.log(`Sorgenti già aggiornate: ${plan.filter(item => item.alreadyApplied).length}/17. Asset presenti: ${assets.length}/50.`)
  if (missing.length) console.log(`Asset ancora mancanti: ${missing.length}. Esempio: ${missing[0]}`)
  if (args.has('--require-assets') || args.has('--apply-local') || args.has('--write-db')) {
    assert(!missing.length, 'Applicazione bloccata: completare i 50 asset prima di continuare.')
  }
  if (args.has('--apply-local')) applyLocal(plan, assets)
  else if (args.has('--write-db') || args.has('--check-db')) await databaseAction(plan, assets, args.has('--write-db'))
  else console.log('Piano locale completato. Nessun file sorgente e nessun database modificati.')
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
