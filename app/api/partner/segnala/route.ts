import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>()

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()
    const entry = rateLimits.get(ip)
    if (entry && now < entry.resetAt && entry.count >= 10) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (!entry || now > (entry?.resetAt || 0)) {
        rateLimits.set(ip, { count: 1, resetAt: now + 60_000 })
    } else { entry.count++ }

    try {
        const body = await req.json()
        const { partner_id, parent_name, parent_phone, parent_email, child_name, child_sport, notes } = body

        if (!parent_name || !parent_phone) {
            return NextResponse.json({ error: 'Nome e telefono sono obbligatori' }, { status: 400 })
        }

        // Save as a radar_submission with type "segnalazione"
        const { error: subError } = await getSupabaseAdmin()
            .from('radar_submissions')
            .insert({
                parent_name,
                parent_phone: parent_phone || null,
                parent_email: parent_email?.toLowerCase().trim() || null,
                child_name: child_name || parent_name, // fallback to parent name
                child_sport: child_sport || null,
                partner_id: partner_id || null,
                answers: { type: 'segnalazione_diretta' }, // Mark as direct referral
                scores: null, // No quiz scores for direct referrals
                notes: notes || null,
                ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            })

        if (subError) {
            console.error('Segnalazione save error:', subError)
            // Don't block — table might not exist yet
        }

        // Background: Telegram notification
        after(async () => {
            try {
                const { data: org } = await getSupabaseAdmin()
                    .from('organizations')
                    .select('id')
                    .limit(1)
                    .single()

                if (!org) return

                const tgMsg = `🤝 <b>Nuova Segnalazione Partner!</b>\n\n` +
                    (partner_id ? `👥 <b>Partner:</b> ${partner_id}\n` : '') +
                    `👤 <b>Genitore:</b> ${parent_name}\n` +
                    `📱 <b>Tel:</b> ${parent_phone}\n` +
                    (parent_email ? `📧 <b>Email:</b> ${parent_email}\n` : '') +
                    (child_name ? `👦 <b>Ragazzo:</b> ${child_name}\n` : '') +
                    (child_sport ? `⚽ <b>Sport:</b> ${child_sport}\n` : '') +
                    (notes ? `\n📝 <b>Note:</b> ${notes}` : '')

                await sendTelegramMessage(org.id, tgMsg).catch(console.error)
                console.log(`[SEGNALA] Lead from partner ${partner_id}: ${parent_name} (${parent_phone})`)
            } catch (err) {
                console.error('[SEGNALA] Background error:', err)
            }
        })

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('Segnalazione error:', err)
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }
}
