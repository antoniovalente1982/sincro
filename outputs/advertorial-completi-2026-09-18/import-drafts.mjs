import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import dotenv from 'dotenv'
import pg from 'pg'
import blogHelpers from '../../lib/blog.ts'

const { validateBlogInput, blogImageBlock, blogTextBlocks } = blogHelpers

const folder = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(folder, '../..')
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'))
const articles = manifest.filter(item => !item.legacy).map(item => {
    const article = JSON.parse(fs.readFileSync(path.join(folder, 'articles', `${item.slug}.json`), 'utf8'))
    if (article.slug !== item.slug || article.status !== 'draft') throw new Error(`Bozza incoerente: ${item.slug}`)
    const validated = validateBlogInput({ ...article, status: 'active' })
    if (!validated.ok) throw new Error(`${item.slug}: ${validated.error}`)
    const images = blogTextBlocks(article.body).filter(block => block.startsWith('![')).map(block => {
        const image = blogImageBlock(block)
        if (!image?.caption) throw new Error(`Immagine/didascalia non valida: ${item.slug}`)
        return image
    })
    if (images.length < 2) throw new Error(`Servono due immagini interne: ${item.slug}`)
    for (const image of [{ src: article.cover }, ...images]) {
        if (!fs.existsSync(path.join(root, 'public', image.src))) throw new Error(`Asset mancante: ${image.src}`)
    }
    return article
})
if (articles.length !== 17 || new Set(articles.map(a => a.slug)).size !== 17) throw new Error('Il lotto deve contenere 17 nuove bozze distinte.')
const report = articles.map(a => ({ slug: a.slug, title: a.title, words: a.body.split(/\s+/).length, images: 1 + blogTextBlocks(a.body).filter(b => !!blogImageBlock(b)).length, status: a.status, sha256: crypto.createHash('sha256').update(JSON.stringify(a)).digest('hex') }))
fs.writeFileSync(path.join(folder, 'VALIDAZIONE.json'), JSON.stringify(report, null, 2) + '\n')
console.log(`Validati ${articles.length} advertorial, tutti in bozza, con immagini e campi SEO.`)

if (!process.argv.includes('--write')) {
    console.log('Controllo locale completato. Nessuna scrittura nel database.')
} else {
    dotenv.config({ path: path.join(root, '.env.local'), quiet: true })
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
        await client.query('BEGIN')
        const { rows: funnels } = await client.query('SELECT id, organization_id, status FROM funnels WHERE slug = $1', ['pochi-minuti'])
        if (funnels.length !== 1 || funnels[0].id !== '68141107-22de-40fd-a80e-ca362076c81c' || funnels[0].organization_id !== 'a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5') throw new Error('Organizzazione inattesa: nessuna modifica applicata.')
        const org = funnels[0].organization_id
        const { rows: before } = await client.query('SELECT * FROM blog_posts WHERE organization_id=$1 AND slug=ANY($2::text[]) FOR UPDATE', [org, articles.map(a => a.slug)])
        const backup = path.join(folder, `database-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
        fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
        const result = []
        for (const article of articles) {
            const existing = before.find(row => row.slug === article.slug)
            if (existing && existing.status !== 'draft') throw new Error(`L'articolo è pubblico o archiviato: ${article.slug}`)
            if (existing && existing.settings?.blog?.body === article.body) {
                const same = Object.keys(article).every(key => existing.settings.blog[key] === article[key])
                if (same) { result.push({ id: existing.id, slug: article.slug, action: 'unchanged' }); continue }
            }
            if (existing && !(existing.id === '1cfe9fec-549c-4915-8b22-3a50ad764d8b' && existing.updated_at.toISOString() === '2026-09-18T13:16:47.311Z' && (existing.settings?.blog?.body || '').length === 653)) {
                throw new Error(`Bozza modificata o inattesa: ${article.slug}. Rivedere prima di sovrascrivere.`)
            }
            const settings = { ...(existing?.settings || {}), template: 'blog_article', blog: { ...article, publishedAt: null } }
            const saved = existing
                ? await client.query('UPDATE blog_posts SET name=$1,description=$2,settings=$3::jsonb,updated_at=now() WHERE id=$4 AND organization_id=$5 AND status=\'draft\' RETURNING id,slug', [article.title, article.excerpt, JSON.stringify(settings), existing.id, org])
                : await client.query('INSERT INTO blog_posts (organization_id,name,slug,description,status,settings) VALUES ($1,$2,$3,$4,\'draft\',$5::jsonb) RETURNING id,slug', [org, article.title, article.slug, article.excerpt, JSON.stringify(settings)])
            if (saved.rowCount !== 1) throw new Error(`Scrittura non riuscita: ${article.slug}`)
            result.push({ ...saved.rows[0], action: existing ? 'completed_existing_draft' : 'created_draft' })
        }
        const { rows: checked } = await client.query('SELECT slug,status,settings->\'blog\'->>\'publishedAt\' AS published_at FROM blog_posts WHERE organization_id=$1 AND slug=ANY($2::text[])', [org, articles.map(a => a.slug)])
        if (checked.length !== 17 || checked.some(row => row.status !== 'draft' || row.published_at !== null)) throw new Error('Verifica finale degli stati fallita.')
        await client.query('COMMIT')
        fs.writeFileSync(path.join(folder, 'IMPORTAZIONE.json'), JSON.stringify({ at: new Date().toISOString(), organizationId: org, publicArticlesChanged: false, backup: path.basename(backup), results: result }, null, 2) + '\n')
        console.log(`Salvate ${result.length} bozze private. Nessuna pubblicazione.`)
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        await client.end()
    }
}
