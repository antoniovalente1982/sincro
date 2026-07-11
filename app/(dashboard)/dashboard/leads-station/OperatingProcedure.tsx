'use client'

// ============================================================
// Procedura Operativa — SINGLE SOURCE OF TRUTH
//
// Questo componente è l'unico punto in cui vive il testo del
// box "Come funziona?". È usato sia nella Stazione Leads reale
// sia nella sandbox di simulazione dell'admin, così la procedura
// mostrata è SEMPRE aggiornata e coerente ovunque.
//
// ⚠️ Quando cambia il flusso operativo, modifica SOLO qui.
// ============================================================

interface Props {
    batchSize?: number
    minFeedbackPct?: number
    /** Stile compatto per la sandbox admin (default false) */
    compact?: boolean
}

export default function OperatingProcedure({ batchSize = 5, minFeedbackPct = 100, compact = false }: Props) {
    return (
        <div
            className="glass-card"
            style={{
                padding: '16px 20px',
                borderRadius: '16px',
                border: '1px solid var(--color-surface-200)',
                background: 'rgba(168,85,247,0.02)',
                textAlign: 'left',
                marginTop: compact ? '16px' : 0,
            }}
        >
            <h4 style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--color-surface-800)',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
            }}>
                <span>❓</span> Come funziona? Procedura Operativa
            </h4>

            <ol style={{
                fontSize: '11px',
                color: 'var(--color-surface-600)',
                paddingLeft: '16px',
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '7px',
                lineHeight: 1.45,
            }}>
                <li>
                    Premi <strong>SPIN</strong> per ricevere un pacchetto di <strong>{batchSize} contatti</strong>.
                </li>
                <li>
                    Tocca il <strong>numero di telefono</strong> per chiamare il contatto dal tuo telefono.
                </li>
                <li>
                    <strong style={{ color: '#a855f7' }}>Subito dopo ogni chiamata</strong> registra l'esito.
                    Non accumulare: registra una chiamata alla volta.
                </li>
                <li>
                    Scegli l'esito giusto:
                    <ul style={{ paddingLeft: '14px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <li><strong>📅 Appuntamento</strong> → scegli data e ora: viene fissato a calendario e il lead entra in pipeline.</li>
                        <li><strong>⭐ Interessato</strong> → resta nella coda <em>Interessati</em> per il follow-up.</li>
                        <li><strong>🔄 Richiama</strong> → imposta quando richiamare: comparirà in <em>Da richiamare</em> a scadenza.</li>
                        <li><strong>📵 Non risponde / ❌ Non interessato / ⚠️ Numero errato</strong> → chiude il contatto.</li>
                    </ul>
                </li>
                <li>
                    Completa <strong>tutti i {batchSize} contatti</strong> (almeno il <strong>{minFeedbackPct}%</strong> con
                    esito) prima di richiedere un nuovo SPIN.
                </li>
                <li>
                    Lavora la coda <em>Da richiamare</em> e <em>Interessati</em> quando i richiami sono dovuti: è lì che
                    si costruiscono gli appuntamenti.
                </li>
            </ol>

            <div style={{
                marginTop: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(168, 85, 247, 0.05)',
                fontSize: '10px',
                color: '#7c3aed',
                lineHeight: 1.35,
            }}>
                💡 <em>Il sistema registra esiti, appuntamenti e tempi in tempo reale per misurare in modo
                oggettivo chi lavora di più e con più costanza. Seguire la procedura lineare tiene il tuo punteggio pulito.</em>
            </div>
        </div>
    )
}
