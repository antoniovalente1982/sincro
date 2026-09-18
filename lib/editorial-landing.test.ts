import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEditorialLanding, editorialLandingFromRow } from './editorial-landing'
import { validateBlogInput, type BlogInput, type BlogRow } from './blog'

const article: BlogInput = { title: 'Un argomento futuro', slug: 'nuovo-articolo-2027', topic: 'panchina', excerpt: 'Una nuova storia.', body: 'Testo. '.repeat(150), seoTitle: 'Titolo', seoDescription: 'Descrizione', cover: '/images/blog/futuro.webp', coverAlt: 'Un momento al campo', status: 'active' }
const row: BlogRow & { organization_id: string } = { id: 'one', organization_id: 'our-org', name: article.title, slug: article.slug, status: 'active', created_at: '', updated_at: '', settings: { template: 'blog_article', blog: { ...article, publishedAt: '2026-09-18T12:00:00Z' } } }

test('un articolo futuro genera una landing completa senza registrare il suo slug', () => {
    const landing = editorialLandingFromRow(`blog-${article.slug}`, 'our-org', row)!
    assert.equal(landing.headline, article.title)
    assert.equal(landing.image, article.cover)
    assert.equal(landing.themeId, 'panchina')
    assert.match(landing.theme.problem, /panchina/i)
    assert.equal(landing.theme.signals.length, 3)
    assert.equal(landing.theme.skills.length, 3)
    assert.match(landing.faqs[0].q, /minuti|titolare/)
})
test('non si espongono bozze, articoli ritirati, altri tenant o slug non corrispondenti', () => {
    const entry = `blog-${article.slug}`
    for (const altered of [{ ...row, organization_id: 'another-org' }, { ...row, status: 'draft' }, { ...row, status: 'archived' }, { ...row, slug: 'different' }, { ...row, settings: { template: 'other', blog: row.settings.blog } }, { ...row, settings: { template: 'blog_article', blog: { ...article, publishedAt: null } } }]) assert.equal(editorialLandingFromRow(entry, 'our-org', altered), null)
    for (const entry of [undefined, ['blog-nuovo-articolo-2027'], '__proto__', 'blog-../privato', 'blog-inesistente']) assert.equal(editorialLandingFromRow(entry, 'our-org', row), null)
})
test('i campi facoltativi sono compatibili con vecchi articoli e validati nel salvataggio', () => {
    assert.equal(validateBlogInput(article).ok, true)
    const result = validateBlogInput({ ...article, landingTheme: 'femminile', landingTitle: '  Il suo calcio conta  ', landingIntro: 'Un confronto per il genitore.' })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(buildEditorialLanding(result.data).headline, 'Il suo calcio conta')
    for (const values of [{ landingTheme: '__proto__' }, { landingTheme: 'inventato' }, { landingTitle: 'x'.repeat(201) }, { landingIntro: 12 }]) assert.equal(validateBlogInput({ ...article, ...values }).ok, false)
})
test('il tema femminile si rivolge alla figlia e non eredita promesse di categoria', () => {
    const landing = buildEditorialLanding({ ...article, landingTheme: 'femminile' })
    assert.match(landing.intro, /tua figlia/)
    assert.match(landing.faqs.map(item => item.q).join(' '), /Mia figlia/)
    assert.doesNotMatch(JSON.stringify(landing.faqs), /mio figlio|il ragazzo|del ragazzo/)
    assert.doesNotMatch(landing.theme.cost, /garantito|Serie A/)
})
