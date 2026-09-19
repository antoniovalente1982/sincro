'use client'

import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import type { LeadEditorialJourney as Journey } from '@/lib/editorial-report'

export default function LeadEditorialJourney({ leadId }: { leadId: string }) {
    const [attempt, setAttempt] = useState(0)
    const [response, setResponse] = useState<{ key: string; journey?: Journey; error?: string } | null>(null)
    const key = `${leadId}:${attempt}`
    useEffect(() => {
        const controller = new AbortController()
        fetch(`/api/leads/${encodeURIComponent(leadId)}/editorial-journey`, { signal: controller.signal, cache: 'no-store' }).then(async result => {
            const payload = await result.json()
            if (!result.ok) throw new Error(payload.error || 'Cronologia non disponibile.')
            if (!controller.signal.aborted) setResponse({ key, journey: payload })
        }).catch(error => {
            if (!controller.signal.aborted) setResponse({ key, error: error instanceof Error ? error.message : 'Cronologia non disponibile.' })
        })
        return () => controller.abort()
    }, [key, leadId])
    const current = response?.key === key ? response : null
    const journey = current?.journey
    return <section className="mb-5 p-4 rounded-xl" style={{ background: 'var(--color-surface-100)', border: '1px solid var(--color-surface-200)' }} aria-label="Percorso editoriale del contatto">
        <h3 className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold th-heading mb-3"><BookOpen className="w-4 h-4" /> Percorso editoriale</h3>
        {!current ? <p className="text-xs th-sub" role="status">Caricamento del percorso…</p> : current.error ? <div role="alert"><p className="text-xs th-sub mb-2">{current.error}</p><button className="text-xs underline th-heading" onClick={() => setAttempt(value => value + 1)}>Riprova</button></div> : journey && (journey.events.length ? <>
            <p className="text-xs th-sub mb-4">{journey.requests} {journey.requests === 1 ? 'richiesta collegata' : 'richieste collegate'}. {journey.observed ? 'Visite osservate nei 30 giorni prima di ciascuna richiesta.' : 'Visita iniziale non osservata: è disponibile soltanto il percorso registrato.'}</p>
            <ol className="space-y-4 border-l pl-4" style={{ borderColor: 'var(--color-surface-300)' }}>{journey.events.map(event => <li key={event.id} className="text-xs">
                <time dateTime={event.occurredAt} className="block th-sub mb-1">{new Date(event.occurredAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' })}</time>
                <strong className="block th-heading mb-1">{event.label}</strong>
                {event.article && <a className="block underline th-heading mb-1 break-words" href={event.article.href} target="_blank" rel="noopener noreferrer">{event.article.title} ↗</a>}
                <span className="block th-sub break-all">{event.pagePath}</span>
                {(event.source || event.campaign) && <span className="block th-sub mt-1 break-words">{event.source && `Fonte: ${event.source}${event.medium ? ` / ${event.medium}` : ''}`}{event.source && event.campaign ? ' · ' : ''}{event.campaign && `Campagna: ${event.campaign}`}</span>}
            </li>)}</ol>
            <p className="text-[11px] th-sub mt-4 leading-relaxed">Il collegamento delle visite avviene tramite browser e può essere incompleto o condiviso. Non identifica con certezza chi ha letto. Le date sono nel fuso italiano.</p>
        </> : <p className="text-xs th-sub leading-relaxed">Nessun percorso editoriale collegato. Le richieste precedenti all’attivazione della misurazione non sono ricostruibili; senza consenso possono mancare le visite.</p>)}
    </section>
}
