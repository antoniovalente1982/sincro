import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import FunnelLandingPage from './FunnelLandingPage'
import MetodoSincroLanding from './MetodoSincroLandingV2'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface Props { 
    params: Promise<{ slug: string }> 
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PublicFunnelPage({ params, searchParams }: Props) {
    const { slug } = await params
    const resolvedSearchParams = await searchParams
    // --- [PERFORMANCE FIX: PAGE SPEED INSIGHTS] ---
    // The logic to detect the adset angle (utm_term) was moved here to the SERVER SIDE.
    // Why? Previously it was handled by a client-side useEffect in the Landing Component.
    // That caused a massive Layout Shift (CLS) and a slow LCP because the headline
    // would swap AFTER the page loaded on the phone. By resolving it here on the server
    // and passing it as `initialAdsetAngle`, the HTML is instantly perfect.
    // IMPORTANT: Do NOT move this back to the client. It does not affect CAPI or Pixel tracking.
    const utmTerm = typeof resolvedSearchParams.utm_term === 'string' ? resolvedSearchParams.utm_term.toUpperCase() : ''

    let initialAdsetAngle: 'emotional'|'system'|'efficiency'|'status'|'default' = 'default'
    if (utmTerm.includes('EMOTIONAL') || utmTerm.includes('SOVRACCARICO')) initialAdsetAngle = 'emotional'
    else if (utmTerm.includes('SYSTEM') || utmTerm.includes('CONTROLLO')) initialAdsetAngle = 'system'
    else if (utmTerm.includes('EFFICIENCY') || utmTerm.includes('OTTIMIZZAT')) initialAdsetAngle = 'efficiency'
    else if (utmTerm.includes('STATUS') || utmTerm.includes('ELITE') || utmTerm.includes('CORONA')) initialAdsetAngle = 'status'
    // ----------------------------------------------

    const { data: funnel } = await supabaseAdmin
        .from('funnels')
        .select('id, name, description, status, meta_pixel_id, objective, settings, organizations!funnels_organization_id_fkey(name, logo_url)')
        .eq('slug', slug)
        .eq('status', 'active')
        .single()

    if (!funnel) return notFound()

    // Use dedicated template if specified in settings
    const template = funnel.settings?.template
    if (template === 'metodo_sincro') {
        return <MetodoSincroLanding funnel={funnel} initialAdsetAngle={initialAdsetAngle} />
    }

    return <FunnelLandingPage funnel={funnel} />
}

export async function generateMetadata({ params }: Props) {
    const { slug } = await params
    const { data: funnel } = await supabaseAdmin
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
