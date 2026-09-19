import type { Metadata } from 'next'
import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Advertorial from './Advertorial'
import { advertorialConsultationHref } from '@/lib/advertorial'
import content from './content.json'
import { getEditorialPixel } from '@/lib/editorial-tracking-server'

export const dynamic = 'force-dynamic'

const getFunnel = cache(async () => {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await supabase.from('funnels')
        .select('id, name, organization_id, description, meta_pixel_id, settings')
        .eq('slug', 'pochi-minuti').eq('status', 'active').single()
    return data
})

export async function generateMetadata(): Promise<Metadata> {
    const funnel = await getFunnel()
    const title = funnel?.settings?.headline || content.headline
    const description = funnel?.settings?.subheadline || funnel?.description || content.subheadline
    return {
        title: `${title} | Metodo Sincro®`,
        description,
        alternates: { canonical: 'https://landing.metodosincro.com/f/pochi-minuti' },
        openGraph: {
            title, description, type: 'article', locale: 'it_IT', siteName: 'Metodo Sincro®',
            url: 'https://landing.metodosincro.com/f/pochi-minuti',
            images: [{ url: 'https://landing.metodosincro.com/advertorial-pochi-minuti/calciatore-17-anni.webp', width: 1122, height: 1402, alt: 'Un calciatore di circa 17 anni a bordo campo. Scena illustrativa generata con AI.' }],
        },
    }
}

export default async function PochiMinutiPage({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const funnel = await getFunnel()
    if (!funnel) notFound()
    const params = await searchParams
    const preview = params.ab === 'A' || params.ab === 'B'
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string') query.set(key, value)
    }
    return <Advertorial
        headline={funnel.settings?.headline || content.headline}
        subheadline={funnel.settings?.subheadline || content.subheadline}
        ctaText={funnel.settings?.cta_text || content.ctaText}
        consultationHref={advertorialConsultationHref(query.toString(), preview)}
        tracking={{ funnelId: funnel.id, orgId: funnel.organization_id, pixelId: (await getEditorialPixel(funnel.organization_id, funnel.meta_pixel_id)) || undefined, disabled: preview }}
    />
}
