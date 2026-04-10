import React from 'react'

interface TeamMatchupMatrixProps {
    leads: any[]
    members: any[]
    rangeFilterName: string
}

function formatCurrency(v: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0)
}

export default function TeamMatchupMatrix({ leads, members, rangeFilterName }: TeamMatchupMatrixProps) {
    const getDisplayName = (id: string | null) => {
        if (!id) return 'Ignoto / Non Assegnato'
        const m = members.find(mbr => mbr.user_id === id)
        if (!m) return 'Utente Rimosso'
        if (m.profiles?.full_name) return m.profiles.full_name
        if (m.profiles?.email) return m.profiles.email.split('@')[0]
        return 'Sincro User'
    }

    // Costruiamo tutte le coppie uniche che hanno lavorato insieme
    const map = new Map<string, any>()

    leads.forEach(l => {
        // Consideriamo solo lead che hanno un setter e un closer assegnato, 
        // o quantomeno dove entrambi hanno interagito
        if (!l.setter_id && !l.closer_id) return

        const setterId = l.setter_id || 'unassigned_setter'
        const closerId = l.closer_id || 'unassigned_closer'
        const pairKey = `${setterId}_${closerId}`

        if (!map.has(pairKey)) {
            map.set(pairKey, {
                setterName: setterId === 'unassigned_setter' ? 'Nessun Setter' : getDisplayName(setterId),
                closerName: closerId === 'unassigned_closer' ? 'Nessun Venditore' : getDisplayName(closerId),
                leadsGestiti: 0,
                appuntamentiFissati: 0,
                venditeChiuse: 0,
                revenueGenerata: 0
            })
        }

        const data = map.get(pairKey)
        data.leadsGestiti += 1

        const hasApt = l.pipeline_stages?.slug === 'appuntamento' || l.pipeline_stages?.is_won || l.pipeline_stages?.is_lost
        if (hasApt) {
            data.appuntamentiFissati += 1
        }

        if (l.pipeline_stages?.is_won) {
            data.venditeChiuse += 1
            data.revenueGenerata += (Number(l.value) || 0)
        }
    })

    const pairs = Array.from(map.values())
        // Filtriamo le coppie dove non c'è NESSUNO o che non hanno reale iterazione
        .filter(p => p.setterName !== 'Nessun Setter' || p.closerName !== 'Nessun Venditore')
        .sort((a, b) => b.revenueGenerata - a.revenueGenerata || b.appuntamentiFissati - a.appuntamentiFissati)

    if (pairs.length === 0) return null

    return (
        <div className="glass-card p-6 mt-6 border-t-[3px]" style={{ borderColor: 'var(--color-sincro-500)' }}>
            <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2">
                    <span style={{ fontSize: '1.25rem' }}>🤝</span>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Matrice Coppie (Setter ↔ Venditore)</h3>
                </div>
                <span className="text-xs" style={{ color: 'var(--color-surface-500)' }}>Dati filtrati ({rangeFilterName})</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#0a0a0e] shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                        <tr>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Setter</th>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Venditore (Closer)</th>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px] text-right">Lead in Gestione</th>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px] text-right">Appuntamenti Fissati</th>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px] text-right">Chiusure Rate</th>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px] text-right">Venduto Generato</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-black/20">
                        {pairs.map((row, idx) => {
                            const closeRate = row.appuntamentiFissati > 0 
                                ? (row.venditeChiuse / row.appuntamentiFissati) * 100 
                                : 0

                            return (
                                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-4 py-3 font-bold text-indigo-300">{row.setterName}</td>
                                    <td className="px-4 py-3 font-bold text-emerald-300">{row.closerName}</td>
                                    <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--color-surface-400)' }}>{row.leadsGestiti}</td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-white">{row.appuntamentiFissati}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-mono text-[10px]" style={{ color: 'var(--color-surface-400)' }}>{row.venditeChiuse} Vinti</span>
                                            <span className="px-2 py-0.5 mt-0.5 rounded text-[11px] font-bold" style={{ background: closeRate > 10 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: closeRate > 10 ? '#22c55e' : '#ef4444' }}>
                                                {closeRate.toFixed(1)}% Conv.
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold" style={{ color: '#22c55e' }}>{formatCurrency(row.revenueGenerata)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 p-3 rounded-xl border" style={{ background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.1)' }}>
                <p className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>
                    💡 <strong>Analisi Coppia:</strong> Scopri esattamente quale partner commerciale garantisce il tasso di conversione maggiore sugli appuntamenti fissati. Il <em>Chiusure Rate</em> è calcolato come Vendite diviso gli Appuntamenti fissati dalla specifica coppia.
                </p>
            </div>
        </div>
    )
}
