'use client'

import { useState, useRef, useEffect } from 'react'
import { Brain, Send, Loader2, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  extractedKnowledge?: string
}

export default function AgentTerminal() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: 'Comandante. 🧠 Sono **Dante**, il tuo AI Engine.\n\nQui siamo nel centro operativo. Chiedimi analisi, status del budget, logica di escalazione o di testare i webhook Telegram. Sono in ascolto.',
    timestamp: new Date(),
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
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
        content: '⚠️ Errore di connessione. Riprova.',
        timestamp: new Date(),
      }])
    }

    setLoading(false)
  }

  const getToken = () => {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return ''
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}')
      return data.access_token || ''
    } catch {
      return ''
    }
  }

  const formatMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div className="flex flex-col h-full w-full" style={{
      background: 'rgba(15, 15, 46, 0.4)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      position: 'relative'
    }}>
      {/* HUD Header */}
      <div className="px-6 py-4 flex items-center justify-between" style={{
        background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.1), transparent)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.3)]" style={{
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
          }}>
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">DANTE TERMINAL</h2>
            <div className="flex items-center gap-2 text-xs text-[#a855f7] font-mono tracking-wider">
              <span className="w-2 h-2 rounded-full animate-pulse bg-[#10b981]" style={{ boxShadow: '0 0 10px #10b981' }} />
              SYSTEM ONLINE
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--color-surface-300) transparent',
      }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-6 py-4 transition-all hover:scale-[1.01]`} style={{
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.9), rgba(99, 102, 241, 0.9))'
                : 'rgba(30,30,60,0.5)',
              border: msg.role === 'user' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(168, 85, 247, 0.2)',
              boxShadow: msg.role === 'user' ? '0 10px 30px rgba(168,85,247,0.2)' : 'none',
              borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
              borderBottomLeftRadius: msg.role === 'user' ? '16px' : '4px',
            }}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-3 border-b border-[#a855f7] border-opacity-20 pb-2">
                  <Sparkles className="w-4 h-4 text-[#a855f7]" />
                  <span className="text-xs font-mono font-bold tracking-widest text-[#a855f7] uppercase">Dante</span>
                </div>
              )}
              
              <div
                className="text-[15px] leading-relaxed text-white font-light"
                dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
              />
              
              {msg.extractedKnowledge && (
                <div className="mt-4 p-4 rounded-xl flex items-start gap-3 backdrop-blur-sm" style={{
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  boxShadow: 'inset 0 0 20px rgba(168,85,247,0.05)'
                }}>
                  <div className="shrink-0 mt-0.5 text-lg">📝</div>
                  <div>
                    <div className="text-[11px] font-mono font-bold uppercase tracking-widest mb-1 text-[#a855f7]">
                      Knowledge Captured
                    </div>
                    <div className="text-[13px] font-medium text-indigo-100">
                      "{msg.extractedKnowledge}"
                    </div>
                  </div>
                </div>
              )}

              <div className="text-[10px] font-mono mt-3 opacity-50 text-right">
                {msg.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm px-6 py-4" style={{
              background: 'rgba(30,30,60,0.5)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
            }}>
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-[#a855f7]" />
                <span className="text-sm font-mono text-[#a855f7] tracking-wider animate-pulse">
                  PROCESSING COMMAND...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6" style={{
        background: 'linear-gradient(0deg, rgba(10,10,26,0.95), transparent)'
      }}>
        <div className="flex items-center gap-3 rounded-2xl px-5 py-3 backdrop-blur-md transition-all focus-within:shadow-[0_0_30px_rgba(168,85,247,0.2)]" style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
        }}>
          <span className="text-[#a855f7] font-mono text-lg">{`>`}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Inserisci un comando o fai una domanda a Dante..."
            className="flex-1 bg-transparent outline-none text-[15px] font-light text-white placeholder-indigo-300/30"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 hover:scale-105 active:scale-95"
            style={{
              background: input.trim() ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'rgba(255,255,255,0.05)',
              boxShadow: input.trim() ? '0 0 20px rgba(168,85,247,0.4)' : 'none'
            }}
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Quick Commands */}
        {messages.length <= 2 && (
          <div className="mt-4 flex gap-3 flex-wrap justify-center">
            {['/status budget', '/analyze kpi', '/force learning'].map(cmd => (
              <button
                key={cmd}
                onClick={() => setInput(cmd)}
                className="text-[11px] px-4 py-2 font-mono tracking-wider rounded-lg transition-all hover:bg-white/10 hover:scale-105"
                style={{
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  color: '#e0e7ff',
                }}
              >
                {cmd}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
