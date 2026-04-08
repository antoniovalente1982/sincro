'use client'

import { CalendarDays, Clock, Users, Plus } from 'lucide-react'

export default function CalendarPage() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <CalendarDays className="w-6 h-6" style={{ color: '#6366f1' }} />
                        Calendario Appuntamenti
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                        Gestisci appuntamenti e disponibilità del team
                    </p>
                </div>
            </div>

            {/* Coming Soon / Placeholder */}
            <div className="glass-card p-12 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
                    <CalendarDays className="w-8 h-8" style={{ color: '#6366f1' }} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Calendario in arrivo</h2>
                <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--color-surface-500)' }}>
                    Il calendario integrato con Google Calendar permetterà ai setter di prenotare appuntamenti 
                    direttamente negli slot disponibili dei venditori.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-lg mx-auto">
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-surface-200)' }}>
                        <CalendarDays className="w-5 h-5 mx-auto mb-2" style={{ color: '#3b82f6' }} />
                        <p className="text-xs font-semibold text-white">Vista Settimanale</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-surface-200)' }}>
                        <Clock className="w-5 h-5 mx-auto mb-2" style={{ color: '#22c55e' }} />
                        <p className="text-xs font-semibold text-white">Slot Automatici</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-surface-200)' }}>
                        <Users className="w-5 h-5 mx-auto mb-2" style={{ color: '#f59e0b' }} />
                        <p className="text-xs font-semibold text-white">Sync Google</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
