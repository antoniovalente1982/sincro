import { notFound, redirect } from 'next/navigation'
import { getPublicBlog } from '@/lib/blog-server'
import { blogEntryHref } from '@/lib/blog'

export const dynamic = 'force-dynamic'

// Blog is the editorial workspace. The public entrance opens an advertorial.
export default async function BlogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const { posts, legacy } = await getPublicBlog()
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(await searchParams)) if (typeof value === 'string') query.set(key, value)
    const destination = blogEntryHref(posts, legacy, query.toString())
    if (!destination) notFound()
    redirect(destination)
}
