import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getOrgContext } from '@/lib/org-context'
import { canAccessSection } from '@/lib/permissions'
import { blogEntry } from '@/lib/blog'
import { buildEditorialReport, editorialReportWindow, EDITORIAL_EVENT_SELECT, paginateEditorialEvents, type EditorialArticle } from '@/lib/editorial-report'

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const org = await getOrgContext(supabase)
    if (!org) return NextResponse.json({ error: 'Accedi al gestionale.' }, { status: 401 })
    if (!canAccessSection(org.role, org.department, 'blog')) return NextResponse.json({ error: 'Non hai accesso al Blog.' }, { status: 403 })
    const entry = req.nextUrl.searchParams.get('article')
    if (entry && !blogEntry(entry)) return NextResponse.json({ error: 'Articolo non valido.' }, { status: 400 })
    let window
    try { window = editorialReportWindow(req.nextUrl.searchParams.get('from'), req.nextUrl.searchParams.get('to')) }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }) }
    try {
        const admin = getSupabaseAdmin()
        const [events, posts, legacy] = await Promise.all([
            paginateEditorialEvents((from, to) => {
                let query = admin.from('editorial_events').select(EDITORIAL_EVENT_SELECT).eq('organization_id', org.organization_id)
                    .not('entry_key', 'is', null).gte('occurred_at', window.start).lte('occurred_at', window.followUpEnd)
                    .order('occurred_at').order('id')
                if (entry) query = query.eq('entry_key', entry)
                return query.range(from, to)
            }),
            supabase.from('blog_posts').select('name,slug').eq('organization_id', org.organization_id),
            supabase.from('funnels').select('name,slug').eq('organization_id', org.organization_id).eq('slug', 'pochi-minuti'),
        ])
        if (posts.error || legacy.error) throw new Error('Non è stato possibile caricare gli articoli del report. Riprova.')
        const articles: EditorialArticle[] = [
            ...(posts.data || []).map(post => ({ entryKey: `blog-${post.slug}`, title: post.name, href: `/blog/${post.slug}` })),
            ...(legacy.data || []).map(post => ({ entryKey: 'advertorial-pochi-minuti', title: post.name, href: '/f/pochi-minuti?ab=A' })),
        ]
        return NextResponse.json(buildEditorialReport(events, articles, window, entry), { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Report non disponibile. Riprova.'
        return NextResponse.json({ error: message }, { status: message.startsWith('Troppi') ? 422 : 503 })
    }
}
