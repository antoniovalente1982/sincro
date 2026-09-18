import { cache } from 'react'
import { getSupabaseAdmin } from './supabase/admin'
import { blogEntry, BLOG_DEFAULT_COVER, BLOG_DEFAULT_COVER_ALT, type BlogRow } from './blog'
import { BLOG_SELECT } from './blog-server'
import { buildEditorialLanding, editorialLandingFromRow } from './editorial-landing'

export const getEditorialLanding = cache(async (funnelSlug: string, value: unknown, organizationId: string) => {
    const entry = blogEntry(value)
    if (funnelSlug !== 'salto-di-qualita' || !entry || !organizationId) return null
    try {
        if (entry === 'advertorial-pochi-minuti') {
            const { data, error } = await getSupabaseAdmin().from('funnels').select('id').eq('organization_id', organizationId).eq('slug', 'pochi-minuti').eq('status', 'active').maybeSingle()
            if (error || !data) return null
            return buildEditorialLanding({ title: '«In allenamento è un altro». Perché tuo figlio si blocca proprio quando vuole farsi vedere.', slug: 'pochi-minuti', excerpt: '', body: '', topic: 'panchina', seoTitle: '', seoDescription: '', cover: BLOG_DEFAULT_COVER, coverAlt: BLOG_DEFAULT_COVER_ALT, status: 'active', landingTitle: 'In allenamento è un altro. Aiutiamolo ad affrontare quei pochi minuti.', landingIntro: 'Quando entra sente di dover dimostrare tutto. Partiamo dal tuo racconto per capire come vive l’attesa, l’ingresso in campo e il peso di ogni giocata. Il primo confronto gratuito è con te, il genitore.' }, entry)
        }
        const { data, error } = await getSupabaseAdmin().from('blog_posts').select(`${BLOG_SELECT}, organization_id`).eq('organization_id', organizationId).eq('slug', entry.slice(5)).eq('status', 'active').maybeSingle()
        if (error) return null
        return editorialLandingFromRow(entry, organizationId, data as (BlogRow & { organization_id: string }) | null)
    } catch {
        // A missing or unavailable article must never take down the contact form.
        return null
    }
})
