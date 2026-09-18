import type { Metadata } from 'next'
export const metadata: Metadata = { robots: { index: process.env.NODE_ENV === 'production' && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production'), follow: true } }
export default function BlogLayout({ children }: { children: React.ReactNode }) { return children }
