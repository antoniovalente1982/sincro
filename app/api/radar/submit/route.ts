import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'

function getSupabaseAdmin() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>()

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()
    const entry = rateLimits.get(ip)
    if (entry && now < entry.resetAt && entry.count >= 5) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (!entry || now > (entry?.resetAt || 0)) {
        rateLimits.set(ip, { count: 1, resetAt: now + 60_000 })
    } else { entry.count++ }

    try {
        const body = await req.json()
        const {
            child_name, child_sport,
            parent_name, parent_email, parent_phone,
            partner_id, answers, scores,
        } = body

        if (!child_name || !parent_name || !parent_email) {
            return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
        }

        // Save radar submission
        const { data: submission, error: subError } = await getSupabaseAdmin()
            .from('radar_submissions')
            .insert({
                child_name,
                child_sport: child_sport || null,
                parent_name,
                parent_email: parent_email.toLowerCase().trim(),
                parent_phone: parent_phone || null,
                partner_id: partner_id || null,
                answers,
                scores,
                ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            })
            .select()
            .single()

        if (subError) {
            console.error('Radar submission error:', subError)
            // Don't fail the response — the quiz should still show the report
            // Table might not exist yet, which is fine
        }

        // Fire background tasks
        after(async () => {
            try {
                // Find the default organization (Metodo Sincro)
                const { data: org } = await getSupabaseAdmin()
                    .from('organizations')
                    .select('id')
                    .limit(1)
                    .single()

                if (!org) return

                // Send Telegram notification
                const criticalAreas = Object.entries(scores || {})
                    .filter(([key, val]) => key !== 'overall' && (val as number) < 50)
                    .map(([key]) => key)

                const tgMsg = `🧠 <b>Nuovo Radar Sincro!</b>\n\n` +
                    `👦 <b>Ragazzo:</b> ${child_name}\n` +
                    `⚽ <b>Sport:</b> ${child_sport || 'Non specificato'}\n` +
                    `👤 <b>Genitore:</b> ${parent_name}\n` +
                    `📧 <b>Email:</b> ${parent_email}\n` +
                    (parent_phone ? `📱 <b>Tel:</b> ${parent_phone}\n` : '') +
                    `\n📊 <b>Punteggio Generale:</b> ${scores?.overall || '?'}%\n` +
                    (criticalAreas.length > 0 ? `🔴 <b>Aree Critiche:</b> ${criticalAreas.join(', ')}\n` : '✅ Nessuna area critica\n') +
                    (partner_id ? `\n🤝 <b>Partner:</b> ${partner_id}` : '')

                await sendTelegramMessage(org.id, tgMsg).catch(err =>
                    console.error('Radar TG error:', err)
                )

                console.log(`[RADAR] Submission saved for ${child_name} (${parent_email}), score: ${scores?.overall}%`)
            } catch (err) {
                console.error('[RADAR] Background tasks error:', err)
            }
        })

        return NextResponse.json({ success: true, id: submission?.id || null })
    } catch (err: any) {
        console.error('Radar endpoint error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
