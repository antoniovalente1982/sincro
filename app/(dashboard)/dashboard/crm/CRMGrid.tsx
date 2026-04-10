import React from 'react'

interface CRMGridProps {
    leads: any[]
    stages: any[]
    members: any[]
    selectedLeads: string[]
    onToggleLeadSelect: (leadId: string) => void
    onToggleAllSelect: () => void
    onLeadClick: (lead: any) => void
    onAssignLead: (leadId: string, assignedTo: string) => void
    onAssignSetter?: (leadId: string, setterId: string) => void
    onAssignCloser?: (leadId: string, closerId: string) => void
}

function formatCurrency(v: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0)
}

function formatDate(dStr: string) {
    return new Date(dStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CRMGrid({ leads, stages, members, selectedLeads, onToggleLeadSelect, onToggleAllSelect, onLeadClick, onAssignLead, onAssignSetter, onAssignCloser }: CRMGridProps) {
    const getDisplayName = (m: any) => {
        if (m.profiles?.full_name) return m.profiles.full_name;
        if (!m.profiles?.email) return 'Utente Sincro';
        return m.profiles.email.split('@')[0].split('.').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    const assignableSetters = members.filter((m: any) => m.role === 'setter' || (m.role === 'manager' && m.department === 'setting'))
    const assignableClosers = members.filter((m: any) => m.role === 'closer' || (m.role === 'manager' && m.department === 'sales'))

    return (
        <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-black/20" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <table className="w-full text-left text-sm text-gray-300 whitespace-nowrap">
                <thead className="sticky top-0 bg-[#0a0a0e] shadow-[0_1px_0_0_rgba(255,255,255,0.05)] z-10">
                    <tr>
                        <th className="px-5 py-4 w-12" onClick={e => e.stopPropagation()}>
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-gray-600 bg-black/40 text-indigo-500 focus:ring-indigo-500/30 cursor-pointer"
                                checked={leads.length > 0 && selectedLeads.length === leads.length}
                                onChange={onToggleAllSelect}
                            />
                        </th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Data Ins.</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Contatto</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Fase / Stage</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Valore</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Sorgente / Note</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs w-[180px]">Setter</th>
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs w-[180px]">Venditore</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {leads.map(lead => {
                        const stage = stages.find(s => s.id === lead.stage_id)
                        return (
                            <tr 
                                key={lead.id} 
                                onClick={() => onLeadClick(lead)}
                                className={`hover:bg-white/[0.04] cursor-pointer transition-colors ${selectedLeads.includes(lead.id) ? 'bg-indigo-500/10' : ''}`}
                            >
                                <td className="px-5 py-4 w-12" onClick={e => e.stopPropagation()}>
                                    <input 
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-600 bg-black/40 text-indigo-500 focus:ring-indigo-500/30 cursor-pointer"
                                        checked={selectedLeads.includes(lead.id)}
                                        onChange={() => onToggleLeadSelect(lead.id)}
                                    />
                                </td>
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
                                <td className="px-5 py-4 w-48" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                        {lead.setter_profile?.avatar_url ? (
                                            <img src={lead.setter_profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">S</div>
                                        )}
                                        <select
                                            className="w-full bg-black/40 border border-white/10 text-xs text-indigo-300 rounded-lg px-2 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer appearance-none outline-none"
                                            value={lead.setter_id || ''}
                                            onChange={e => onAssignSetter && onAssignSetter(lead.id, e.target.value)}
                                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .5rem top 50%', backgroundSize: '.65rem auto', paddingRight: '1.5rem' }}
                                        >
                                            <option value="" className="text-gray-500 bg-[#0a0a0e]">+ Setter</option>
                                            {assignableSetters.map((m: any) => (
                                                <option key={m.user_id} value={m.user_id} className="bg-[#0a0a0e]">
                                                    {getDisplayName(m)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </td>
                                <td className="px-5 py-4 w-48" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                        {lead.closer_profile?.avatar_url ? (
                                            <img src={lead.closer_profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">V</div>
                                        )}
                                        <select
                                            className="w-full bg-black/40 border border-white/10 text-xs text-emerald-300 rounded-lg px-2 py-1.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer appearance-none outline-none"
                                            value={lead.closer_id || ''}
                                            onChange={e => onAssignCloser && onAssignCloser(lead.id, e.target.value)}
                                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .5rem top 50%', backgroundSize: '.65rem auto', paddingRight: '1.5rem' }}
                                        >
                                            <option value="" className="text-gray-500 bg-[#0a0a0e]">+ Venditore</option>
                                            {assignableClosers.map((m: any) => (
                                                <option key={m.user_id} value={m.user_id} className="bg-[#0a0a0e]">
                                                    {getDisplayName(m)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                    {leads.length === 0 && (
                        <tr>
                            <td colSpan={8} className="px-5 py-16 text-center text-gray-500">
                                Nessun lead trovato con questi filtri.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
