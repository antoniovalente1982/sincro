import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import FunnelLandingPage from './FunnelLandingPage'
import MetodoSincroLanding from './MetodoSincroLandingV2'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to ANON_KEY, which may cause RLS errors.')
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

interface Props { params: Promise<{ slug: string }> }

export default async function PublicFunnelPage({ params }: Props) {
    const { slug } = await params

    const { data: funnel } = await getSupabaseAdmin()
        .from('funnels')
        .select('id, name, description, status, meta_pixel_id, objective, settings, organizations!funnels_organization_id_fkey(name, logo_url)')
        .eq('slug', slug)
        .eq('status', 'active')
        .single()

    if (!funnel) return notFound()

    // Use dedicated template if specified in settings
    const template = funnel.settings?.template
    if (template === 'metodo_sincro') {
        const { data: routingAngles } = await getSupabaseAdmin()
            .from('funnel_routing_engine')
            .select('*')

        return <MetodoSincroLanding funnel={funnel} routingAngles={routingAngles || []} />
    }

    return <FunnelLandingPage funnel={funnel} />
}

export async function generateMetadata({ params }: Props) {
    const { slug } = await params
    const { data: funnel } = await getSupabaseAdmin()
        .from('funnels')
        .select('name, description, settings')
        .eq('slug', slug)
        .single()

    const template = funnel?.settings?.template

    if (template === 'metodo_sincro') {
        return {
            title: 'Metodo Sincro® | Mental Coaching per Giovani Calciatori',
            description: 'Il percorso di Mental Coaching n.1 in Italia per giovani calciatori. Migliaia di atleti seguiti, tra cui calciatori di Serie A. Richiedi una consulenza gratuita.',
            openGraph: {
                title: 'Metodo Sincro® | Sblocca il Potenziale di Tuo Figlio',
                description: 'L\'87% degli atleti talentuosi non emerge per mancanza di preparazione mentale. Il Mental Coaching fa la differenza.',
                type: 'website',
            },
        }
    }

    return {
        title: funnel?.name || 'ADPILOTIK',
        description: funnel?.description || 'Scopri di più',
    }
}
