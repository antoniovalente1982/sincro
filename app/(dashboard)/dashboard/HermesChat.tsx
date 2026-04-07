'use client'

import { useState, useRef, useEffect } from 'react'
import { Brain, Send, Loader2, X, MessageSquare, Sparkles, Minimize2 } from 'lucide-react'

interface Message {
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    extractedKnowledge?: string
}

export default function HermesChat() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Load history from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('hermes_chat_history')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                // convert string dates back to Date objects
                setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })))
            } catch (e) {
                console.error("Failed to parse chat history", e)
            }
        } else {
            setMessages([{
                role: 'assistant',
                content: 'Ciao Anto! 🧠 Sono **Hermes**, il tuo AI Engine. Ho accesso a tutti i dati: campagne ADS, KPI aziendali, lead e appuntamenti.\n\nChiedimi quello che vuoi — analisi, consigli, strategie. Sono qui per te!',
                timestamp: new Date(),
            }])
        }
    }, [])

    // Save history to localStorage on change
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('hermes_chat_history', JSON.stringify(messages))
        }
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (isOpen) inputRef.current?.focus()
    }, [isOpen])

    const sendMessage = async (overrideInput?: string | React.MouseEvent | React.KeyboardEvent) => {
        const msgText = typeof overrideInput === 'string' ? overrideInput : input.trim()
        if (!msgText || loading) return
        
        const userMsg: Message = { role: 'user', content: msgText, timestamp: new Date() }
        setMessages(prev => [...prev, userMsg])
        if (typeof overrideInput !== 'string') setInput('')
        setLoading(true)

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMsg.content,
                    history: messages.slice(-5).map(m => ({ role: m.role, content: m.content }))
                })
            })

            const data = await res.json()

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.reply || 'Errore nella risposta.',
                timestamp: new Date(),
                extractedKnowledge: data.extractedKnowledge,
            }])
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '⚠️ Errore di connessione. Riprova.',
                timestamp: new Date(),
            }])
        }

        setLoading(false)
    }

    const formatMessage = (text: string) => {
        // Convert **bold** to <strong>, *italic* to <em>
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br/>')
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
                style={{
                    background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                    boxShadow: '0 8px 32px rgba(168, 85, 247, 0.4)',
                }}
            >
                <Brain className="w-7 h-7 text-white" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-[var(--color-surface-50)]" />
            </button>
        )
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col" style={{
            width: '420px',
            height: '600px',
            maxHeight: 'calc(100vh - 100px)',
            background: 'var(--color-surface-50)',
            border: '1px solid var(--color-surface-200)',
            borderRadius: '20px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(99, 102, 241, 0.1))',
                borderBottom: '1px solid var(--color-surface-200)',
            }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                        background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                    }}>
                        <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                            Hermes
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--color-surface-500)' }}>
                            AI Engine • Online
                        </div>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl transition-colors hover:bg-white/5"
                >
                    <Minimize2 className="w-4 h-4" style={{ color: 'var(--color-surface-500)' }} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--color-surface-300) transparent',
            }}>
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                            msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                        }`} style={{
                            background: msg.role === 'user'
                                ? 'linear-gradient(135deg, #a855f7, #6366f1)'
                                : 'var(--color-surface-100)',
                            border: msg.role === 'user' ? 'none' : '1px solid var(--color-surface-200)',
                        }}>
                            {msg.role === 'assistant' && (
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Sparkles className="w-3 h-3" style={{ color: '#a855f7' }} />
                                    <span className="text-[10px] font-bold" style={{ color: '#a855f7' }}>Hermes</span>
                                </div>
                            )}
                            <div
                                className="text-[13px] leading-relaxed"
                                style={{ color: msg.role === 'user' ? '#fff' : 'var(--color-surface-700)' }}
                                dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                            />
                            
                            {msg.extractedKnowledge && (
                                <div className="mt-3 p-2.5 rounded-lg flex items-start gap-2" style={{
                                    background: 'rgba(168, 85, 247, 0.08)',
                                    border: '1px solid rgba(168, 85, 247, 0.2)',
                                }}>
                                    <div className="shrink-0 mt-0.5" style={{ fontSize: '12px' }}>📝</div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#a855f7' }}>
                                            Nuova Regola Memorizzata
                                        </div>
                                        <div className="text-[11px] font-medium" style={{ color: 'var(--color-surface-800)' }}>
                                            "{msg.extractedKnowledge}"
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="text-[9px] mt-1.5 text-right" style={{
                                color: msg.role === 'user' ? 'rgba(255,255,255,0.5)' : 'var(--color-surface-500)',
                            }}>
                                {msg.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{
                            background: 'var(--color-surface-100)',
                            border: '1px solid var(--color-surface-200)',
                        }}>
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#a855f7' }} />
                                <span className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                                    Hermes sta analizzando...
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            {messages.length <= 2 && (
                <div className="px-4 pb-2 flex gap-2 flex-wrap">
                    {['Come vanno le ADS?', 'Le tue regole 📜', 'Stato lead oggi'].map(q => (
                        <button
                            key={q}
                            onClick={() => {
                                const val = q === 'Le tue regole 📜' ? '/export' : q;
                                setInput(val);
                                setTimeout(() => sendMessage(val), 10);
                            }}
                            className="text-[10px] px-3 py-1.5 rounded-full transition-colors hover:bg-white/5"
                            style={{
                                background: 'rgba(168, 85, 247, 0.08)',
                                border: '1px solid rgba(168, 85, 247, 0.2)',
                                color: '#a855f7',
                            }}
                        >
                            {q}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="px-4 pb-4 pt-2">
                <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5" style={{
                    background: 'var(--color-surface-100)',
                    border: '1px solid var(--color-surface-200)',
                }}>
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage(e)}
                        placeholder="Scrivi a Hermes..."
                        className="flex-1 bg-transparent outline-none text-sm text-white placeholder-[var(--color-surface-500)]"
                        disabled={loading}
                    />
                    <button
                        onClick={e => sendMessage(e)}
                        disabled={!input.trim() || loading}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                        style={{
                            background: input.trim() ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'var(--color-surface-200)',
                        }}
                    >
                        <Send className="w-4 h-4 text-white" />
                    </button>
                </div>
            </div>
        </div>
    )
}
