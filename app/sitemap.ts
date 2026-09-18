import type { MetadataRoute } from 'next'
import { getPublicBlog } from '@/lib/blog-server'
import { BLOG_ORIGIN, blogCanonical } from '@/lib/blog'

export const dynamic = 'force-dynamic'
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const { posts, legacy } = await getPublicBlog()
    return [
        ...posts.map(post => ({ url: blogCanonical(post.slug), lastModified: post.updatedAt })),
        ...legacy.filter(post => post.status === 'active').map(post => ({ url: `${BLOG_ORIGIN.replace(/\/$/, '')}/f/${post.slug}` })),
    ]
}
