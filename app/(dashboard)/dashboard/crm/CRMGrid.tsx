import React from 'react'

interface CRMGridProps {
    leads: any[]
    stages: any[]
    onLeadClick: (lead: any) => void
}

function formatCurrency(v: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0)
}

function formatDate(dStr: string) {
    return new Date(dStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CRMGrid({ leads, stages, onLeadClick }: CRMGridProps) {
    return (
        <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-black/20" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <table className="w-full text-left text-sm text-gray-300 whitespace-nowrap">
                <thead className="sticky top-0 bg-[#0a0a0e] shadow-[0_1px_0_0_rgba(255,255,255,0.05)] z-10">
                    <tr>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Contatto</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Fase / Stage</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Valore</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Sorgente / Note</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Data Ins.</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {leads.map(lead => {
                        const stage = stages.find(s => s.id === lead.stage_id)
                        return (
                            <tr 
                                key={lead.id} 
                                onClick={() => onLeadClick(lead)}
                                className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                            >
                                <td className="px-5 py-4 max-w-[280px] truncate">
                                    <div className="font-semibold text-white">{lead.name}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">{lead.email || ''} {lead.email && lead.phone ? '•' : ''} {lead.phone || ''}</div>
                                </td>
                                <td className="px-5 py-4">
                                    {stage ? (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: `${stage.color}15`, color: stage.color, border: `1px solid ${stage.color}30` }}>
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: stage.color }} />
                                            {stage.name}
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-400 bg-white/5 border border-white/10">
                                            Non Assegnato
                                        </div>
                                    )}
                                </td>
                                <td className="px-5 py-4 font-medium text-green-400">
                                    {lead.value > 0 ? formatCurrency(lead.value) : '-'}
                                </td>
                                <td className="px-5 py-4 max-w-[200px] truncate text-xs text-gray-400">
                                    {lead.utm_source || lead.product ? (
                                        <span className="bg-white/5 px-2 py-1 rounded border border-white/10 mr-2">{lead.utm_source || lead.product}</span>
                                    ) : null}
                                    {lead.utm_campaign || lead.funnels?.name || ''}
                                </td>
                                <td className="px-5 py-4 text-xs text-gray-500">
                                    {formatDate(lead.meta_data?.last_submission_at || lead.created_at)}
                                </td>
                            </tr>
                        )
                    })}
                    {leads.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-5 py-16 text-center text-gray-500">
                                Nessun lead trovato con questi filtri.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
