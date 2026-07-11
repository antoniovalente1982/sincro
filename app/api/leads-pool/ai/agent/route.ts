import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_PROMPT = `Sei un assistente telefonico (setter) di Metodo Sincro. Chiami genitori interessati al calcio giovanile.
Obiettivo UNICO: fissare un appuntamento telefonico/videocall con un nostro consulente umano.
Tono: cordiale, naturale, italiano colloquiale, mai robotico. Sii breve.
All'inizio dichiara che sei un assistente. Ascolta, gestisci 1-2 obiezioni, e proponi due fasce orarie precise per l'appuntamento.
Se non è interessato o è il numero sbagliato, chiudi con garbo. Non insistere più di due volte.`

async function requireAdmin(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non autorizzato', status: 401 as const }
    const { data: member } = await supabase
        .from('organization_members').select('organization_id, role')
        .eq('user_id', user.id).is('deactivated_at', null).single()
    if (!member || !['owner', 'admin', 'manager'].includes(member.role)) {
        return { error: 'Accesso negato', status: 403 as const }
    }
    return { user, orgId: member.organization_id }
}

export async function GET() {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const admin = getSupabaseAdmin()

    const { data: agent } = await admin
        .from('lead_ai_agents').select('*').eq('organization_id', auth.orgId).limit(1).maybeSingle()

    let versions: any[] = []
    if (agent) {
        const { data } = await admin
            .from('lead_ai_agent_versions').select('*').eq('agent_id', agent.id).order('version_no', { ascending: false })
        versions = data || []
    }

    const checklist = {
        agent_created: !!agent,
        convai_key: !!process.env.ELEVENLABS_CONVAI_API_KEY,
        provider_agent_id: !!agent?.provider_agent_id,
        phone_number: !!agent?.phone_number_id,
        active: !!agent?.active,
    }
    const ready = checklist.agent_created && checklist.convai_key && checklist.provider_agent_id && checklist.phone_number

    return NextResponse.json({ agent, versions, checklist, ready })
}

export async function POST(request: Request) {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const admin = getSupabaseAdmin()
    const orgId = auth.orgId
    const body = await request.json()
    const action = body.action

    // ── Crea l'agente + il membro virtuale AI ──
    if (action === 'setup') {
        const existing = await admin.from('lead_ai_agents').select('id').eq('organization_id', orgId).limit(1).maybeSingle()
        if (existing.data) return NextResponse.json({ error: 'Agente già esistente' }, { status: 409 })

        // Utente virtuale (setter AI) — email tecnica, non fa login
        const email = `ai-setter+${orgId.slice(0, 8)}@metodosincro.local`
        const { data: created, error: userErr } = await admin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { is_ai_agent: true, display_name: '🤖 Agente Setter AI' },
        })
        if (userErr && !created?.user) {
            return NextResponse.json({ error: 'Errore creazione utente AI', detail: userErr.message }, { status: 500 })
        }
        const aiUserId = created!.user!.id

        await admin.from('profiles').upsert({ id: aiUserId, full_name: '🤖 Agente Setter AI' }, { onConflict: 'id' })
        await admin.from('organization_members').insert({
            organization_id: orgId, user_id: aiUserId, role: 'closer',
            team: 'ai', is_ai_agent: true,
        })

        const { data: agent } = await admin.from('lead_ai_agents').insert({
            organization_id: orgId, name: '🤖 Agente Setter AI', member_user_id: aiUserId,
            provider: 'elevenlabs', daily_call_target: 50, active: false,
        }).select().single()

        const { data: version } = await admin.from('lead_ai_agent_versions').insert({
            agent_id: agent!.id, version_no: 1, system_prompt: DEFAULT_PROMPT, playbook: '', status: 'active',
        }).select().single()

        await admin.from('lead_ai_agents').update({ current_version_id: version!.id }).eq('id', agent!.id)

        return NextResponse.json({ success: true, agent, version })
    }

    // ── Aggiorna configurazione agente ──
    if (action === 'update') {
        const { agent_id, ...fields } = body
        const allowed = ['name', 'provider_agent_id', 'phone_number_id', 'daily_call_target', 'active', 'settings']
        const patch: Record<string, any> = { updated_at: new Date().toISOString() }
        for (const k of allowed) if (k in fields) patch[k] = fields[k]
        const { data } = await admin.from('lead_ai_agents').update(patch).eq('id', agent_id).eq('organization_id', orgId).select().single()
        return NextResponse.json({ success: true, agent: data })
    }

    // ── Salva una nuova versione di prompt/playbook e la attiva ──
    if (action === 'save_version') {
        const { agent_id, system_prompt, playbook } = body
        const { data: last } = await admin.from('lead_ai_agent_versions')
            .select('version_no').eq('agent_id', agent_id).order('version_no', { ascending: false }).limit(1).maybeSingle()
        const nextNo = (last?.version_no || 0) + 1
        await admin.from('lead_ai_agent_versions').update({ status: 'retired' }).eq('agent_id', agent_id).eq('status', 'active')
        const { data: version } = await admin.from('lead_ai_agent_versions').insert({
            agent_id, version_no: nextNo, system_prompt, playbook: playbook || '', status: 'active',
        }).select().single()
        await admin.from('lead_ai_agents').update({ current_version_id: version!.id }).eq('id', agent_id)
        return NextResponse.json({ success: true, version })
    }

    // ── Attiva una versione candidate esistente ──
    if (action === 'activate_version') {
        const { agent_id, version_id } = body
        await admin.from('lead_ai_agent_versions').update({ status: 'retired' }).eq('agent_id', agent_id).eq('status', 'active')
        await admin.from('lead_ai_agent_versions').update({ status: 'active' }).eq('id', version_id)
        await admin.from('lead_ai_agents').update({ current_version_id: version_id }).eq('id', agent_id)
        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
}
