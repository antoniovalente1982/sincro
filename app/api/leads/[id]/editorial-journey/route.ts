import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getOrgContext } from '@/lib/org-context'
import { canAccessSection } from '@/lib/permissions'
import { buildLeadEditorialJourney, editorialJourneyWindows, EDITORIAL_EVENT_SELECT, paginateEditorialEvents, type EditorialArticle, type EditorialReportEvent } from '@/lib/editorial-report'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient()
    const org = await getOrgContext(supabase)
    if (!org) return NextResponse.json({ error: 'Accedi al gestionale.' }, { status: 401 })
    if (!canAccessSection(org.role, org.department, 'crm')) return NextResponse.json({ error: 'Non hai accesso al CRM.' }, { status: 403 })
    const { id } = await params
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: 'Contatto non trovato.' }, { status: 404 })
    // Do not bypass lead visibility: this query uses the logged-in user's RLS.
    const lead = await supabase.from('leads').select('id').eq('organization_id', org.organization_id).eq('id', id).maybeSingle()
    if (lead.error) return NextResponse.json({ error: 'Non è stato possibile verificare il contatto.' }, { status: 503 })
    if (!lead.data) return NextResponse.json({ error: 'Contatto non trovato.' }, { status: 404 })
    try {
        const admin = getSupabaseAdmin()
        const submissions = await paginateEditorialEvents((from, to) => admin.from('editorial_events').select(EDITORIAL_EVENT_SELECT)
            .eq('organization_id', org.organization_id).eq('lead_id', id).eq('event_name', 'lead_submitted')
            .order('occurred_at').order('id').range(from, to), 10_000)
        const prior: EditorialReportEvent[] = []
        for (const window of editorialJourneyWindows(submissions)) {
            prior.push(...await paginateEditorialEvents((from, to) => admin.from('editorial_events').select(EDITORIAL_EVENT_SELECT)
                .eq('organization_id', org.organization_id).eq('visitor_id', window.visitor).neq('event_name', 'lead_submitted')
                .gte('occurred_at', window.start).lte('occurred_at', window.end)
                .order('occurred_at').order('id').range(from, to), 10_000))
            if (prior.length > 10_000) throw new Error('Troppi eventi per mostrare la cronologia completa.')
        }
        const [posts, legacy] = await Promise.all([
            admin.from('blog_posts').select('name,slug').eq('organization_id', org.organization_id),
            admin.from('funnels').select('name,slug').eq('organization_id', org.organization_id).eq('slug', 'pochi-minuti'),
        ])
        if (posts.error || legacy.error) throw new Error('Non è stato possibile caricare gli articoli della cronologia.')
        const articles: EditorialArticle[] = [
            ...(posts.data || []).map(post => ({ entryKey: `blog-${post.slug}`, title: post.name, href: `/blog/${post.slug}` })),
            ...(legacy.data || []).map(post => ({ entryKey: 'advertorial-pochi-minuti', title: post.name, href: '/f/pochi-minuti?ab=A' })),
        ]
        return NextResponse.json(buildLeadEditorialJourney(submissions, prior, articles), { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Cronologia non disponibile. Riprova.' }, { status: 503 })
    }
}
