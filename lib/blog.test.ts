import assert from 'node:assert/strict'
import test from 'node:test'
import { validateBlogInput, blogConsultationHref, blogCanonical, isPublishedBlog, safeBlogLink, blogNavigationHref, blogEntry, blogEntryHref, blogTextBlocks, blogImageBlock, blogDashboardSelection, type BlogPost } from './blog'

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
    assert.equal(safeBlogLink('#consulenza'), '#consulenza')
    assert.equal(safeBlogLink('#<script>'), null)
    assert.equal(safeBlogLink('#consulenza onclick=alert(1)'), null)
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


test('l’ingresso pubblico apre il primo advertorial e conserva solo i parametri di campagna', () => {
    const legacy = [{ id: 'one', slug: 'pochi-minuti', title: 'Titolo', description: '', status: 'active' }]
    assert.equal(blogEntryHref([], legacy, 'utm_source=meta&email=privata&ab=A'), '/f/pochi-minuti?utm_source=meta&ab=A')
})
test('l’ingresso non apre bozze né advertorial ritirati', () => {
    const post = { ...draft, id: 'draft', createdAt: '', updatedAt: '', publishedAt: null } as BlogPost
    assert.equal(blogEntryHref([post], [{ id: 'one', slug: 'pochi-minuti', title: 'Titolo', description: '', status: 'draft' }]), null)
    assert.equal(blogEntryHref([{ ...post, status: 'active', publishedAt: '2026-09-18T10:00:00Z' }], []), '/blog/paura-di-sbagliare')
})

test('un sottotitolo seguito subito da un elenco non assorbe il testo dell’advertorial', () => {
    assert.deepEqual(blogTextBlocks('Introduzione.\n## Capire la panchina\n- Primo punto\n- Secondo punto\n\n### Una domanda\nLa risposta.'), ['Introduzione.', '## Capire la panchina', '- Primo punto\n- Secondo punto', '### Una domanda', 'La risposta.'])
})

test('un’immagine locale diventa un blocco con descrizione accessibile e didascalia facoltativa', () => {
    assert.deepEqual(blogImageBlock('![Un genitore ascolta il figlio a bordo campo](/images/blog/incoraggiare-figlio.webp "Ascoltare prima di dare consigli.")'), {
        src: '/images/blog/incoraggiare-figlio.webp', alt: 'Un genitore ascolta il figlio a bordo campo', caption: 'Ascoltare prima di dare consigli.',
    })
    assert.deepEqual(blogImageBlock('![Un calciatore torna in campo](/advertorial-pochi-minuti/ritorno-al-gioco-17-anni.webp)'), {
        src: '/advertorial-pochi-minuti/ritorno-al-gioco-17-anni.webp', alt: 'Un calciatore torna in campo', caption: undefined,
    })
})

test('le immagini rifiutano URL esterni, percorsi ambigui e contenuti eseguibili', () => {
    for (const path of [
        'https://external.test/image.webp', '//external.test/image.webp', 'data:image/png;base64,abc',
        'javascript:alert(1)', '/images/blog/../secret.webp', '/images/blog/%2e%2e/secret.webp',
        '/images/blog/./panchina.webp', '/images//panchina.webp', '/images/blog\\panchina.webp',
        '/images/blog/panchina.svg', '/api/private.webp', '/images/blog/panchina.webp?download=1',
        '/images/blog/panchina.webp#fragment', '/images/blog/panchina.webp" onerror="alert(1)',
    ]) assert.equal(blogImageBlock(`![Un calciatore a bordo campo](${path})`), null, path)
    for (const block of [
        '![](/images/blog/panchina.webp)', '![   ](/images/blog/panchina.webp)',
        '![<img src=x onerror=alert(1)>](/images/blog/panchina.webp)',
        '![Un calciatore](/images/blog/panchina.webp "<script>alert(1)</script>")',
        'Testo ![Un calciatore](/images/blog/panchina.webp)',
        '![Un calciatore](/images/blog/panchina.webp)\nUn altro paragrafo.',
    ]) assert.equal(blogImageBlock(block), null, block)
})

test('l’anteprima diretta seleziona soltanto articoli già caricati per l’organizzazione autorizzata', () => {
    const post = { ...draft, id: 'draft', createdAt: '', updatedAt: '', publishedAt: null } as BlogPost
    assert.deepEqual(blogDashboardSelection([post], { articolo: post.slug, vista: 'anteprima' }), { post, preview: true })
    assert.deepEqual(blogDashboardSelection([post], { articolo: post.slug }), { post, preview: false })
    assert.equal(blogDashboardSelection([post], { articolo: 'bozza-di-un-altro-tenant', vista: 'anteprima' }), null)
    assert.equal(blogDashboardSelection([], { articolo: post.slug, vista: 'anteprima' }), null)
    assert.equal(blogDashboardSelection([post], { articolo: [post.slug], vista: 'anteprima' }), null)
    assert.equal(blogDashboardSelection([post], { vista: 'anteprima' }), null)
    assert.deepEqual(blogDashboardSelection([post], { articolo: post.slug, vista: ['anteprima'] }), { post, preview: false })
})
