import type { Metadata } from 'next'
import { getPublicBlog } from '@/lib/blog-server'
import { BLOG_NAME, blogCanonical } from '@/lib/blog'
import { BlogArchive } from './BlogViews'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: `${BLOG_NAME} | Il blog di Metodo Sincro`, description: 'Calcio, mente e crescita. Approfondimenti per genitori su fiducia, panchina, pressione e dialogo con i figli.', alternates: { canonical: blogCanonical() }, openGraph: { title: BLOG_NAME, description: 'Il calcio dei ragazzi, le domande dei genitori. A cura di Metodo Sincro.', url: blogCanonical(), type: 'website', locale: 'it_IT' } }
export default async function BlogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const { posts, legacy } = await getPublicBlog()
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(await searchParams)) if (typeof value === 'string') query.set(key, value)
    return <BlogArchive posts={posts} legacy={legacy} search={query.toString()} />
}
