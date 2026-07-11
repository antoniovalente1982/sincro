import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OperationsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

    const orgId = member?.organization_id || ''

    // Carica ultime azioni dal log ai_crm_actions + lead activities
    const { data: recentActions } = await supabase
        .from('ai_crm_actions')
        .select('id, created_at, actor, action_type, outcome, score_delta, lead_id')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50)

    const actions = recentActions || []

    return (
        <div style={{ maxWidth: 1000 }}>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-surface-900)', margin: 0 }}>
                    Operazioni
                </h1>
                <p style={{ fontSize: 13, color: 'var(--color-surface-500)', marginTop: 6 }}>
                    Log di tutte le azioni AI e umane sul CRM
                </p>
            </div>

            {actions.length === 0 ? (
                <div style={{
                    padding: 60, textAlign: 'center',
                    background: 'var(--color-surface-50)', borderRadius: 16,
                    border: '1px solid var(--color-surface-200)'
                }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 14, color: 'var(--color-surface-500)' }}>
                        Nessuna operazione registrata ancora.
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-surface-400)', marginTop: 8 }}>
                        Le azioni AI e umane sul CRM appariranno qui.
                    </div>
                </div>
            ) : (
                <div style={{
                    background: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)',
                    borderRadius: 16, overflow: 'hidden'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-surface-200)' }}>
                                {['Data', 'Attore', 'Azione', 'Esito', 'Score Δ'].map(h => (
                                    <th key={h} style={{
                                        padding: '12px 16px', textAlign: 'left', fontSize: 11,
                                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                                        color: 'var(--color-surface-500)'
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {actions.map((a: any) => (
                                <tr key={a.id} style={{ borderBottom: '1px solid var(--color-surface-100)' }}>
                                    <td style={{ padding: '10px 16px', color: 'var(--color-surface-600)', fontSize: 12 }}>
                                        {new Date(a.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={{ padding: '10px 16px' }}>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                                            background: a.actor === 'ai' ? 'rgba(168,85,247,0.12)' : 'rgba(59,130,246,0.12)',
                                            color: a.actor === 'ai' ? '#a855f7' : '#3b82f6'
                                        }}>
                                            {a.actor === 'ai' ? '🤖 AI' : '👤 Human'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 16px', color: 'var(--color-surface-700)' }}>
                                        {a.action_type?.replace(/_/g, ' ')}
                                    </td>
                                    <td style={{ padding: '10px 16px' }}>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                                            background: a.outcome === 'positive' ? 'rgba(34,197,94,0.1)' : a.outcome === 'negative' ? 'rgba(239,68,68,0.1)' : 'rgba(113,113,122,0.1)',
                                            color: a.outcome === 'positive' ? '#22c55e' : a.outcome === 'negative' ? '#ef4444' : 'var(--color-surface-500)'
                                        }}>
                                            {a.outcome || 'pending'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 16px', fontWeight: 700, color: (a.score_delta || 0) > 0 ? '#22c55e' : 'var(--color-surface-400)' }}>
                                        {(a.score_delta || 0) > 0 ? '+' : ''}{a.score_delta || 0}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
