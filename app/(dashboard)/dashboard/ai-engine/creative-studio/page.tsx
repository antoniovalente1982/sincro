import { createClient } from '@/lib/supabase/server'
import CreativeStudio from './CreativeStudio'
import CreativePipeline from './CreativePipeline'
import AngleManager from './AngleManager'
import TopCreativePairs from './TopCreativePairs'

export default async function CreativeStudioPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user?.id || '')
        .single()

    const orgId = member?.organization_id || ''

    const [briefsRes, campaignsRes, creativesRes, summaryRes] = await Promise.all([
        supabase
            .from('ai_creative_briefs')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(20),
        supabase
            .from('campaigns_cache')
            .select('id, campaign_name, status')
            .eq('organization_id', orgId),
        supabase
            .from('ad_creatives')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(50),
        supabase
            .from('ad_creatives')
            .select('angle, status')
            .eq('organization_id', orgId),
    ])

    // Build summary from all creatives
    const allCreatives = summaryRes.data || []
    const byStatus: Record<string, number> = {}
    const byAngle: Record<string, Record<string, number>> = {}
    allCreatives.forEach(c => {
        byStatus[c.status] = (byStatus[c.status] || 0) + 1
        if (!byAngle[c.angle]) byAngle[c.angle] = {}
        byAngle[c.angle][c.status] = (byAngle[c.angle][c.status] || 0) + 1
    })

    return (
        <div className="space-y-10">
            {/* 1. Funnel Routing Engine — Titoli dinamici landing page */}
            <AngleManager />

            {/* Divider */}
            <div className="border-t" style={{ borderColor: 'var(--color-surface-200)' }} />

            {/* 2. Top Creative & Headline — Performance reale da Meta */}
            <TopCreativePairs />

            {/* Divider */}
            <div className="border-t" style={{ borderColor: 'var(--color-surface-200)' }} />

            {/* 3. Creative Pipeline — Circuito Chiuso */}
            <CreativePipeline
                creatives={creativesRes.data || []}
                summary={{ by_status: byStatus, by_angle: byAngle, total: allCreatives.length }}
            />

            {/* Divider */}
            <div className="border-t" style={{ borderColor: 'var(--color-surface-200)' }} />

            {/* 4. Creative Studio — Brief Generator */}
            <CreativeStudio
                briefs={briefsRes.data || []}
                campaigns={campaignsRes.data || []}
            />
        </div>
    )
}
