'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, CheckCircle, Sparkles, ArrowRight, Shield, Clock, Users } from 'lucide-react'

interface Props {
    funnel: {
        id: string; name: string; description?: string; meta_pixel_id?: string
        settings?: any; organizations?: any
    }
}

export default function FunnelLandingPage({ funnel }: Props) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const fbIdsRef = useRef<{ fbc?: string; fbp?: string }>({})
    const [error, setError] = useState('')

    // Extract UTM params from URL
    const [utmParams, setUtmParams] = useState<any>({})
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const utms = {
            utm_source: params.get('utm_source') || undefined,
            utm_medium: params.get('utm_medium') || undefined,
            utm_campaign: params.get('utm_campaign') || undefined,
            utm_content: params.get('utm_content') || undefined,
            utm_term: params.get('utm_term') || undefined,
        }
        setUtmParams(utms)

        // Generate or retrieve visitor_id for unique visitor tracking
        let visitorId = localStorage.getItem('_sincro_vid')
        if (!visitorId) {
            visitorId = crypto.randomUUID()
            localStorage.setItem('_sincro_vid', visitorId)
        }

        // Generate event_id for PageView deduplication (pixel ↔ CAPI)
        const pageViewEventId = `pv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        // Get Facebook click/browser IDs from cookies for CAPI
        const cookies = document.cookie.split(';').reduce((acc: any, c) => {
            const sep = c.indexOf('=')
            if (sep > -1) acc[c.substring(0, sep).trim()] = c.substring(sep + 1).trim()
            return acc
        }, {})

        // Compute fbc ONCE — Meta requires fbclid passed unmodified
        let computedFbc = cookies._fbc || undefined
        if (!computedFbc) {
            const fbclid = params.get('fbclid')
            if (fbclid) computedFbc = `fb.1.${Date.now()}.${fbclid}`
        }
        const computedFbp = cookies._fbp || undefined
        fbIdsRef.current = { fbc: computedFbc, fbp: computedFbp }

        const orgId = funnel.settings?.organization_id || (funnel as any).organizations?.id

        // Fire pixel PageView immediately (client-side)
        if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'PageView', {}, { eventID: pageViewEventId })
        }

        // Delay CAPI PageView by 2s to let Meta Pixel set _fbp cookie first
        setTimeout(() => {
            const freshCookies = document.cookie.split(';').reduce((acc: any, c) => {
                const sep = c.indexOf('=')
                if (sep > -1) acc[c.substring(0, sep).trim()] = c.substring(sep + 1).trim()
                return acc
            }, {})
            const freshFbp = freshCookies._fbp || computedFbp
            const freshFbc = freshCookies._fbc || computedFbc
            fbIdsRef.current = { fbc: freshFbc, fbp: freshFbp }

            fetch('/api/track/pageview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: orgId,
                    funnel_id: funnel.id,
                    page_path: window.location.pathname,
                    page_variant: funnel.settings?.ab_variant || 'A',
                    visitor_id: visitorId,
                    utm_source: utms.utm_source, utm_medium: utms.utm_medium,
                    utm_campaign: utms.utm_campaign, utm_content: utms.utm_content,
                    utm_term: utms.utm_term,
                    fbadid: params.get('fbadid') || undefined,
                    referrer: document.referrer || undefined,
                    event_id: pageViewEventId,
                    fbc: freshFbc,
                    fbp: freshFbp,
                    fb_login_id: freshCookies.c_user || undefined,
                    page_url: window.location.href,
                }),
            }).catch(() => {})
        }, 2000)
    }, [])

    // Reuse the fbc/fbp computed once on page load
    const getFbIds = useCallback(() => fbIdsRef.current, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name) return
        setLoading(true)
        setError('')

        try {
            // Advanced Matching: reinitialize pixel with user data (Meta hashes automatically)
            if (funnel.meta_pixel_id && typeof window !== 'undefined' && (window as any).fbq) {
                const matchData: any = {}
                if (email) matchData.em = email.toLowerCase().trim()
                if (phone) matchData.ph = phone.replace(/\D/g, '')
                ;(window as any).fbq('init', funnel.meta_pixel_id, matchData)
            }

            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    funnel_id: funnel.id,
                    name, email, phone,
                    page_variant: funnel.settings?.ab_variant || 'A',
                    landing_url: window.location.host + window.location.pathname,
                    ...utmParams,
                    ...getFbIds(),
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Errore')
            }

            setSubmitted(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const orgName = funnel.organizations?.name || 'ADPILOTIK'
    const settings = funnel.settings || {}
    const headline = settings.headline || funnel.name
    const subheadline = settings.subheadline || funnel.description || 'Compila il form per ricevere maggiori informazioni'
    const ctaText = settings.cta_text || 'Invia Richiesta'
    const thankYouText = settings.thank_you || 'Grazie! Ti contatteremo il prima possibile.'
    const accentColor = settings.accent_color || '#6366f1'

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `radial-gradient(ellipse at top, ${accentColor}15, #09090b 60%)` }}>
                <div className="w-full max-w-lg text-center" style={{ animation: 'fadeIn 0.5s ease-out' }}>
                    <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: `${accentColor}15`, border: `2px solid ${accentColor}40` }}>
                        <CheckCircle className="w-10 h-10" style={{ color: accentColor }} />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-3">Perfetto! ✨</h1>
                    <p className="text-lg mb-8" style={{ color: '#a1a1aa' }}>{thankYouText}</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ background: `${accentColor}10`, color: accentColor, border: `1px solid ${accentColor}20` }}>
                        <Clock className="w-4 h-4" />
                        Ti ricontatteremo entro 24 ore
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen" style={{ background: '#09090b' }}>
            {/* Hero */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at top, ${accentColor}20, transparent 60%)` }} />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-15 blur-[150px]" style={{ background: accentColor }} />

                <div className="relative max-w-5xl mx-auto px-4 py-16 md:py-24">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        {/* Left: Content */}
                        <div style={{ animation: 'fadeIn 0.6s ease-out' }}>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6" style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}>
                                <Sparkles className="w-3.5 h-3.5" />
                                {orgName}
                            </div>

                            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-6 tracking-tight">
                                {headline}
                            </h1>

                            <p className="text-lg mb-8 leading-relaxed" style={{ color: '#a1a1aa' }}>
                                {subheadline}
                            </p>

                            {/* Trust badges */}
                            <div className="flex flex-wrap gap-6">
                                <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}>
                                    <Shield className="w-4 h-4" style={{ color: '#22c55e' }} />
                                    100% Gratuito
                                </div>
                                <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}>
                                    <Clock className="w-4 h-4" style={{ color: '#f59e0b' }} />
                                    Risposta in 24h
                                </div>
                                <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}>
                                    <Users className="w-4 h-4" style={{ color: '#3b82f6' }} />
                                    +500 clienti
                                </div>
                            </div>
                        </div>

                        {/* Right: Form */}
                        <div style={{ animation: 'fadeIn 0.8s ease-out' }}>
                            <form onSubmit={handleSubmit} className="rounded-2xl p-8 space-y-5" style={{
                                background: 'rgba(15, 15, 19, 0.8)',
                                backdropFilter: 'blur(20px)',
                                border: `1px solid ${accentColor}20`,
                                boxShadow: `0 0 60px ${accentColor}10`,
                            }}>
                                <h3 className="text-lg font-bold text-white text-center mb-2">
                                    Richiedi Informazioni
                                </h3>

                                <div>
                                    <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>Nome *</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                                        style={{ background: '#18181b', border: `1px solid #27272a` }}
                                        placeholder="Il tuo nome completo"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>Email</label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                                        style={{ background: '#18181b', border: `1px solid #27272a` }}
                                        placeholder="la-tua@email.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-1.5" style={{ color: '#a1a1aa' }}>Telefono</label>
                                    <input
                                        type="tel"
                                        className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                                        style={{ background: '#18181b', border: `1px solid #27272a` }}
                                        placeholder="+39 xxx xxx xxxx"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                    />
                                </div>

                                {error && (
                                    <div className="p-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || !name}
                                    className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all"
                                    style={{
                                        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                                        boxShadow: `0 0 30px ${accentColor}30`,
                                        opacity: loading ? 0.7 : 1,
                                    }}
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            {ctaText}
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>

                                <p className="text-center text-xs" style={{ color: '#52525b' }}>
                                    🔒 I tuoi dati sono al sicuro. Non li condivideremo mai.
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* Meta Pixel Script — PageView is fired manually with eventID for CAPI deduplication */}
            {funnel.meta_pixel_id && (
                <script
                    dangerouslySetInnerHTML={{
                        __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${funnel.meta_pixel_id}',{});`,
                    }}
                />
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                input:focus { border-color: ${accentColor} !important; box-shadow: 0 0 0 3px ${accentColor}20; }
                button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 0 40px ${accentColor}40 !important; }
            `}</style>
        </div>
    )
}
