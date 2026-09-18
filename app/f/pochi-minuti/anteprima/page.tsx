import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Advertorial from '../Advertorial'
import content from '../content.json'
import { advertorialConsultationHref } from '@/lib/advertorial'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
    title: 'Anteprima advertorial — Dentro la partita | Metodo Sincro',
    robots: { index: false, follow: false },
}

export default function AdvertorialPreview() {
    if (process.env.NODE_ENV !== 'development') notFound()
    return <Advertorial
        headline={content.headline}
        subheadline={content.subheadline}
        ctaText={content.ctaText}
        consultationHref={`https://landing.metodosincro.com${advertorialConsultationHref('', true)}`}
    />
}
