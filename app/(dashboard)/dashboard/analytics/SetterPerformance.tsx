import React, { useMemo } from 'react'

interface SetterPerformanceProps {
    leads: any[]
    members: any[]
    rangeFilterName: string
}

function formatCurrency(v: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0)
}

export default function SetterPerformance({ leads, members, rangeFilterName }: SetterPerformanceProps) {
    // 1. Find all members who could be setting (role = setter or manager or anyone who is listed as setter_id)
    const setterIdsInLeads = new Set(leads.map(l => l.setter_id).filter(Boolean))
    
    const setters = members.filter(m => 
        m.role === 'setter' || m.role === 'manager' || setterIdsInLeads.has(m.user_id)
    )

    // 2. Compute stats for each setter
    const statsRow = setters.map(setter => {
        const userId = setter.user_id
        
        // Leads Assegnati: ha la card in mano adesso O l'ha avuta e fissato appuntamento (setter_id)
        const leadsLavorati = leads.filter(l => l.assigned_to === userId || l.setter_id === userId)
        
        // Appuntamenti = in cui il setter ha fissato (è memorizzato in setter_id)
        const appuntamentiFissati = leads.filter(l => l.setter_id === userId)
        
        // Conversion Rate
        const cr = leadsLavorati.length > 0 
            ? ((appuntamentiFissati.length / leadsLavorati.length) * 100)
            : 0

        // Tra questi appuntamenti, quanti sono diventati "Vinti" (chiusi dai Closer)? E qual è il fatturato totale?
        const appuntamentiVinti = appuntamentiFissati.filter(l => l.pipeline_stages?.is_won)
        const vendutoGenerato = appuntamentiVinti.reduce((sum, l) => sum + (Number(l.value) || 0), 0)

        return {
            id: userId,
            name: setter.profiles?.full_name || setter.profiles?.email || 'Ignoto',
            lavorati: leadsLavorati.length,
            appuntamenti: appuntamentiFissati.length,
            cr: cr,
            chiusi: appuntamentiVinti.length,
            venduto: vendutoGenerato
        }
    }).sort((a, b) => b.appuntamenti - a.appuntamenti) // Ordina per chi fissa di più

    if (statsRow.length === 0) return null

    return (
        <div className="glass-card p-6 mt-6 border-t-[3px]" style={{ borderColor: 'var(--color-sincro-500)' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span style={{ fontSize: '1.25rem' }}>🎯</span>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Performance Setter</h3>
                </div>
                <span className="text-xs" style={{ color: 'var(--color-surface-500)' }}>Dati filtrati ({rangeFilterName})</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#0a0a0e] shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                        <tr>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Setter</th>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px] text-right">Lead Gestiti</th>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px] text-right">Appuntamenti Fissati</th>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px] text-right">Conv. Rate (Lead→App)</th>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px] text-right">Chiusure Generate (dai Closer)</th>
                            <th className="px-4 py-3 font-semibold text-gray-400 uppercase tracking-wider text-[10px] text-right">Venduto Generato</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-black/20">
                        {statsRow.map(row => (
                            <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-3 font-bold text-white">{row.name}</td>
                                <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--color-surface-400)' }}>{row.lavorati}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: '#3b82f6' }}>{row.appuntamenti}</td>
                                <td className="px-4 py-3 text-right">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: row.cr > 10 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: row.cr > 10 ? '#22c55e' : '#ef4444' }}>
                                        {row.cr.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--color-surface-400)' }}>{row.chiusi}</td>
                                <td className="px-4 py-3 text-right font-bold" style={{ color: '#22c55e' }}>{formatCurrency(row.venduto)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 p-3 rounded-xl border" style={{ background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.1)' }}>
                <p className="text-[11px]" style={{ color: 'var(--color-surface-500)' }}>
                    💡 <strong>Come viene tracciato?</strong> Quando il lead passa alla colonna "Appuntamento", il sistema imprime il "Timbro Setter". Se il Venditore in seguito sposta il lead in "Vinto", la Setter originale si vede accreditare il <em>Venduto Generato</em> qui in tabella.
                </p>
            </div>
        </div>
    )
}
