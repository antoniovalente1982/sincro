export const BLOG_NAME = 'Dentro la partita'
export const BLOG_TEMPLATE = 'blog_article'
export const BLOG_ORIGIN = process.env.NEXT_PUBLIC_BLOG_ORIGIN || 'https://landing.metodosincro.com'
export const BLOG_TOPICS = [
    { id: 'fiducia', label: 'Fiducia e paura di sbagliare' },
    { id: 'panchina', label: 'Panchina e poco spazio' },
    { id: 'crescita', label: 'Crescita e cambi di categoria' },
    { id: 'genitori', label: 'Essere genitori a bordo campo' },
    { id: 'pressione', label: 'Pressione e partita' },
    { id: 'ripartenza', label: 'Motivazione e ripartenza' },
] as const

export interface BlogInput {
    title: string; slug: string; excerpt: string; body: string; topic: string
    seoTitle: string; seoDescription: string; cover: string; coverAlt: string
    status: 'draft' | 'active' | 'archived'
}
export interface BlogPost extends BlogInput {
    id: string; updatedAt: string; publishedAt: string | null; createdAt: string
}
export interface LegacyArticle { id: string; title: string; slug: string; status: string; description: string }
export interface BlogRow {
    id: string; slug: string; name: string; status: string; description?: string
    created_at: string; updated_at: string
    settings: Record<string, unknown> & { template?: string; blog?: BlogInput & { publishedAt?: string | null } }
}

export function safeBlogLink(value: string): string | null {
    if (/^\/(?!\/)[^\\\s]*$/.test(value)) return value
    try { return new URL(value).protocol === 'https:' ? value : null } catch { return null }
}
export function blogCanonical(slug?: string, origin = BLOG_ORIGIN): string {
    return `${origin.replace(/\/$/, '')}/blog${slug ? `/${slug}` : ''}`
}
export function blogNavigationHref(path: string, search: string): string {
    const incoming = new URLSearchParams(search)
    const params = new URLSearchParams()
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'fbadid']) {
        const value = incoming.get(key)
        if (value) params.set(key, value.slice(0, 500))
    }
    if (incoming.get('ab') === 'A') params.set('ab', 'A')
    return `${path}${params.size ? `?${params}` : ''}`
}
export function blogConsultationHref(slug: string, search: string, preview = false): string {
    const params = new URLSearchParams(search)
    const outgoing = new URLSearchParams()
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'fbadid']) {
        const value = params.get(key)
        if (value) outgoing.set(key, value.slice(0, 500))
    }
    outgoing.set('entry', `blog-${slug}`)
    if (preview) outgoing.set('ab', 'A')
    return `/f/salto-di-qualita?${outgoing}#ms-form`
}
export function blogEntry(value: unknown): string | null {
    return typeof value === 'string' && /^(?:blog-[a-z0-9]+(?:-[a-z0-9]+)*|advertorial-pochi-minuti)$/.test(value) && value.length <= 110 ? value : null
}
export function isPublishedBlog(row: { status: string; settings?: { template?: string; blog?: { publishedAt?: string | null } } }): boolean {
    return row.status === 'active' && row.settings?.template === BLOG_TEMPLATE && !!row.settings.blog?.publishedAt && Number.isFinite(Date.parse(row.settings.blog.publishedAt))
}
export function rowToBlogPost(row: BlogRow): BlogPost {
    return { ...row.settings.blog!, status: row.status as BlogInput['status'], id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.settings.blog?.publishedAt || null }
}
export function validateBlogInput(value: unknown): { ok: true; data: BlogInput } | { ok: false; error: string } {
    if (!value || typeof value !== 'object') return { ok: false, error: 'Contenuto non valido.' }
    const source = value as Record<string, unknown>
    const fields = ['title', 'slug', 'excerpt', 'body', 'topic', 'seoTitle', 'seoDescription', 'cover', 'coverAlt'] as const
    const data = {} as BlogInput
    for (const field of fields) {
        if (typeof source[field] !== 'string') return { ok: false, error: `Campo mancante: ${field}.` }
        data[field] = source[field].trim()
    }
    if (!['draft', 'active', 'archived'].includes(String(source.status))) return { ok: false, error: 'Stato non valido.' }
    data.status = source.status as BlogInput['status']
    if (!data.title || data.title.length > 200) return { ok: false, error: 'Inserisci un titolo entro 200 caratteri.' }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug) || data.slug.length > 90 || ['anteprima', 'feed', 'sitemap', 'tag', 'categoria'].includes(data.slug)) return { ok: false, error: 'Indirizzo non valido: usa lettere minuscole, numeri e trattini.' }
    if (!BLOG_TOPICS.some(topic => topic.id === data.topic)) return { ok: false, error: 'Scegli un argomento.' }
    if (data.body.length > 80000 || data.excerpt.length > 500 || data.seoTitle.length > 100 || data.seoDescription.length > 240 || data.coverAlt.length > 300) return { ok: false, error: 'Uno dei testi supera il limite consentito.' }
    if (data.cover && (!/^\/(?:images|advertorial-pochi-minuti)\/[a-zA-Z0-9/_.-]+\.(?:webp|jpg|jpeg|png)$/.test(data.cover) || data.cover.includes('..'))) return { ok: false, error: 'Scegli una delle immagini del progetto.' }
    if (data.status === 'active' && (!data.excerpt || data.body.length < 800 || !data.seoTitle || !data.seoDescription || (data.cover && !data.coverAlt))) return { ok: false, error: 'Prima di pubblicare completa introduzione, articolo (almeno 800 caratteri), titolo e descrizione SEO e testo alternativo dell’immagine.' }
    return { ok: true, data }
}
