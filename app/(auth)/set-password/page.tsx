'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Lock, Eye, EyeOff, Check } from 'lucide-react'

export default function SetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (password.length < 6) {
            setError('La password deve essere di almeno 6 caratteri')
            return
        }

        if (password !== confirmPassword) {
            setError('Le password non corrispondono')
            return
        }

        setLoading(true)

        const { error } = await supabase.auth.updateUser({ password })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            // Mark the team invite as accepted (updates joined_at, cleans up auto-created orgs)
            try {
                await fetch('/api/team/join', { method: 'POST' })
            } catch (e) {
                console.warn('Team join call failed (non-blocking):', e)
            }

            setSuccess(true)
            setTimeout(() => {
                router.push('/dashboard')
                router.refresh()
            }, 1500)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #09090b 60%)' }}>
            {/* Background glow */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-[120px]" style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)' }} />

            <div className="w-full max-w-md animate-fade-in relative z-10">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <Image src="/logo.png" alt="ADPILOTIK" width={48} height={48} className="rounded-2xl glow-sincro" />
                        <span className="text-2xl font-bold text-white tracking-tight">ADPILOTIK</span>
                    </div>
                    <p className="text-xs tracking-widest uppercase font-medium" style={{ color: '#a78bfa' }}>
                        Benvenuto nel team!
                    </p>
                </div>

                {success ? (
                    <div className="glass-card p-8 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.15)', border: '2px solid rgba(34, 197, 94, 0.3)' }}>
                            <Check className="w-8 h-8" style={{ color: '#22c55e' }} />
                        </div>
                        <h2 className="text-xl font-bold text-white">Password impostata!</h2>
                        <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>Stai per essere reindirizzato alla dashboard...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
                        <div className="text-center mb-2">
                            <h2 className="text-xl font-bold text-white">Imposta la tua password</h2>
                            <p className="text-sm mt-2" style={{ color: 'var(--color-surface-400)' }}>
                                Crea una password per accedere al tuo account
                            </p>
                        </div>

                        <div>
                            <label className="label">Nuova Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="input pr-12"
                                    placeholder="Minimo 6 caratteri"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
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

                        <div>
                            <label className="label">Conferma Password</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="input"
                                placeholder="Ripeti la password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
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
                                    <Lock className="w-4 h-4" />
                                    Imposta Password e Accedi
                                </>
                            )}
                        </button>
                    </form>
                )}

                <p className="text-center mt-6 text-sm" style={{ color: 'var(--color-surface-600)' }}>
                    Il tuo account è stato creato. Imposta una password per continuare.
                </p>
            </div>
        </div>
    )
}
