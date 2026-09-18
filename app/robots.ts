import type { MetadataRoute } from 'next'
import { BLOG_ORIGIN } from '@/lib/blog'
export default function robots(): MetadataRoute.Robots {
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return { rules: { userAgent: '*', disallow: '/' } }
    return { rules: { userAgent: '*', allow: '/', disallow: ['/dashboard/', '/api/', '/login', '/register', '/set-password', '/blog/anteprima', '/f/pochi-minuti/anteprima'] }, sitemap: `${BLOG_ORIGIN.replace(/\/$/, '')}/sitemap.xml` }
}
