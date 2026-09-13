import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import FunnelLandingPage from './FunnelLandingPage'
import MetodoSincroLanding, { type AbAssignment } from './MetodoSincroLandingV2'

// Slugs that redirect to dedicated landing pages
const SLUG_REDIRECTS: Record<string, string> = {
    'guida-acquistata': '/consulenza?source=GuidaAcquistata',
}

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

interface Props {
    params: Promise<{ slug: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Variante del test A/B per questa visita.
 *
 * Con il test acceso (settings.ab_test_active, dalla dashboard) il visitatore
 * nuovo riceve A o B a caso e poi la tiene: la pagina salva la scelta in un
 * cookie e alle visite successive il server la rilegge. La sceglie il server,
 * cosi' la pagina arriva gia' nella versione giusta e non cambia sotto gli
 * occhi. Con il test spento resta l'etichetta fissa settings.ab_variant e
 * nessuno vede il form a passaggi.
 *
 * ?ab=A o ?ab=B forza la variante: serve a vedere la B prima di accendere il test.
 */
async function resolveAbVariant(
    funnelId: string,
    settings: { ab_test_active?: boolean; ab_variant?: string } | null | undefined,
    forced: unknown,
): Promise<AbAssignment> {
    if (forced === 'A' || forced === 'B') {
        return { variant: forced, stepForm: forced === 'B', cookieName: null }
    }
    if (settings?.ab_test_active !== true) {
        return { variant: settings?.ab_variant === 'B' ? 'B' : 'A', stepForm: false, cookieName: null }
    }
    const cookieName = `ms_ab_${funnelId}`
    const saved = (await cookies()).get(cookieName)?.value
    const variant = saved === 'A' || saved === 'B' ? saved : (Math.random() < 0.5 ? 'A' : 'B')
    return { variant, stepForm: variant === 'B', cookieName }
}

export default async function PublicFunnelPage({ params, searchParams }: Props) {
    const { slug } = await params

    // Redirect slugs with dedicated landing pages
    if (SLUG_REDIRECTS[slug]) redirect(SLUG_REDIRECTS[slug])

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

        const ab = await resolveAbVariant(funnel.id, funnel.settings, (await searchParams).ab)

        return <MetodoSincroLanding funnel={funnel} routingAngles={routingAngles || []} ab={ab} />
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
