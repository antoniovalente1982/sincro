'use client'

import { useEffect, useMemo, useState } from 'react'
import { editorialReportWindow, type EditorialArticle, type EditorialReport } from '@/lib/editorial-report'
import styles from './blog-results.module.css'

const number = (value: number) => value.toLocaleString('it-IT')
const rate = (numerator: number, denominator: number) => denominator ? `${(numerator / denominator * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%` : '—'

export default function BlogResults({ articles, demo = false }: { articles: EditorialArticle[]; demo?: boolean }) {
    const [dates] = useState(() => editorialReportWindow())
    const [from, setFrom] = useState(dates.from)
    const [to, setTo] = useState(dates.to)
    const [article, setArticle] = useState('')
    const [filters, setFilters] = useState({ from: dates.from, to: dates.to, article: '' })
    const [attempt, setAttempt] = useState(0)
    const [response, setResponse] = useState<{ key: string; report?: EditorialReport; error?: string } | null>(null)
    const url = `/api/blog/results?${new URLSearchParams(filters)}`
    const requestKey = `${url}:${attempt}`
    useEffect(() => {
        if (demo) return
        const controller = new AbortController()
        fetch(url, { signal: controller.signal, cache: 'no-store' }).then(async result => {
            const payload = await result.json()
            if (!result.ok) throw new Error(payload.error || 'Report non disponibile. Riprova.')
            if (!controller.signal.aborted) setResponse({ key: requestKey, report: payload })
        }).catch(error => {
            if (!controller.signal.aborted) setResponse({ key: requestKey, error: error instanceof Error ? error.message : 'Report non disponibile. Riprova.' })
        })
        return () => controller.abort()
    }, [demo, requestKey, url])
    const current = response?.key === requestKey ? response : null
    const report = current?.report
    const options = useMemo(() => [...new Map([...articles, ...(report?.rows || [])].map(item => [item.entryKey, item])).values()], [articles, report])
    const totals = report?.totals
    return <section className={styles.results} aria-label="Risultati degli advertorial">
        <div className={styles.intro}><h2>Dall’advertorial alla richiesta</h2><p>Seleziona le date delle visite e segui cosa succede nei 30 giorni successivi alla prima visita del periodo, per ogni articolo.</p></div>
        <form className={styles.filters} onSubmit={event => { event.preventDefault(); setFilters({ from, to, article }); setAttempt(value => value + 1) }}>
            <label>Visite dal<input type="date" value={from} max={to} required onChange={event => setFrom(event.target.value)} /></label>
            <label>Al<input type="date" value={to} min={from} max={dates.to} required onChange={event => setTo(event.target.value)} /></label>
            <label className={styles.articleFilter}>Advertorial<select value={article} onChange={event => setArticle(event.target.value)}><option value="">Tutti gli advertorial</option>{options.map(item => <option key={item.entryKey} value={item.entryKey}>{item.title}</option>)}</select></label>
            <button type="submit" disabled={demo}>Applica filtri</button>
        </form>
        {demo ? <p className={styles.empty}>Nell’anteprima non sono disponibili dati reali. I risultati compariranno qui dopo le prime visite registrate.</p> : !current ? <p role="status" className={styles.empty}>Caricamento dei risultati…</p> : current.error ? <div role="alert" className={styles.error}><p>{current.error}</p><button onClick={() => setAttempt(value => value + 1)}>Riprova</button></div> : report && totals && <>
            <div className={styles.summary}>
                <div><strong>{number(totals.visitors)}</strong><span>Browser unici sugli advertorial</span><small>{number(totals.views)} visualizzazioni nel periodo</small></div>
                <div><strong>{number(totals.landingVisitors)}</strong><span>Browser arrivati sulla landing</span><small>{rate(totals.landingVisitors, totals.visitors)} dei visitatori osservati</small></div>
                <div><strong>{number(totals.requests)}</strong><span>Richieste con visita osservata</span><small>{number(totals.requestingVisitors)} browser · {rate(totals.requestingVisitors, totals.visitors)} dei visitatori</small></div>
                <div><strong>{number(totals.contacts)}</strong><span>Contatti CRM unici collegati</span><small>{totals.pendingRequests ? `${number(totals.pendingRequests)} richieste in attesa del collegamento` : 'Una persona può inviare più richieste'}</small></div>
            </div>
            {report.maturing && <p className={styles.notice}>Le visite più recenti sono ancora in osservazione: i risultati possono crescere fino a 30 giorni dalla visita.</p>}
            {totals.views === 0 && totals.unobservedRequests === 0 ? <div className={styles.empty}><h3>Nessun evento registrato con questi filtri.</h3><p>Le visite e le richieste inizieranno a comparire da quando la misurazione è attiva.</p></div> : <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Dettaglio risultati per advertorial">
                <table><caption>Risultati per advertorial · Le richieste possono arrivare nei 30 giorni successivi alle visite selezionate.</caption><thead><tr><th scope="col">Advertorial</th><th scope="col">Visualizzazioni</th><th scope="col">Browser unici</th><th scope="col">Coinvolgimento nell’articolo</th><th scope="col">Clic alla landing</th><th scope="col">Arrivi landing</th><th scope="col">Form iniziati</th><th scope="col">Richieste</th><th scope="col">Contatti CRM</th><th scope="col">Conversione</th><th scope="col">Sola provenienza</th></tr></thead>
                    <tbody>{report.rows.map(row => <tr key={row.entryKey}><th scope="row"><a href={row.href} target="_blank" rel="noopener noreferrer">{row.title} ↗</a></th><td>{number(row.metrics.views)}</td><td>{number(row.metrics.visitors)}</td><td>{number(row.metrics.engagedVisitors)}</td><td>{number(row.metrics.ctaVisitors)}</td><td>{number(row.metrics.landingVisitors)}</td><td>{number(row.metrics.formVisitors)}</td><td>{number(row.metrics.requests)}</td><td>{number(row.metrics.contacts)}</td><td>{rate(row.metrics.requestingVisitors, row.metrics.visitors)}</td><td>{number(row.metrics.unobservedRequests)}</td></tr>)}</tbody>
                </table>
            </div>}
            <div className={styles.explanation}>
                <p><strong>{number(totals.unobservedRequests)} richieste con sola provenienza nel periodo.</strong> La richiesta indica l’advertorial, ma manca una visita osservata compatibile nel gruppo selezionato. Queste richieste non entrano nel tasso di conversione.</p>
                <p>Visualizzazioni = aperture, anche ripetute. Gli altri passaggi contano browser unici, tranne richieste e contatti CRM. La conversione divide i browser che hanno inviato una richiesta per quelli che hanno visitato l’articolo. I totali deduplicano chi visita più articoli.</p>
                <p>La misurazione delle visite richiede il consenso: i browser non equivalgono a persone e il percorso può essere incompleto. Le richieste precedenti all’attivazione non sono ricostruibili. Date nel fuso italiano · massimo 90 giorni.</p>
                <p className={styles.updated}>Aggiornato al {new Date(report.window.now).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' })}.</p>
            </div>
        </>}
    </section>
}
