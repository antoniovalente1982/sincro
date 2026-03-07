'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { LogIn, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setError(error.message === 'Invalid login credentials'
                ? 'Email o password non corretti'
                : error.message)
            setLoading(false)
        } else {
            router.push('/dashboard')
            router.refresh()
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #09090b 60%)' }}>
            {/* Background glow */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-[120px]" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }} />

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

                {/* Form */}
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
                </form>

                <p className="text-center mt-6 text-sm" style={{ color: 'var(--color-surface-600)' }}>
                    Non hai un account?{' '}
                    <Link href="/register" className="font-semibold hover:underline" style={{ color: 'var(--color-sincro-400)' }}>
                        Registrati
                    </Link>
                </p>
            </div>
        </div>
    )
}
