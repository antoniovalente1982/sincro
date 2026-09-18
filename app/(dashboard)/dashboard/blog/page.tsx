import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org-context'
import { canAccessSection } from '@/lib/permissions'
import { rowToBlogPost, blogDashboardSelection, type BlogRow } from '@/lib/blog'
import { BLOG_SELECT, legacyArticles } from '@/lib/blog-server'
import BlogPanel from './BlogPanel'

export const metadata: Metadata = { title: 'Blog | Gestionale Metodo Sincro', robots: { index: false, follow: false } }
export default async function BlogDashboardPage({ searchParams }: { searchParams: Promise<{ articolo?: string | string[]; vista?: string | string[] }> }) {
    const supabase = await createClient()
    const org = await getOrgContext(supabase)
    if (!org) redirect('/login')
    if (!canAccessSection(org.role, org.department, 'blog')) return <main style={{ padding: 32 }}><h1>Accesso al Blog non disponibile per il tuo ruolo.</h1></main>
    const [articles, funnels] = await Promise.all([
        supabase.from('blog_posts').select(BLOG_SELECT).eq('organization_id', org.organization_id).order('updated_at', { ascending: false }),
        supabase.from('funnels').select(BLOG_SELECT).eq('organization_id', org.organization_id).order('updated_at', { ascending: false }),
    ])
    const posts = ((articles.data || []) as BlogRow[]).map(rowToBlogPost)
    const selection = blogDashboardSelection(posts, await searchParams)
    return <BlogPanel initialPosts={posts} initialArticleId={selection?.post.id} initialPreview={selection?.preview} legacy={legacyArticles((funnels.data || []) as BlogRow[])} loadError={articles.error || funnels.error ? 'Non è stato possibile leggere gli articoli. Verifica il collegamento e l’attivazione del Blog.' : ''} />
}
