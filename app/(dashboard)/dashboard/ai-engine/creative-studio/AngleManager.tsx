'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link2, Plus, Edit2, Trash2, Loader2, Save, X, Info, ChevronDown } from 'lucide-react'

interface RoutingAngle {
  id: string
  trigger_keyword: string
  headline_white: string
  headline_gold: string
  subtitle: string
}

export default function AngleManager() {
  const [angles, setAngles] = useState<RoutingAngle[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<Partial<RoutingAngle>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const INITIAL_VISIBLE = 6

  const supabase = createClient()

  useEffect(() => {
    fetchAngles()
  }, [])

  const fetchAngles = async () => {
    setLoading(true)
    const { data } = await supabase.from('funnel_routing_engine').select('*').order('created_at', { ascending: false })
    if (data) setAngles(data)
    setLoading(false)
  }

  const handleEdit = (angle: RoutingAngle) => {
    setIsCreating(false)
    setEditingId(angle.id)
    setFormData(angle)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Sicuro di voler eliminare questo angolo e i suoi titoli dinamici?')) return
    await supabase.from('funnel_routing_engine').delete().eq('id', id)
    await fetchAngles()
  }

  const handleSave = async () => {
    if (!formData.trigger_keyword || !formData.headline_white || !formData.headline_gold || !formData.subtitle) {
      alert('Tutti i campi sono obbligatori')
      return
    }

    if (isCreating) {
      await supabase.from('funnel_routing_engine').insert([formData])
    } else if (editingId) {
      await supabase.from('funnel_routing_engine').update(formData).eq('id', editingId)
    }

    setEditingId(null)
    setIsCreating(false)
    setFormData({})
    await fetchAngles()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Link2 className="text-[#a855f7]" /> Funnel Routing Engine
          </h2>
          <p className="text-sm text-[var(--color-surface-400)] mt-1">
            Gestisci i titoli e i sottotitoli dinamici delle landing page in base alle keywords delle Ads
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className="flex items-center gap-2 px-3 py-2 bg-[rgba(59,130,246,0.1)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)] rounded-xl text-sm font-bold hover:bg-[rgba(59,130,246,0.2)] transition-all"
          >
            <Info size={16} /> Come Funziona
          </button>
          <button 
            onClick={() => { setIsCreating(true); setEditingId('new'); setFormData({}) }}
            className="flex items-center gap-2 px-4 py-2 bg-[#a855f7] text-white rounded-xl text-sm font-bold hover:bg-[#9333ea] transition-all"
          >
            <Plus size={16} /> Aggiungi Angolo
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="glass-card p-5 animate-fade-in" style={{ border: '1px solid rgba(59,130,246,0.3)' }}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[rgba(59,130,246,0.1)] flex items-center justify-center flex-shrink-0">
              <Info className="text-[#3b82f6]" />
            </div>
            <div>
              <h3 className="font-bold text-white mb-2 text-lg">Come Funziona il Funnel Routing Dinamico</h3>
              <p className="text-sm text-[var(--color-surface-400)] mb-4">
                Questo sistema cambia in tempo reale il titolo e il sottotitolo della landing page in base all'annuncio che l'utente ha cliccato su Facebook. Questo aumenta drasticamente i tassi di conversione.
              </p>
              
              <h4 className="font-bold text-white mb-2 text-sm">Cosa devi fare quando crei le Ads:</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-[#3b82f6] mt-0.5">•</span>
                  <div>
                    <strong className="text-white">1. Scegli una Trigger Keyword:</strong> Scegli o crea una parola chiave qui sotto (es. <code className="text-[#a855f7] bg-[rgba(168,85,247,0.1)] px-1 rounded">emotional</code>).
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#3b82f6] mt-0.5">•</span>
                  <div>
                    <strong className="text-white">2. Nominala su Meta Ads:</strong> Inserisci quella keyword nel NOME dell'inserzione su Facebook. Ad esempio: <em>"T: Emotional Video XYZ"</em>.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#3b82f6] mt-0.5">•</span>
                  <div>
                    <strong className="text-white">3. Setup Automatico:</strong> Finché il link dell'ad usa i parametri UTM standard previsti dal nostro Preflight (<code>utm_content=&#123;&#123;ad.name&#125;&#125;</code>), il sistema farà "match" con la tua keyword in automatico e mostrerà il titolo corretto.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {(isCreating || editingId) && (
        <div className="glass-card p-6" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">{isCreating ? 'Nuovo Angolo di Routing' : 'Modifica Angolo'}</h3>
            <button onClick={() => { setIsCreating(false); setEditingId(null) }} className="text-[var(--color-surface-400)] hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-surface-400)] mb-1">Trigger Keyword (URL UTM)</label>
              <input 
                type="text" 
                className="w-full bg-[var(--color-surface-100)] border border-[var(--color-surface-200)] rounded-lg px-3 py-2 text-white"
                placeholder="es. emotional, system, efficiency"
                value={formData.trigger_keyword || ''}
                onChange={e => setFormData({...formData, trigger_keyword: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--color-surface-400)] mb-1">Titolo (Testo Bianco)</label>
              <input 
                type="text" 
                className="w-full bg-[var(--color-surface-100)] border border-[var(--color-surface-200)] rounded-lg px-3 py-2 text-white"
                placeholder="es. Lo Vedi Anche Tu, Vero?"
                value={formData.headline_white || ''}
                onChange={e => setFormData({...formData, headline_white: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#facc15] mb-1">Titolo (Testo Giallo/Oro)</label>
              <input 
                type="text" 
                className="w-full bg-[var(--color-surface-100)] border border-[var(--color-surface-200)] rounded-lg px-3 py-2 text-white"
                placeholder="es. In Allenamento È Un Altro. In Partita Si Spegne."
                value={formData.headline_gold || ''}
                onChange={e => setFormData({...formData, headline_gold: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--color-surface-400)] mb-1">Sottotitolo</label>
              <textarea 
                rows={3}
                className="w-full bg-[var(--color-surface-100)] border border-[var(--color-surface-200)] rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Inserisci il sottotitolo persuasivo..."
                value={formData.subtitle || ''}
                onChange={e => setFormData({...formData, subtitle: e.target.value})}
              />
            </div>
            <div className="pt-2">
              <button 
                onClick={handleSave}
                className="flex items-center justify-center w-full gap-2 px-4 py-3 bg-[#14b8a6] text-white rounded-xl text-sm font-bold hover:bg-[#0d9488] transition-all"
              >
                <Save size={16} /> Salva Configurazione
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && !angles.length ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[#a855f7]" /></div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(showAll ? angles : angles.slice(0, INITIAL_VISIBLE)).map(angle => (
            <div key={angle.id} className="glass-card p-5 hover:border-[rgba(168,85,247,0.3)] transition-all flex flex-col h-full">
              <div className="flex items-center justify-between mb-3 border-b border-[var(--color-surface-200)] pb-3">
                <span className="px-2 py-1 bg-[rgba(168,85,247,0.15)] text-[#c084fc] rounded text-xs font-bold font-mono border border-[rgba(168,85,247,0.3)]">
                  {angle.trigger_keyword}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(angle)} className="text-[var(--color-surface-400)] hover:text-[#c084fc]">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(angle.id)} className="text-[var(--color-surface-400)] hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-[15px] font-bold leading-tight" style={{ color: '#fff' }}>
                  {angle.headline_white} <span style={{ color: '#facc15' }}>{angle.headline_gold}</span>
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-surface-400)' }}>
                  {angle.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
        {angles.length > INITIAL_VISIBLE && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01]"
            style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-500)' }}
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Mostra altri {angles.length - INITIAL_VISIBLE} angoli
          </button>
        )}
        {showAll && angles.length > INITIAL_VISIBLE && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full mt-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01]"
            style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)', color: 'var(--color-surface-500)' }}
          >
            Comprimi lista
          </button>
        )}
        </>
      )}
    </div>
  )
}
