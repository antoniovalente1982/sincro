'use client'

import { useState } from 'react'
import {
    Plug, Check, AlertCircle, Clock, ExternalLink,
    ChevronRight, Zap, BarChart3, MessageCircle, FileSpreadsheet, Tv, Video, Megaphone
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ConnectionField {
    key: string
    label: string
    placeholder: string
    type?: string
}

interface ConnectionCard {
    provider: string
    name: string
    description: string
    icon: any
    color: string
    fields: ConnectionField[]
    comingSoon?: boolean
}

const connectionsList: ConnectionCard[] = [
    {
        provider: 'meta_capi',
        name: 'Meta CAPI',
        description: 'Tracciamento server-side: invia Lead, Appuntamento, Vendita a Meta',
        icon: Zap,
        color: '#6366f1',
        fields: [
            { key: 'pixel_id', label: 'Pixel ID', placeholder: 'Il tuo Meta Pixel ID' },
            { key: 'access_token', label: 'CAPI Access Token', placeholder: 'Token da Events Manager', type: 'password' },
        ],
    },
    {
        provider: 'meta_ads',
        name: 'Meta Ads',
        description: 'Gestisci campagne Facebook/Instagram, performance e regole automatiche',
        icon: Megaphone,
        color: '#1877f2',
        fields: [
            { key: 'app_id', label: 'App ID', placeholder: 'Meta App ID' },
            { key: 'app_secret', label: 'App Secret', placeholder: 'App Secret', type: 'password' },
            { key: 'access_token', label: 'System User Token', placeholder: 'Token ads_management', type: 'password' },
            { key: 'ad_account_id', label: 'Ad Account ID', placeholder: '511099830249139' },
        ],
    },
    {
        provider: 'telegram',
        name: 'Telegram Bot',
        description: 'Ricevi report e controlla tutto da Telegram con comandi rapidi',
        icon: MessageCircle,
        color: '#0088cc',
        fields: [
            { key: 'bot_token', label: 'Bot Token', placeholder: 'Token da @BotFather', type: 'password' },
            { key: 'chat_id', label: 'Chat ID', placeholder: 'Il tuo chat ID' },
        ],
    },
    {
        provider: 'google_sheets',
        name: 'Google Sheets',
        description: 'Sincronizza lead e dati con i fogli Google',
        icon: FileSpreadsheet,
        color: '#0f9d58',
        fields: [
            { key: 'spreadsheet_id', label: 'Spreadsheet ID', placeholder: 'ID dal URL del foglio' },
            { key: 'api_key', label: 'API Key', placeholder: 'Google Cloud API Key', type: 'password' },
        ],
    },
    { provider: 'google_ads', name: 'Google Ads', description: 'Campagne Search, Display e YouTube', icon: BarChart3, color: '#4285f4', fields: [], comingSoon: true },
    { provider: 'tiktok_ads', name: 'TikTok Ads', description: 'Raggiungi genitori e giovani su TikTok', icon: Tv, color: '#ee1d52', fields: [], comingSoon: true },
    { provider: 'youtube_ads', name: 'YouTube Ads', description: 'Video ads su YouTube', icon: Video, color: '#ff0000', fields: [], comingSoon: true },
]

export default function ConnectionsPage() {
    const [expanded, setExpanded] = useState<string | null>(null)
    const [formData, setFormData] = useState<Record<string, Record<string, string>>>({})
    const [saving, setSaving] = useState<string | null>(null)
    const [saved, setSaved] = useState<Record<string, boolean>>({})
    const supabase = createClient()

    const handleSave = async (provider: string) => {
        setSaving(provider)
        // In production this saves to connections table
        // For now, simulate + store locally
        await new Promise(resolve => setTimeout(resolve, 1200))
        setSaved(prev => ({ ...prev, [provider]: true }))
        setSaving(null)
    }

    const updateField = (provider: string, key: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [provider]: { ...prev[provider], [key]: value }
        }))
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Plug className="w-6 h-6" style={{ color: 'var(--color-sincro-400)' }} />
                    Connessioni
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-surface-600)' }}>
                    Collega i tuoi canali pubblicitari, tracciamento e strumenti. Architettura multi-canale pronta.
                </p>
            </div>

            {/* Priority */}
            <div className="glass-card p-5 animate-pulse-glow">
                <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-sincro-400)' }} />
                    <div>
                        <div className="text-sm font-bold text-white">Priorità: Meta CAPI → Meta Ads</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-surface-500)' }}>
                            1. Collega Meta CAPI per tracciamento server-side {'\n'}
                            2. Collega Meta Ads per gestire le campagne {'\n'}
                            I restanti canali possono essere aggiunti quando vuoi.
                        </div>
                    </div>
                </div>
            </div>

            {/* Cards */}
            <div className="space-y-3">
                {connectionsList.map((conn) => (
                    <div
                        key={conn.provider}
                        className="glass-card overflow-hidden transition-all duration-300"
                        style={{ opacity: conn.comingSoon ? 0.5 : 1 }}
                    >
                        <button
                            onClick={() => !conn.comingSoon && setExpanded(expanded === conn.provider ? null : conn.provider)}
                            className="w-full p-5 flex items-center gap-4 text-left transition-colors hover:bg-white/[0.02]"
                            disabled={conn.comingSoon}
                        >
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: `${conn.color}15`, border: `1px solid ${conn.color}30` }}>
                                <conn.icon className="w-5 h-5" style={{ color: conn.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-white">{conn.name}</span>
                                    {conn.comingSoon && (
                                        <span className="badge" style={{ background: 'var(--color-surface-200)', color: 'var(--color-surface-500)', border: '1px solid var(--color-surface-300)', fontSize: '10px' }}>
                                            Prossimamente
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-surface-500)' }}>{conn.description}</div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                {saved[conn.provider] ? (
                                    <span className="badge badge-success"><Check className="w-3 h-3" /> Connesso</span>
                                ) : (
                                    <span className="badge" style={{ background: 'var(--color-surface-200)', color: 'var(--color-surface-600)', border: '1px solid var(--color-surface-300)' }}>
                                        Non connesso
                                    </span>
                                )}
                                {!conn.comingSoon && (
                                    <ChevronRight className="w-4 h-4 transition-transform duration-200"
                                        style={{ color: 'var(--color-surface-500)', transform: expanded === conn.provider ? 'rotate(90deg)' : '' }} />
                                )}
                            </div>
                        </button>

                        {expanded === conn.provider && conn.fields.length > 0 && (
                            <div className="px-5 pb-5 pt-2 border-t animate-fade-in" style={{ borderColor: 'var(--color-surface-200)' }}>
                                <div className="space-y-4 max-w-lg">
                                    {conn.fields.map((field) => (
                                        <div key={field.key}>
                                            <label className="label">{field.label}</label>
                                            <input
                                                type={field.type || 'text'}
                                                className="input"
                                                placeholder={field.placeholder}
                                                value={formData[conn.provider]?.[field.key] || ''}
                                                onChange={(e) => updateField(conn.provider, field.key, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                    <button onClick={() => handleSave(conn.provider)} className="btn-primary" disabled={saving === conn.provider}>
                                        {saving === conn.provider ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <><Check className="w-4 h-4" /> Salva e Connetti</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
