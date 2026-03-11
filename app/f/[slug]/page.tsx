import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import FunnelLandingPage from './FunnelLandingPage'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface Props { params: Promise<{ slug: string }> }

export default async function PublicFunnelPage({ params }: Props) {
    const { slug } = await params

    const { data: funnel } = await supabaseAdmin
        .from('funnels')
        .select('id, name, description, status, meta_pixel_id, settings, organizations!funnels_organization_id_fkey(name, logo_url)')
        .eq('slug', slug)
        .eq('status', 'active')
        .single()

    if (!funnel) return notFound()

    return <FunnelLandingPage funnel={funnel} />
}

export async function generateMetadata({ params }: Props) {
    const { slug } = await params
    const { data: funnel } = await supabaseAdmin
        .from('funnels')
        .select('name, description')
        .eq('slug', slug)
        .single()

    return {
        title: funnel?.name || 'ADPILOTIK',
        description: funnel?.description || 'Scopri di più',
    }
}
