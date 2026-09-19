import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import FunnelLandingPage from './FunnelLandingPage'
import MetodoSincroLanding, { type AbAssignment } from './MetodoSincroLandingV2'
import categoryCopy from '@/lib/salto-categoria-copy.json'
import { getEditorialLanding } from '@/lib/editorial-landing-server'
import { BLOG_ORIGIN } from '@/lib/blog'
import { getEditorialPixel } from '@/lib/editorial-tracking-server'

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
    // ?ab= e' l'anteprima aperta dal gestionale: la pagina non registra la visita
    if (forced === 'A' || forced === 'B') {
        return { variant: forced, stepForm: forced === 'B', cookieName: null, preview: true }
    }
    if (settings?.ab_test_active !== true) {
        return { variant: settings?.ab_variant === 'B' ? 'B' : 'A', stepForm: false, cookieName: null, preview: false }
    }
    const cookieName = `ms_ab_${funnelId}`
    const saved = (await cookies()).get(cookieName)?.value
    const variant = saved === 'A' || saved === 'B' ? saved : (Math.random() < 0.5 ? 'A' : 'B')
    return { variant, stepForm: variant === 'B', cookieName, preview: false }
}

export default async function PublicFunnelPage({ params, searchParams }: Props) {
    const { slug } = await params

    // Redirect slugs with dedicated landing pages
    if (SLUG_REDIRECTS[slug]) redirect(SLUG_REDIRECTS[slug])

    const { data: funnel } = await getSupabaseAdmin()
        .from('funnels')
        .select('id, organization_id, name, description, status, meta_pixel_id, objective, settings, organizations!funnels_organization_id_fkey(name, logo_url)')
        .eq('slug', slug)
        .eq('status', 'active')
        .single()

    if (!funnel) return notFound()

    // Use dedicated template if specified in settings
    const template = funnel.settings?.template
    if (template === 'metodo_sincro') {
        funnel.meta_pixel_id = await getEditorialPixel(funnel.organization_id, funnel.meta_pixel_id)
        const { data: routingAngles } = await getSupabaseAdmin()
            .from('funnel_routing_engine')
            .select('*')

        const query = await searchParams
        const [ab, editorialLanding] = await Promise.all([
            resolveAbVariant(funnel.id, funnel.settings, query.ab),
            getEditorialLanding(slug, query.entry, funnel.organization_id),
        ])

        return <MetodoSincroLanding funnel={funnel} routingAngles={routingAngles || []} ab={ab} editorialLanding={editorialLanding} />
    }

    return <FunnelLandingPage funnel={funnel} />
}

export async function generateMetadata({ params, searchParams }: Props) {
    const { slug } = await params
    const { data: funnel } = await getSupabaseAdmin()
        .from('funnels')
        .select('name, description, settings, organization_id, status')
        .eq('slug', slug)
        .single()

    const template = funnel?.settings?.template

    if (template === 'metodo_sincro') {
        const editorial = funnel?.status === 'active' ? await getEditorialLanding(slug, (await searchParams).entry, funnel.organization_id) : null
        if (editorial) {
            const canonical = `${BLOG_ORIGIN.replace(/\/$/, '')}/f/${slug}`
            return {
                title: `${editorial.headline} | Metodo Sincro®`,
                description: editorial.intro,
                alternates: { canonical },
                openGraph: { title: editorial.headline, description: editorial.intro, url: canonical, type: 'website' },
            }
        }
        if (funnel?.settings?.messaging_theme === categoryCopy.theme) {
            return {
                title: `${categoryCopy.headline} | Metodo Sincro®`,
                description: categoryCopy.description,
                openGraph: {
                    title: `${categoryCopy.headline} | Metodo Sincro®`,
                    description: categoryCopy.description,
                    type: 'website',
                },
            }
        }
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
