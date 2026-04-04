import { NextRequest, NextResponse } from 'next/server'
import { createClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing.')
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

const META_API_VERSION = 'v21.0'

/**
 * POST /api/meta/update-ad-names
 * 
 * Legge tutte le inserzioni da Meta, incrocia con la tabella funnel_routing_engine,
 * e aggiunge il tag "T: <headline>" al nome dell'inserzione.
 * 
 * Body: { dry_run?: boolean }
 * - dry_run=true (default): mostra solo l'anteprima delle modifiche senza applicarle
 * - dry_run=false: applica le modifiche su Meta
 */
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await getSupabaseAdmin().auth.getUser(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: member } = await getSupabaseAdmin()
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()
        if (!member) return NextResponse.json({ error: 'No organization' }, { status: 403 })

        let body: any = {}
        try { body = await req.json() } catch {}
        const dryRun = body.dry_run !== false // default: true (safe mode)

        // 1. Get Meta credentials
        const { data: conn } = await getSupabaseAdmin()
            .from('connections')
            .select('credentials')
            .eq('organization_id', member.organization_id)
            .eq('provider', 'meta_ads')
            .eq('status', 'active')
            .single()

        if (!conn?.credentials?.access_token) {
            return NextResponse.json({ error: 'Meta Ads not connected' }, { status: 400 })
        }

        const { access_token, ad_account_id } = conn.credentials
        const adAccount = `act_${ad_account_id}`

        // 2. Get all routing angles from DB
        const { data: angles } = await getSupabaseAdmin()
            .from('funnel_routing_engine')
            .select('*')

        if (!angles || angles.length === 0) {
            return NextResponse.json({ error: 'Nessun angolo configurato nel Funnel Routing Engine' }, { status: 400 })
        }

        // 3. Fetch ALL ads from Meta (including paused, to update everything)
        const adsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccount}/ads?` +
            `fields=id,name,status,effective_status,campaign_id,adset_id` +
            `&limit=500&access_token=${access_token}`

        const adsRes = await fetch(adsUrl)
        if (!adsRes.ok) {
            const errText = await adsRes.text()
            console.error('Meta ads fetch error:', errText)
            return NextResponse.json({ error: `Meta API error: ${adsRes.status}` }, { status: 500 })
        }

        const adsData = await adsRes.json()
        const allAds = adsData.data || []

        // 4. Process each ad: match keyword → build new name with T: tag
        const updates: any[] = []
        const skipped: any[] = []
        const noMatch: any[] = []

        for (const ad of allAds) {
            const currentName = ad.name || ''
            const lowerName = currentName.toLowerCase()

            // Skip if already has a T: tag
            if (/(?:T:|Titolo:|Headline:)\s*.+/i.test(currentName)) {
                skipped.push({
                    ad_id: ad.id,
                    current_name: currentName,
                    reason: 'Ha già un tag T: nel nome',
                    status: ad.effective_status,
                })
                continue
            }

            // Find matching angle
            const matchedAngle = angles.find((angle: any) => 
                lowerName.includes(angle.trigger_keyword.toLowerCase())
            )

            if (!matchedAngle) {
                noMatch.push({
                    ad_id: ad.id,
                    current_name: currentName,
                    status: ad.effective_status,
                    reason: 'Nessuna keyword matchata',
                })
                continue
            }

            // Build the full headline: white + gold
            const fullHeadline = `${matchedAngle.headline_white} ${matchedAngle.headline_gold}`.trim()
            const newName = `${currentName} - T: ${fullHeadline}`

            updates.push({
                ad_id: ad.id,
                current_name: currentName,
                new_name: newName,
                matched_keyword: matchedAngle.trigger_keyword,
                headline: fullHeadline,
                status: ad.effective_status,
            })
        }

        // 5. Apply updates if not dry_run
        const results: any[] = []
        if (!dryRun && updates.length > 0) {
            for (const update of updates) {
                try {
                    const updateUrl = `https://graph.facebook.com/${META_API_VERSION}/${update.ad_id}`
                    const formData = new URLSearchParams()
                    formData.append('name', update.new_name)
                    formData.append('access_token', access_token)

                    const updateRes = await fetch(updateUrl, {
                        method: 'POST',
                        body: formData,
                    })

                    if (updateRes.ok) {
                        results.push({ ...update, applied: true })
                    } else {
                        const errBody = await updateRes.json()
                        results.push({ 
                            ...update, 
                            applied: false, 
                            error: errBody.error?.message || 'Unknown error' 
                        })
                    }
                } catch (err: any) {
                    results.push({ ...update, applied: false, error: err.message })
                }
            }
        }

        return NextResponse.json({
            success: true,
            dry_run: dryRun,
            summary: {
                total_ads: allAds.length,
                to_update: updates.length,
                already_tagged: skipped.length,
                no_match: noMatch.length,
            },
            updates: dryRun ? updates : results,
            skipped,
            no_match: noMatch,
            angles_available: angles.map((a: any) => ({
                keyword: a.trigger_keyword,
                headline: `${a.headline_white} ${a.headline_gold}`,
            })),
        })
    } catch (err: any) {
        console.error('Update ad names error:', err)
        return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
    }
}
