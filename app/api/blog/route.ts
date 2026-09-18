import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org-context'
import { canAccessSection } from '@/lib/permissions'
import { BLOG_TEMPLATE, rowToBlogPost, validateBlogInput, type BlogRow } from '@/lib/blog'
import { BLOG_SELECT, legacyArticles } from '@/lib/blog-server'

async function context() {
    const supabase = await createClient()
    const org = await getOrgContext(supabase)
    if (!org) return { error: NextResponse.json({ error: 'Accedi al gestionale.' }, { status: 401 }) }
    if (!canAccessSection(org.role, org.department, 'blog')) return { error: NextResponse.json({ error: 'Non hai accesso al Blog.' }, { status: 403 }) }
    return { supabase, org }
}

export async function GET() {
    const ctx = await context()
    if (ctx.error) return ctx.error
    const [articles, funnels] = await Promise.all([
        ctx.supabase.from('blog_posts').select(BLOG_SELECT).eq('organization_id', ctx.org.organization_id).order('updated_at', { ascending: false }),
        ctx.supabase.from('funnels').select(BLOG_SELECT).eq('organization_id', ctx.org.organization_id).order('updated_at', { ascending: false }),
    ])
    if (articles.error || funnels.error) return NextResponse.json({ error: 'Non è stato possibile caricare il Blog.' }, { status: 503 })
    return NextResponse.json({ posts: ((articles.data || []) as BlogRow[]).map(rowToBlogPost), legacy: legacyArticles((funnels.data || []) as BlogRow[]) })
}

async function save(req: NextRequest, editing: boolean) {
    // Cookie authentication is same-origin. Reject writes from other websites.
    const origin = req.headers.get('origin')
    if (origin && origin !== req.nextUrl.origin) return NextResponse.json({ error: 'Origine non consentita.' }, { status: 403 })
    const ctx = await context()
    if (ctx.error) return ctx.error
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 }) }
    const parsed = validateBlogInput(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    let existing: BlogRow | null = null
    if (editing) {
        if (typeof body.id !== 'string' || typeof body.updatedAt !== 'string') return NextResponse.json({ error: 'Manca la versione dell’articolo.' }, { status: 400 })
        const result = await ctx.supabase.from('blog_posts').select(BLOG_SELECT).eq('id', body.id).eq('organization_id', ctx.org.organization_id).maybeSingle()
        if (result.error) return NextResponse.json({ error: 'Lettura non riuscita. Riprova.' }, { status: 503 })
        existing = result.data as BlogRow | null
        if (!existing) return NextResponse.json({ error: 'Articolo non trovato.' }, { status: 404 })
        if (existing.updated_at !== body.updatedAt) return NextResponse.json({ error: 'L’articolo è stato aggiornato altrove. Ricarica prima di salvare.' }, { status: 409 })
        if (existing.settings.blog?.slug !== parsed.data.slug) return NextResponse.json({ error: 'L’indirizzo di un articolo salvato rimane stabile.' }, { status: 400 })
    }
    const now = new Date().toISOString()
    const data = parsed.data
    const record = {
        name: data.title, slug: data.slug, description: data.excerpt, status: data.status, updated_at: now,
        settings: { ...(existing?.settings || {}), template: BLOG_TEMPLATE, blog: { ...data, publishedAt: existing?.settings.blog?.publishedAt || (data.status === 'active' ? now : null) } },
    }
    const result = editing
        ? await ctx.supabase.from('blog_posts').update(record).eq('id', existing!.id).eq('organization_id', ctx.org.organization_id).eq('updated_at', body.updatedAt).select(BLOG_SELECT).maybeSingle()
        : await ctx.supabase.from('blog_posts').insert({ ...record, organization_id: ctx.org.organization_id }).select(BLOG_SELECT).single()
    if (result.error) return NextResponse.json({ error: result.error.code === '23505' ? 'Questo indirizzo è già utilizzato. Scegline un altro.' : 'Salvataggio non riuscito. Il testo è ancora nell’editor.' }, { status: result.error.code === '23505' ? 409 : 503 })
    if (!result.data) return NextResponse.json({ error: 'Versione modificata altrove. Ricarica prima di salvare.' }, { status: 409 })
    return NextResponse.json(rowToBlogPost(result.data as BlogRow))
}
export function POST(req: NextRequest) { return save(req, false) }
export function PUT(req: NextRequest) { return save(req, true) }
