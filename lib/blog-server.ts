import { cache } from 'react'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { BLOG_TEMPLATE, isPublishedBlog, rowToBlogPost, type BlogRow, type LegacyArticle } from './blog'

export const BLOG_SELECT = 'id, name, slug, description, status, settings, created_at, updated_at'

// This public publication belongs to one organization. Never aggregate tenants.
const getPublicOrgId = cache(async () => {
    if (process.env.BLOG_ORGANIZATION_ID) return process.env.BLOG_ORGANIZATION_ID
    const { data, error } = await getSupabaseAdmin().from('funnels').select('organization_id').eq('slug', 'pochi-minuti').maybeSingle()
    if (error) throw new Error('Il blog non è al momento disponibile. Riprova tra poco.')
    return data?.organization_id as string | undefined
})

export const getPublicBlog = cache(async () => {
    const orgId = await getPublicOrgId()
    if (!orgId) return { posts: [], legacy: [] }
    const [articles, funnels] = await Promise.all([
        getSupabaseAdmin().from('blog_posts').select(BLOG_SELECT).eq('organization_id', orgId).eq('status', 'active').order('updated_at', { ascending: false }),
        getSupabaseAdmin().from('funnels').select(BLOG_SELECT).eq('organization_id', orgId).eq('status', 'active').order('updated_at', { ascending: false }),
    ])
    if (articles.error || funnels.error) throw new Error('Non è stato possibile caricare gli articoli. Riprova tra poco.')
    return { posts: ((articles.data || []) as BlogRow[]).filter(isPublishedBlog).map(rowToBlogPost), legacy: legacyArticles((funnels.data || []) as BlogRow[]) }
})

export function legacyArticles(rows: BlogRow[]): LegacyArticle[] {
    return rows.filter(row => row.settings?.template !== BLOG_TEMPLATE && (row.slug === 'pochi-minuti' || String(row.settings?.template || '').startsWith('advertorial')))
        .map(row => ({ id: row.id, slug: row.slug, title: typeof row.settings?.headline === 'string' ? row.settings.headline : row.name, description: row.description || '', status: row.status }))
}

export const getPublicPost = cache(async (slug: string) => {
    const { posts } = await getPublicBlog()
    return posts.find(post => post.slug === slug) || null
})
