import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import pg from 'pg'
import dotenv from 'dotenv'
import blogModule from '../../lib/blog.ts'
const { validateBlogInput } = blogModule

dotenv.config({ path: '.env.local', quiet: true })
const dir = 'outputs/advertorial-storie-2026-09-18'
const mapping = JSON.parse(await fs.readFile(dir + '/IMAGE_MAPPING.json', 'utf8'))
const slugs = mapping.articles.map(a => a.slug)
assert.equal(slugs.length, 17)
assert.equal(new Set(slugs).size, 17)
const sourceDir = 'outputs/advertorial-completi-2026-09-18/articles'
const sources = new Map(await Promise.all(slugs.map(async slug => [slug, JSON.parse(await fs.readFile(sourceDir + '/' + slug + '.json', 'utf8'))])))
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
let transaction = false
try {
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
  transaction = true
  const { rows } = await client.query('SELECT * FROM blog_posts WHERE organization_id=$1 AND slug=ANY($2::text[]) FOR UPDATE', [mapping.organizationId, slugs])
  assert.equal(rows.length, 17)
  for (const row of rows) {
    assert.equal(row.settings.template, 'blog_article')
    assert.ok(['draft', 'active'].includes(row.status), 'Stato inatteso: ' + row.slug)
    const source = sources.get(row.slug)
    for (const [field, value] of Object.entries(source)) if (field !== 'status') assert.deepEqual(row.settings.blog[field], value, 'Contenuto cambiato: ' + row.slug + '/' + field)
    assert.equal(row.settings.blog.status, row.status)
    if (row.status === 'draft') assert.equal(row.settings.blog.publishedAt, null)
    else assert.ok(Number.isFinite(Date.parse(row.settings.blog.publishedAt)))
    const validated = validateBlogInput({ ...row.settings.blog, status: 'active' })
    assert.equal(validated.ok, true, 'Validazione pubblicazione: ' + row.slug)
  }
  const now = new Date().toISOString()
  const stamp = now.replaceAll(':', '-')
  await fs.mkdir(dir + '/snapshots', { recursive: true })
  const snapshot = dir + '/snapshots/publication-before-' + stamp + '.json'
  await fs.writeFile(snapshot, JSON.stringify({ at: now, rows }, null, 2) + '\n', { mode: 0o600 })
  const drafts = rows.filter(row => row.status === 'draft')
  for (const row of drafts) {
    const result = await client.query(`UPDATE blog_posts SET status='active', updated_at=$1::text::timestamptz,
      settings=jsonb_set(jsonb_set(settings,'{blog,status}','"active"'::jsonb,false),'{blog,publishedAt}',to_jsonb($1::text),false)
      WHERE id=$2 AND organization_id=$3 AND status='draft' RETURNING id`, [now, row.id, mapping.organizationId])
    assert.equal(result.rowCount, 1)
  }
  const { rows: after } = await client.query('SELECT * FROM blog_posts WHERE organization_id=$1 AND slug=ANY($2::text[])', [mapping.organizationId, slugs])
  assert.equal(after.length, 17)
  for (const row of after) {
    const before = rows.find(r => r.id === row.id)
    assert.equal(row.status, 'active')
    const expected = { ...before.settings, blog: { ...before.settings.blog, status: 'active', publishedAt: before.settings.blog.publishedAt || now } }
    assert.deepEqual(row.settings, expected, 'Modifica inattesa nei contenuti: ' + row.slug)
    for (const field of Object.keys(before)) if (!['status', 'settings', 'updated_at'].includes(field)) assert.deepEqual(row[field], before[field])
  }
  await client.query('COMMIT')
  transaction = false
  const report = { publishedAt: now, count: after.length, newlyPublished: drafts.length, snapshot, posts: after.map(row => ({ slug: row.slug, title: row.settings.blog.title, url: 'https://landing.metodosincro.com/blog/' + row.slug, status: row.status, publishedAt: row.settings.blog.publishedAt })) }
  await fs.writeFile(dir + '/PUBBLICAZIONE.json', JSON.stringify(report, null, 2) + '\n')
  for (const row of after) await fs.writeFile(sourceDir + '/' + row.slug + '.json', JSON.stringify({ ...sources.get(row.slug), status: 'active' }, null, 2) + '\n')
  console.log(JSON.stringify({ published: after.length, newlyPublished: drafts.length, snapshot, receipt: dir + '/PUBBLICAZIONE.json' }))
} catch (error) {
  if (transaction) await client.query('ROLLBACK')
  throw error
} finally { await client.end() }
