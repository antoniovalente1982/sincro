'use client'

import { useState, useRef, useEffect } from 'react'
import { Brain, Send, Loader2, Sparkles, Cpu } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  extractedKnowledge?: string
}

interface Props {
  llmModel: string
}

export default function ChatTab({ llmModel }: Props) {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: 'Comandante. 🧠 Sono **Hermes**, il tuo AI Engine.\n\nChiedimi analisi, status del budget, logica di escalazione, o qualsiasi cosa sulle campagne. Sono in ascolto.',
    timestamp: new Date(),
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => { inputRef.current?.focus() }, [])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
        }),
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
        content: '⚠️ Errore di comunicazione con il sistema. Riprova.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  const formatMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
  }

  const modelShort = (llmModel || 'gemini-2.5-flash').split('/').pop()

  const quickCommands = [
    '/status budget', '/analyze kpi', '/brief settimanale', '/force learning', '/export regole'
  ]

  return (
    <div className="glass-card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
      {/* Chat header */}
      <div className="px-5 py-3 flex items-center justify-between" style={{
        background: 'linear-gradient(90deg, rgba(168,85,247,0.08), transparent)',
        borderBottom: '1px solid var(--color-surface-200)',
      }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
          }}>
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white">Hermes AI Terminal</span>
            <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: 'var(--color-surface-500)' }}>
              <Cpu className="w-3 h-3" />
              {modelShort}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{ boxShadow: '0 0 8px #10b981' }} />
          <span className="text-[10px] font-mono text-emerald-400">ONLINE</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4" style={{ scrollbarWidth: 'thin' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5`} style={{
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, rgba(168,85,247,0.85), rgba(99,102,241,0.85))'
                : 'var(--color-surface-100)',
              border: msg.role === 'user'
                ? '1px solid rgba(255,255,255,0.1)'
                : '1px solid var(--color-surface-200)',
              borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
              borderBottomLeftRadius: msg.role === 'user' ? '16px' : '4px',
            }}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-2 pb-1.5" style={{ borderBottom: '1px solid var(--color-surface-200)' }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: '#a855f7' }} />
                  <span className="text-[10px] font-mono font-bold tracking-widest" style={{ color: '#a855f7' }}>HERMES</span>
                </div>
              )}
              <div
                className="text-sm leading-relaxed text-white"
                dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
              />
              {msg.extractedKnowledge && (
                <div className="mt-3 p-3 rounded-xl flex items-start gap-2" style={{
                  background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)'
                }}>
                  <span className="text-sm">📝</span>
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase mb-0.5" style={{ color: '#a855f7' }}>Knowledge Captured</div>
                    <div className="text-xs" style={{ color: '#c4b5fd' }}>"{msg.extractedKnowledge}"</div>
                  </div>
                </div>
              )}
              <div className="text-[9px] font-mono mt-2 text-right" style={{ color: 'var(--color-surface-600)' }}>
                {msg.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm px-5 py-3.5" style={{
              background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)',
            }}>
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#a855f7' }} />
                <span className="text-xs font-mono animate-pulse" style={{ color: '#a855f7' }}>THINKING...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Commands */}
      {messages.length <= 2 && (
        <div className="px-5 pb-2 flex gap-2 flex-wrap">
          {quickCommands.map(cmd => (
            <button key={cmd} onClick={() => setInput(cmd)}
              className="text-[10px] px-3 py-1.5 font-mono rounded-lg transition-all hover:scale-105"
              style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#c4b5fd' }}>
              {cmd}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4" style={{ borderTop: '1px solid var(--color-surface-200)' }}>
        <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all focus-within:shadow-[0_0_20px_rgba(168,85,247,0.12)]"
          style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-300)' }}>
          <span className="font-mono text-sm" style={{ color: '#a855f7' }}>{'>'}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Chiedi a Hermes..."
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500"
            disabled={loading}
          />
          <button onClick={sendMessage} disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-20"
            style={{
              background: input.trim() ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'transparent',
            }}>
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
