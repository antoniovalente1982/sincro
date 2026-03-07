'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { UserPlus, Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
    const [fullName, setFullName] = useState('')
    const [organizationName, setOrganizationName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        if (password.length < 6) {
            setError('La password deve avere almeno 6 caratteri')
            setLoading(false)
            return
        }

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    organization_name: organizationName || `${fullName}'s Team`,
                },
            },
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            setSuccess(true)
        }
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #09090b 60%)' }}>
                <div className="w-full max-w-md animate-fade-in">
                    <div className="glass-card p-8 text-center">
                        <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '2px solid rgba(34, 197, 94, 0.3)' }}>
                            <svg className="w-8 h-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Registrazione completata!</h2>
                        <p className="text-sm mb-6" style={{ color: 'var(--color-surface-600)' }}>
                            Controlla la tua email per confermare l'account, poi accedi alla dashboard.
                        </p>
                        <Link href="/login" className="btn-primary inline-flex">
                            Vai al Login
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #09090b 60%)' }}>
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-[120px]" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }} />

            <div className="w-full max-w-md animate-fade-in relative z-10">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <Image src="/logo.png" alt="ADPILOTIK" width={48} height={48} className="rounded-2xl glow-sincro" />
                        <span className="text-2xl font-bold text-white tracking-tight">ADPILOTIK</span>
                    </div>
                    <p className="text-xs tracking-widest uppercase font-medium" style={{ color: 'var(--color-sincro-400)' }}>
                        Your ads. Smarter. Faster. Automatic.
                    </p>
                </div>

                <form onSubmit={handleRegister} className="glass-card p-8 space-y-5">
                    <div>
                        <label className="label">Nome completo</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Antonio Valente"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Nome organizzazione</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Metodo Sincro"
                            value={organizationName}
                            onChange={(e) => setOrganizationName(e.target.value)}
                        />
                    </div>

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
                                placeholder="Minimo 6 caratteri"
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
                                <UserPlus className="w-4 h-4" />
                                Registrati
                            </>
                        )}
                    </button>
                </form>

                <p className="text-center mt-6 text-sm" style={{ color: 'var(--color-surface-600)' }}>
                    Hai già un account?{' '}
                    <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--color-sincro-400)' }}>
                        Accedi
                    </Link>
                </p>
            </div>
        </div>
    )
}
