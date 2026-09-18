import assert from 'node:assert/strict'
import test from 'node:test'
import { validateBlogInput, blogConsultationHref, blogCanonical, isPublishedBlog, safeBlogLink, blogNavigationHref, blogEntry } from './blog'

const draft = { title: 'Mio figlio ha paura di sbagliare', slug: 'paura-di-sbagliare', excerpt: '', body: '', topic: 'fiducia', seoTitle: '', seoDescription: '', cover: '', coverAlt: '', status: 'draft' }

test('una bozza può essere incompleta, una pubblicazione richiede contenuto e SEO', () => {
    assert.equal(validateBlogInput(draft).ok, true)
    assert.equal(validateBlogInput({ ...draft, status: 'active' }).ok, false)
})
test('slug riservati o percorsi non possono diventare articoli', () => {
    for (const slug of ['anteprima', '../api', 'Titolo', 'con spazi', '']) assert.equal(validateBlogInput({ ...draft, slug }).ok, false)
})
test('il canonical usa il dominio configurato senza parametri', () => {
    assert.equal(blogCanonical('paura-di-sbagliare', 'https://blog.metodosincro.it/'), 'https://blog.metodosincro.it/blog/paura-di-sbagliare')
})
test('CTA conserva le campagne e registra articolo senza creare UTM interni', () => {
    const url = new URL(blogConsultationHref('paura-di-sbagliare', 'utm_source=meta&utm_campaign=test&email=private@example.com&entry=other'), 'https://example.com')
    assert.equal(url.searchParams.get('utm_source'), 'meta')
    assert.equal(url.searchParams.get('entry'), 'blog-paura-di-sbagliare')
    assert.equal(url.searchParams.has('email'), false)
    assert.equal(new URL(blogConsultationHref('paura-di-sbagliare', ''), 'https://example.com').searchParams.has('utm_source'), false)
})
test('bozze, record di altri template e articoli senza data non sono pubblici', () => {
    assert.equal(isPublishedBlog({ status: 'draft', settings: { template: 'blog_article', blog: { publishedAt: '2026-09-18T10:00:00Z' } } }), false)
    assert.equal(isPublishedBlog({ status: 'active', settings: { template: 'metodo_sincro' } }), false)
    assert.equal(isPublishedBlog({ status: 'active', settings: { template: 'blog_article', blog: {} } }), false)
    assert.equal(isPublishedBlog({ status: 'active', settings: { template: 'blog_article', blog: { publishedAt: '2026-09-18T10:00:00Z' } } }), true)
})
test('link del testo ammettono HTTPS e percorsi locali, mai javascript o protocol-relative', () => {
    assert.equal(safeBlogLink('javascript:alert(1)'), null)
    assert.equal(safeBlogLink('//evil.test'), null)
    assert.equal(safeBlogLink('/blog/paura-di-sbagliare'), '/blog/paura-di-sbagliare')
    assert.equal(safeBlogLink('https://www.metodosincro.it'), 'https://www.metodosincro.it')
})
test('la navigazione tra articoli mantiene UTM ma esclude identificatori personali', () => {
    assert.equal(blogNavigationHref('/blog/uno', 'utm_source=meta&email=privata&ab=A'), '/blog/uno?utm_source=meta&ab=A')
})
test('la provenienza editoriale accetta soltanto identificatori riconoscibili', () => {
    assert.equal(blogEntry('blog-paura-di-sbagliare'), 'blog-paura-di-sbagliare')
    assert.equal(blogEntry('advertorial-pochi-minuti'), 'advertorial-pochi-minuti')
    assert.equal(blogEntry('email=privata@example.com'), null)
    assert.equal(blogEntry({ article: 'x' }), null)
})
test('un articolo completo può essere pubblicato, percorsi immagine esterni vengono rifiutati', () => {
    const complete = { ...draft, status: 'active', body: 'Testo originale e utile. '.repeat(50), excerpt: 'La situazione del genitore.', seoTitle: 'Paura di sbagliare nel calcio', seoDescription: 'Un approfondimento per i genitori.' }
    assert.equal(validateBlogInput(complete).ok, true)
    assert.equal(validateBlogInput({ ...complete, cover: 'https://external.test/image.jpg' }).ok, false)
    assert.equal(validateBlogInput({ ...complete, cover: '/images/../../secret.png' }).ok, false)
})
