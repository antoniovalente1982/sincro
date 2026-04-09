'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'

export default function ConfirmPage() {
    const [status, setStatus] = useState<'loading' | 'error'>('loading')
    const [errorMsg, setErrorMsg] = useState('')
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    useEffect(() => {
        const verify = async () => {
            const token_hash = searchParams.get('token_hash')
            const type = searchParams.get('type') as any

            if (!token_hash || !type) {
                setStatus('error')
                setErrorMsg('Link di invito non valido.')
                return
            }

            // Verifica il token lato CLIENT — così la sessione viene salvata nel browser
            const { error } = await supabase.auth.verifyOtp({ token_hash, type })

            if (error) {
                console.error('OTP verify error:', error.message)
                setStatus('error')
                setErrorMsg('Il link di invito è scaduto o non valido. Chiedi un nuovo invito.')
                return
            }

            // Sessione creata! Redirect a set-password per inviti, dashboard per altri
            if (type === 'invite') {
                router.push('/set-password')
            } else {
                router.push('/dashboard')
            }
        }

        verify()
    }, [])

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #09090b 60%)' }}>
                <div className="w-full max-w-md text-center space-y-6">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <Image src="/logo.png" alt="ADPILOTIK" width={48} height={48} className="rounded-2xl" />
                        <span className="text-2xl font-bold text-white tracking-tight">ADPILOTIK</span>
                    </div>
                    <div className="glass-card p-8 space-y-4">
                        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h2 className="text-xl font-bold text-white">Link non valido</h2>
                        <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>{errorMsg}</p>
                        <button onClick={() => router.push('/login')} className="btn-primary w-full mt-4">
                            Vai al Login
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #09090b 60%)' }}>
            <div className="text-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: '#a78bfa' }} />
                <p className="text-white font-medium">Verifica in corso...</p>
                <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>Stai per essere reindirizzato</p>
            </div>
        </div>
    )
}
