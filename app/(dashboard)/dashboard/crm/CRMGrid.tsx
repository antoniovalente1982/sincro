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
    onUpdateSetterField?: (leadId: string, field: 'setter_step' | 'try_anthon' | 'esito', value: string) => void
    onUpdateCloserField?: (leadId: string, field: 'closer_appt_status' | 'closer_trial_status' | 'closer_outcome' | 'closer_downsell', value: string) => void
    onFastBook?: (lead: any) => void
    canEditSetterSteps?: boolean
    canEditCloserSteps?: boolean
}

function formatCurrency(v: number) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0)
}

function formatDate(dStr: string) {
    return new Date(dStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CRMGrid({ leads, stages, members, selectedLeads, onToggleLeadSelect, onToggleAllSelect, onLeadClick, onAssignLead, onAssignSetter, onAssignCloser, onUpdateSetterField, onUpdateCloserField, onFastBook, canEditSetterSteps, canEditCloserSteps }: CRMGridProps) {
    const getDisplayName = (m: any) => {
        if (m.profiles?.full_name) return m.profiles.full_name;
        if (!m.profiles?.email) return 'Utente Sincro';
        return m.profiles.email.split('@')[0].split('.').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    const assignableSetters = members.filter((m: any) => m.role === 'setter' || (m.role === 'manager' && m.department === 'setting'))
    const assignableClosers = members.filter((m: any) => m.role === 'closer' || (m.role === 'manager' && m.department === 'sales'))

    const [hiddenCols, setHiddenCols] = React.useState<Record<string, boolean>>({})
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
        try {
            const saved = localStorage.getItem('sincro_grid_hidden_cols')
            if (saved) setHiddenCols(JSON.parse(saved))
        } catch (e) {}
    }, [])

    const toggleCol = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const next = { ...hiddenCols, [id]: !hiddenCols[id] }
        setHiddenCols(next)
        localStorage.setItem('sincro_grid_hidden_cols', JSON.stringify(next))
    }

    const COLUMNS = [
        { id: 'data', label: 'Data Ins.' },
        { id: 'fase', label: 'Fase / Stage' },
        { id: 'valore', label: 'Valore' },
        { id: 'fonte', label: 'Fonte di Traffico' },
        { id: 'setter', label: 'Setter' },
        { id: 'venditore', label: 'Venditore' },
        { id: 'step', label: 'Step' },
        { id: 'trya', label: 'Try A.' },
        { id: 'esito', label: 'Esito Setter' },
        { id: 'c_apptdate', label: 'Data Appuntamento' },
        { id: 'c_appt', label: 'Stato Appuntamento' },
        { id: 'c_trial', label: 'Prova' },
        { id: 'c_outcome', label: 'Esito Trattativa' },
        { id: 'c_downsell', label: 'Note / Downsell' }
    ]

    return (
        <div className="w-full flex flex-col gap-3">
            <div className="flex justify-end pr-1">
                <details className="relative group/col-sel">
                    <summary className="list-none cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-colors shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line></svg> 
                        Visualizza Colonne
                    </summary>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a24] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                        {isMounted && COLUMNS.map(c => (
                            <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/5 cursor-pointer hover:text-white transition-colors">
                                <input type="checkbox" className="rounded border-gray-600 bg-black/40 text-indigo-500 focus:ring-indigo-500/30 cursor-pointer" checked={!hiddenCols[c.id]} onChange={(e) => toggleCol(c.id, e as unknown as React.MouseEvent)} onClick={e => e.stopPropagation()} />
                                {c.label}
                            </label>
                        ))}
                    </div>
                </details>
            </div>
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
                        {!hiddenCols['data'] && <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs min-w-[120px]">Data Ins.</th>}
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs min-w-[220px]">Contatto</th>
                        {!hiddenCols['fase'] && <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs min-w-[140px]">Fase / Stage</th>}
                        {!hiddenCols['valore'] && <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs min-w-[100px]">Valore</th>}
                        {!hiddenCols['fonte'] && <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs min-w-[180px]">Fonte di Traffico</th>}
                        {!hiddenCols['setter'] && <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs min-w-[240px]">Setter</th>}
                        {!hiddenCols['venditore'] && <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs min-w-[240px]">Venditore</th>}
                        {!hiddenCols['step'] && <th className="px-5 py-4 font-semibold text-yellow-500/60 uppercase tracking-wider text-xs min-w-[130px]">Step</th>}
                        {!hiddenCols['trya'] && <th className="px-5 py-4 font-semibold text-yellow-500/60 uppercase tracking-wider text-xs min-w-[100px]">Try A.</th>}
                        {!hiddenCols['esito'] && <th className="px-5 py-4 font-semibold text-yellow-500/60 uppercase tracking-wider text-xs min-w-[130px]">Esito Setter</th>}
                        <th className="px-5 py-4 font-semibold text-gray-400 uppercase tracking-wider text-xs text-right min-w-[120px]">Azioni</th>
                        {!hiddenCols['c_apptdate'] && <th className="px-5 py-4 font-semibold text-emerald-500/60 uppercase tracking-wider text-xs min-w-[140px]">Data Appuntamento</th>}
                        {!hiddenCols['c_appt'] && <th className="px-5 py-4 font-semibold text-emerald-500/60 uppercase tracking-wider text-xs min-w-[160px]">Stato App.</th>}
                        {!hiddenCols['c_trial'] && <th className="px-5 py-4 font-semibold text-emerald-500/60 uppercase tracking-wider text-xs min-w-[140px]">Prova</th>}
                        {!hiddenCols['c_outcome'] && <th className="px-5 py-4 font-semibold text-emerald-500/60 uppercase tracking-wider text-xs min-w-[140px]">Esito Trattativa</th>}
                        {!hiddenCols['c_downsell'] && <th className="px-5 py-4 font-semibold text-emerald-500/60 uppercase tracking-wider text-xs min-w-[200px]">Note / Downsell</th>}
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
                                {!hiddenCols['data'] && (
                                    <td className="px-5 py-4 text-xs font-semibold text-gray-400 whitespace-nowrap">
                                        {formatDate(lead.meta_data?.last_submission_at || lead.created_at)}
                                    </td>
                                )}
                                <td className="px-5 py-4 max-w-[280px] truncate">
                                    <div className="font-semibold text-white">{lead.name}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">{lead.email || ''} {lead.email && lead.phone ? '•' : ''} {lead.phone || ''}</div>
                                </td>
                                {!hiddenCols['fase'] && (
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
                                )}
                                {!hiddenCols['valore'] && (
                                    <td className="px-5 py-4 font-medium text-green-400">
                                        {lead.value > 0 ? formatCurrency(lead.value) : '-'}
                                    </td>
                                )}
                                {!hiddenCols['fonte'] && (
                                    <td className="px-5 py-4 max-w-[200px] truncate text-xs text-gray-400">
                                        {lead.utm_source || lead.product ? (
                                            <span className="bg-white/5 px-2 py-1 rounded border border-white/10 mr-2">{lead.utm_source || lead.product}</span>
                                        ) : null}
                                        {lead.utm_campaign || lead.funnels?.name || ''}
                                    </td>
                                )}
                                {!hiddenCols['setter'] && (
                                    <td className="px-5 py-4 min-w-[240px]" onClick={e => e.stopPropagation()}>
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
                                )}
                                {!hiddenCols['venditore'] && (
                                    <td className="px-5 py-4 min-w-[240px]" onClick={e => e.stopPropagation()}>
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
                                )}
                                {/* Setter Step */}
                                {!hiddenCols['step'] && (
                                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                        {canEditSetterSteps && onUpdateSetterField ? (
                                            <select
                                                className="bg-black/40 border border-white/10 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer appearance-none w-full"
                                                style={{
                                                    color: lead.setter_step ? (() => { const STEPS = [{v:'Chiamato',c:'#22c55e'},{v:'1° chiamata fatta',c:'#eab308'},{v:'2°chiamata fatta',c:'#f97316'},{v:'3° chiamata fatta',c:'#ef4444'},{v:'Messaggio inviato',c:'#3b82f6'},{v:'Non risponde',c:'#a1a1aa'},{v:'Email inviata (ULTIMO STEP)',c:'#8b5cf6'},{v:'Follow up',c:'#06b6d4'},{v:'Contatto POST EMAIL',c:'#ec4899'}]; return STEPS.find(s=>s.v===lead.setter_step)?.c || '#a1a1aa' })() : '#71717a',
                                                }}
                                                value={lead.setter_step || ''}
                                                onChange={e => onUpdateSetterField(lead.id, 'setter_step', e.target.value)}
                                            >
                                                <option value="" className="bg-[#0a0a0e] text-gray-500">—</option>
                                                <option value="Chiamato" className="bg-[#0a0a0e]">Chiamato</option>
                                                <option value="1° chiamata fatta" className="bg-[#0a0a0e]">1° chiamata</option>
                                                <option value="2°chiamata fatta" className="bg-[#0a0a0e]">2° chiamata</option>
                                                <option value="3° chiamata fatta" className="bg-[#0a0a0e]">3° chiamata</option>
                                                <option value="Messaggio inviato" className="bg-[#0a0a0e]">Msg inviato</option>
                                                <option value="Non risponde" className="bg-[#0a0a0e]">Non risponde</option>
                                                <option value="Email inviata (ULTIMO STEP)" className="bg-[#0a0a0e]">Email (ultimo)</option>
                                                <option value="Follow up" className="bg-[#0a0a0e]">Follow up</option>
                                                <option value="Contatto POST EMAIL" className="bg-[#0a0a0e]">POST EMAIL</option>
                                            </select>
                                        ) : lead.setter_step ? (
                                            <span className="text-xs font-semibold">{lead.setter_step}</span>
                                        ) : <span className="text-gray-600">—</span>}
                                    </td>
                                )}
                                {/* Try Anthon */}
                                {!hiddenCols['trya'] && (
                                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                        {canEditSetterSteps && onUpdateSetterField ? (
                                            <select
                                                className="bg-black/40 border border-white/10 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer appearance-none w-full"
                                                style={{ color: lead.try_anthon === 'Inviato' ? '#22c55e' : lead.try_anthon === 'Non inviato' ? '#ef4444' : '#71717a' }}
                                                value={lead.try_anthon || ''}
                                                onChange={e => onUpdateSetterField(lead.id, 'try_anthon', e.target.value)}
                                            >
                                                <option value="" className="bg-[#0a0a0e] text-gray-500">—</option>
                                                <option value="Inviato" className="bg-[#0a0a0e]">Inviato</option>
                                                <option value="Non inviato" className="bg-[#0a0a0e]">Non inviato</option>
                                            </select>
                                        ) : lead.try_anthon ? (
                                            <span className="text-xs font-semibold" style={{ color: lead.try_anthon === 'Inviato' ? '#22c55e' : '#ef4444' }}>{lead.try_anthon}</span>
                                        ) : <span className="text-gray-600">—</span>}
                                    </td>
                                )}
                                {/* Esito */}
                                {!hiddenCols['esito'] && (
                                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                        {canEditSetterSteps && onUpdateSetterField ? (
                                            <select
                                                className="bg-black/40 border border-white/10 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer appearance-none w-full"
                                                style={{
                                                    color: lead.esito ? (() => { const E = [{v:'Appuntamento Preso',c:'#22c55e'},{v:'NO APPUNTAMENTO',c:'#ef4444'},{v:'FUORI TARGET',c:'#71717a'},{v:'NUMERO INESISTENTE',c:'#a1a1aa'},{v:'DA RISENTIRE',c:'#eab308'}]; return E.find(s=>s.v===lead.esito)?.c || '#a1a1aa' })() : '#71717a',
                                                }}
                                                value={lead.esito || ''}
                                                onChange={e => onUpdateSetterField(lead.id, 'esito', e.target.value)}
                                            >
                                                <option value="" className="bg-[#0a0a0e] text-gray-500">—</option>
                                                <option value="Appuntamento Preso" className="bg-[#0a0a0e]">App. Preso</option>
                                                <option value="NO APPUNTAMENTO" className="bg-[#0a0a0e]">No App.</option>
                                                <option value="FUORI TARGET" className="bg-[#0a0a0e]">Fuori Target</option>
                                                <option value="NUMERO INESISTENTE" className="bg-[#0a0a0e]">Nr Inesistente</option>
                                                <option value="DA RISENTIRE" className="bg-[#0a0a0e]">Da Risentire</option>
                                            </select>
                                        ) : lead.esito ? (
                                            <span className="text-xs font-semibold">{lead.esito}</span>
                                        ) : <span className="text-gray-600">—</span>}
                                    </td>
                                )}
                                <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                                    {onFastBook && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onFastBook(lead) }}
                                            className="text-[10px] font-bold px-3 py-1.5 rounded transition flex items-center justify-center gap-1.5 ml-auto whitespace-nowrap"
                                            style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#e9d5ff' }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                            Prenota
                                        </button>
                                    )}
                                </td>
                                {/* CLOSER WORKFLOW */}
                                {!hiddenCols['c_apptdate'] && (
                                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                        {(() => {
                                            const activeEvents = (lead.calendar_events || []).filter((e: any) => e.status !== 'cancelled').sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
                                            const nextEvent = activeEvents.find((e: any) => new Date(e.start_time).getTime() >= Date.now() - 3600000) || activeEvents[activeEvents.length - 1];
                                            if (!nextEvent) return <span className="text-gray-600">—</span>;

                                            const d = new Date(nextEvent.start_time);
                                            const now = new Date();
                                            const diffMs = d.getTime() - now.getTime();
                                            const diffHours = diffMs / (1000 * 60 * 60);

                                            let colorObj = { bg: 'rgba(255,255,255,0.05)', text: '#9ca3af', border: 'rgba(255,255,255,0.1)' };
                                            
                                            if (lead.closer_appt_status === 'FATTO') {
                                                colorObj = { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' };
                                            } else if (diffHours < 0) { // Past
                                                colorObj = { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
                                            } else if (diffHours <= 24) { // Next 24h
                                                colorObj = { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: 'rgba(234, 179, 8, 0.3)' };
                                            }

                                            return (
                                                <div className="text-xs font-bold px-2 py-1 rounded-md text-center" style={{ background: colorObj.bg, color: colorObj.text, border: `1px solid ${colorObj.border}` }}>
                                                    {d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}  {d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                )}
                                {!hiddenCols['c_appt'] && (
                                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                        {canEditCloserSteps && onUpdateCloserField ? (
                                            <select
                                                className="bg-black/40 border border-white/10 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer appearance-none w-full"
                                                style={{ color: lead.closer_appt_status ? (() => { const C = [{v:'FATTO',c:'#22c55e'},{v:'NO SHOW',c:'#ef4444'},{v:'CANCELLATO',c:'#ef4444'},{v:'RIPROGRAMMATO',c:'#3b82f6'}]; return C.find(s=>s.v===lead.closer_appt_status)?.c || '#a1a1aa' })() : '#71717a' }}
                                                value={lead.closer_appt_status || ''}
                                                onChange={e => onUpdateCloserField(lead.id, 'closer_appt_status', e.target.value)}
                                            >
                                                <option value="" className="bg-[#0a0a0e] text-gray-500">—</option>
                                                <option value="FATTO" className="bg-[#0a0a0e]">Fatto</option>
                                                <option value="NO SHOW" className="bg-[#0a0a0e]">No Show</option>
                                                <option value="CANCELLATO" className="bg-[#0a0a0e]">Cancellato</option>
                                                <option value="RIPROGRAMMATO" className="bg-[#0a0a0e]">Riprogrammato</option>
                                            </select>
                                        ) : lead.closer_appt_status ? (
                                            <span className="text-xs font-semibold">{lead.closer_appt_status}</span>
                                        ) : <span className="text-gray-600">—</span>}
                                    </td>
                                )}
                                {!hiddenCols['c_trial'] && (
                                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                        {canEditCloserSteps && onUpdateCloserField ? (
                                            <select
                                                className="bg-black/40 border border-white/10 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer appearance-none w-full"
                                                style={{ color: lead.closer_trial_status ? (() => { const C = [{v:'FATTA',c:'#22c55e'},{v:'DA FARE',c:'#eab308'},{v:'ANNULLATA',c:'#ef4444'},{v:'RIPROGRAMMATA',c:'#3b82f6'}]; return C.find(s=>s.v===lead.closer_trial_status)?.c || '#a1a1aa' })() : '#71717a' }}
                                                value={lead.closer_trial_status || ''}
                                                onChange={e => onUpdateCloserField(lead.id, 'closer_trial_status', e.target.value)}
                                            >
                                                <option value="" className="bg-[#0a0a0e] text-gray-500">—</option>
                                                <option value="FATTA" className="bg-[#0a0a0e]">Fatta</option>
                                                <option value="DA FARE" className="bg-[#0a0a0e]">Da Fare</option>
                                                <option value="ANNULLATA" className="bg-[#0a0a0e]">Annullata</option>
                                                <option value="RIPROGRAMMATA" className="bg-[#0a0a0e]">Riprogrammata</option>
                                            </select>
                                        ) : lead.closer_trial_status ? (
                                            <span className="text-xs font-semibold">{lead.closer_trial_status}</span>
                                        ) : <span className="text-gray-600">—</span>}
                                    </td>
                                )}
                                {!hiddenCols['c_outcome'] && (
                                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                        {canEditCloserSteps && onUpdateCloserField ? (
                                            <select
                                                className="bg-black/40 border border-white/10 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer appearance-none w-full"
                                                style={{ color: lead.closer_outcome ? (() => { const C = [{v:'VINTA',c:'#22c55e'},{v:'PERSA',c:'#ef4444'},{v:'ANNULLATA',c:'#ef4444'}]; return C.find(s=>s.v===lead.closer_outcome)?.c || '#a1a1aa' })() : '#71717a' }}
                                                value={lead.closer_outcome || ''}
                                                onChange={e => onUpdateCloserField(lead.id, 'closer_outcome', e.target.value)}
                                            >
                                                <option value="" className="bg-[#0a0a0e] text-gray-500">—</option>
                                                <option value="VINTA" className="bg-[#0a0a0e]">Vinta</option>
                                                <option value="PERSA" className="bg-[#0a0a0e]">Persa</option>
                                                <option value="ANNULLATA" className="bg-[#0a0a0e]">Annullata</option>
                                            </select>
                                        ) : lead.closer_outcome ? (
                                            <span className="text-xs font-semibold">{lead.closer_outcome}</span>
                                        ) : <span className="text-gray-600">—</span>}
                                    </td>
                                )}
                                {!hiddenCols['c_downsell'] && (
                                    <td className="px-5 py-4 min-w-[200px]" onClick={e => e.stopPropagation()}>
                                        {canEditCloserSteps && onUpdateCloserField ? (
                                            <input
                                                type="text"
                                                className="w-full bg-black/40 border border-white/10 text-xs text-white rounded-lg px-2 py-1.5 focus:border-indigo-500 focus:ring-1 outline-none transition-colors placeholder-gray-600"
                                                placeholder="Note/Downsell..."
                                                defaultValue={lead.closer_downsell || ''}
                                                onBlur={e => onUpdateCloserField(lead.id, 'closer_downsell', e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        (e.target as HTMLInputElement).blur();
                                                    }
                                                }}
                                            />
                                        ) : lead.closer_downsell ? (
                                            <span className="text-xs text-gray-300">{lead.closer_downsell}</span>
                                        ) : <span className="text-gray-600">—</span>}
                                    </td>
                                )}
                            </tr>
                        )
                    })}
                    {leads.length === 0 && (
                        <tr>
                            <td colSpan={30} className="px-5 py-16 text-center text-gray-500">
                                Nessun lead trovato con questi filtri.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        </div>
    )
}
