import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BLOG_NAME, BLOG_ORIGIN, BLOG_DEFAULT_COVER, BLOG_DEFAULT_COVER_ALT, blogCanonical, blogConsultationHref } from '@/lib/blog'
import { getPublicBlog, getPublicPost } from '@/lib/blog-server'
import { BlogArticle } from '../BlogViews'
import EditorialTracking from '@/components/EditorialTracking'
import { resolveEditorialPage } from '@/lib/editorial-tracking-server'

export const dynamic = 'force-dynamic'
interface Props { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const post = await getPublicPost((await params).slug)
    if (!post) return { title: 'Articolo non trovato', robots: { index: false, follow: false } }
    return { title: `${post.seoTitle} | ${BLOG_NAME}`, description: post.seoDescription, alternates: { canonical: blogCanonical(post.slug) }, openGraph: { title: post.seoTitle, description: post.seoDescription, url: blogCanonical(post.slug), type: 'article', locale: 'it_IT', siteName: BLOG_NAME, publishedTime: post.publishedAt!, modifiedTime: post.updatedAt, images: [{ url: new URL(post.cover || BLOG_DEFAULT_COVER, BLOG_ORIGIN).href, alt: post.cover ? post.coverAlt : BLOG_DEFAULT_COVER_ALT }] } }
}
export default async function ArticlePage({ params, searchParams }: Props) {
    const post = await getPublicPost((await params).slug)
    if (!post) notFound()
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(await searchParams)) if (typeof value === 'string') query.set(key, value)
    const { posts } = await getPublicBlog()
    const tracking = await resolveEditorialPage(`/blog/${post.slug}`)
    const schema = [
        { '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description: post.excerpt, datePublished: post.publishedAt, dateModified: post.updatedAt, mainEntityOfPage: blogCanonical(post.slug), url: blogCanonical(post.slug), inLanguage: 'it-IT', image: new URL(post.cover || BLOG_DEFAULT_COVER, BLOG_ORIGIN).href, author: { '@type': 'Organization', name: 'Metodo Sincro', url: 'https://www.metodosincro.it' }, publisher: { '@type': 'Organization', name: 'Metodo Sincro', url: 'https://www.metodosincro.it' } },
        { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Metodo Sincro', item: 'https://www.metodosincro.it' }, { '@type': 'ListItem', position: 2, name: post.title, item: blogCanonical(post.slug) }] },
    ]
    return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} /><BlogArticle post={post} search={query.toString()} consultationHref={blogConsultationHref(post.slug, query.toString(), ['A','B'].includes(query.get('ab') || ''))} related={posts.filter(item => item.id !== post.id && item.topic === post.topic).slice(0, 3)} /><EditorialTracking kind="advertorial" pixelId={tracking?.pixelId} preview={['A','B'].includes(query.get('ab') || '')} /></>
}
