'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { LogIn, Eye, EyeOff, Mail, ArrowLeft, Check } from 'lucide-react'

function LoginContent() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showForgotPassword, setShowForgotPassword] = useState(false)
    const [resetEmail, setResetEmail] = useState('')
    const [resetSent, setResetSent] = useState(false)
    const [resetLoading, setResetLoading] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    // Show contextual error messages from query params
    useEffect(() => {
        const errorParam = searchParams.get('error')
        if (errorParam === 'deactivated') {
            setError('⛔ Il tuo account è stato disattivato. Contatta il responsabile del team.')
        } else if (errorParam === 'session_expired') {
            setError('⏱️ Sessione scaduta. Effettua il login per continuare.')
        }
    }, [searchParams])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            if (error.message === 'Invalid login credentials') {
                setError('Email o password non corretti')
            } else if (error.message.includes('Email not confirmed')) {
                setError('Email non confermata. Controlla la tua casella di posta.')
            } else {
                setError(error.message)
            }
            setLoading(false)
        } else {
            router.push('/dashboard')
            router.refresh()
        }
    }

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setResetLoading(true)
        setError('')

        const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
            redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=/set-password`,
        })

        if (error) {
            setError(error.message)
        } else {
            setResetSent(true)
        }
        setResetLoading(false)
    }

    return (
        <div className="w-full max-w-md animate-fade-in relative z-10">
            {/* Logo */}
            <div className="text-center mb-10">
                <div className="inline-flex items-center gap-3 mb-4">
                    <Image src="/logo.png" alt="ADPILOTIK" width={48} height={48} className="rounded-2xl glow-sincro" />
                    <span className="text-2xl font-bold text-white tracking-tight">ADPILOTIK</span>
                </div>
                <p className="text-xs tracking-widest uppercase font-medium" style={{ color: 'var(--color-sincro-400)' }}>
                    Your ads. Smarter. Faster. Automatic.
                </p>
            </div>

            {showForgotPassword ? (
                // ── Forgot Password Form ──
                <div className="glass-card p-8 space-y-5">
                    {resetSent ? (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.15)', border: '2px solid rgba(34, 197, 94, 0.3)' }}>
                                <Check className="w-8 h-8" style={{ color: '#22c55e' }} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Email inviata!</h2>
                            <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>
                                Abbiamo inviato un link di reset a <strong className="text-white">{resetEmail}</strong>.
                                Controlla la tua casella di posta (anche lo spam).
                            </p>
                            <button
                                onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetEmail('') }}
                                className="btn-secondary w-full mt-4"
                            >
                                <ArrowLeft className="w-4 h-4" /> Torna al Login
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleForgotPassword} className="space-y-5">
                            <div className="text-center mb-2">
                                <h2 className="text-xl font-bold text-white">Password dimenticata?</h2>
                                <p className="text-sm mt-2" style={{ color: 'var(--color-surface-400)' }}>
                                    Inserisci la tua email e ti invieremo un link per reimpostare la password.
                                </p>
                            </div>

                            <div>
                                <label className="label">Email</label>
                                <input
                                    type="email"
                                    className="input"
                                    placeholder="la-tua@email.com"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    required
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl text-sm font-medium animate-fade-in" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                    {error}
                                </div>
                            )}

                            <button type="submit" className="btn-primary w-full" disabled={resetLoading}>
                                {resetLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Mail className="w-4 h-4" />
                                        Invia link di reset
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setShowForgotPassword(false); setError('') }}
                                className="w-full text-center text-sm font-medium transition-colors hover:text-white"
                                style={{ color: 'var(--color-surface-500)' }}
                            >
                                ← Torna al Login
                            </button>
                        </form>
                    )}
                </div>
            ) : (
                // ── Login Form ──
                <form onSubmit={handleLogin} className="glass-card p-8 space-y-5">
                    <div>
                        <label className="label">Email</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="la-tua@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="input pr-12"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/5 transition-colors"
                                style={{ color: 'var(--color-surface-500)' }}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl text-sm font-medium animate-fade-in" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" className="btn-primary w-full" disabled={loading}>
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <LogIn className="w-4 h-4" />
                                Accedi
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => { setShowForgotPassword(true); setError('') }}
                        className="w-full text-center text-sm font-medium transition-colors hover:text-white"
                        style={{ color: 'var(--color-surface-500)' }}
                    >
                        Password dimenticata?
                    </button>
                </form>
            )}

            <p className="text-center mt-6 text-sm" style={{ color: 'var(--color-surface-600)' }}>
                Accesso riservato ai membri del team.
            </p>
        </div>
    )
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #09090b 60%)' }}>
            {/* Background glow */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-[120px]" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }} />

            <Suspense fallback={
                <div className="text-center">
                    <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto" />
                </div>
            }>
                <LoginContent />
            </Suspense>
        </div>
    )
}
