import React from 'react'

interface CRMGridProps {
    leads: any[]
    stages: any[]
    members: any[]
    onLeadClick: (lead: any) => void
    onAssignLead: (leadId: string, assignedTo: string) => void
}

function formatCurrency(v: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0)
}

function formatDate(dStr: string) {
    return new Date(dStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CRMGrid({ leads, stages, members, onLeadClick, onAssignLead }: CRMGridProps) {
    return (
        <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-black/20" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <table className="w-full text-left text-sm text-gray-300 whitespace-nowrap">
                <thead className="sticky top-0 bg-[#0a0a0e] shadow-[0_1px_0_0_rgba(255,255,255,0.05)] z-10">
                    <tr>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Data Ins.</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Contatto</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Fase / Stage</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Valore</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Sorgente / Note</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs w-[180px]">Assegnato a</th>
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
                                <td className="px-5 py-4 text-xs font-semibold text-gray-400 whitespace-nowrap">
                                    {formatDate(lead.meta_data?.last_submission_at || lead.created_at)}
                                </td>
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
                                <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                    <select
                                        className="w-full bg-black/40 border border-white/10 text-xs text-gray-300 rounded-lg px-2 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer appearance-none outline-none"
                                        value={lead.assigned_to || ''}
                                        onChange={e => onAssignLead(lead.id, e.target.value)}
                                        style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .5rem top 50%', backgroundSize: '.65rem auto', paddingRight: '1.5rem' }}
                                    >
                                        <option value="" className="text-gray-500 bg-[#0a0a0e]">Nessuno</option>
                                        {members.filter(m => ['setter', 'closer', 'admin', 'owner', 'manager'].includes(m.role)).map(m => (
                                            <option key={m.user_id} value={m.user_id} className="bg-[#0a0a0e]">
                                                {m.profiles?.full_name || m.profiles?.email}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        )
                    })}
                    {leads.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-5 py-16 text-center text-gray-500">
                                Nessun lead trovato con questi filtri.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
