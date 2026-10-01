'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { pct, costPer, UNATTRIBUTED, type FunnelRow } from '@/lib/funnel-report'
import styles from './funnel-report.module.css'

interface Props {
    funnels: { slug: string; name: string }[]
    funnelSlug?: string
    funnelName?: string
    from?: string
    to?: string
    rows?: FunnelRow[]
    total?: FunnelRow
    error?: string
}

const eur = (v: number | null) => v === null ? '—' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: v < 100 ? 2 : 0 })
const n = (v: number) => v.toLocaleString('it-IT')
const p = (v: number | null) => v === null ? '—' : `${v.toLocaleString('it-IT', { maximumFractionDigits: v < 10 ? 1 : 0 })}%`

/** "#15 Diagnostic Buyers | … — Video | V01 R1 T: blocchi" → "V01 · blocchi" */
function shortName(row: FunnelRow) {
    if (row.key === UNATTRIBUTED) return 'Senza annuncio'
    const m = row.label.match(/\|\s*(V\d+)\s+R\d+\s+T:\s*(\S+)/)
    return m ? `${m[1]} · ${m[2]}` : row.label
}

const shift = (day: string, days: number) => {
    const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10)
}

export default function FunnelReport({ funnels, funnelSlug, funnelName, from, to, rows = [], total, error }: Props) {
    const router = useRouter()
    const [range, setRange] = useState({ from: from || '', to: to || '' })
    const go = (next: { funnel?: string; from?: string; to?: string }) => {
        const q = new URLSearchParams({ funnel: next.funnel ?? funnelSlug ?? '', from: next.from ?? range.from, to: next.to ?? range.to })
        router.push(`/dashboard/funnel-report?${q}`)
    }
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
    const presets = [
        { label: 'Oggi', from: today, to: today },
        { label: 'Ieri', from: shift(today, -1), to: shift(today, -1) },
        { label: '7 giorni', from: shift(today, -6), to: today },
        { label: '30 giorni', from: shift(today, -29), to: today },
    ]

    if (!total) {
        return <main className={styles.page}><h1 className={styles.title}>Report Funnel</h1><p className={styles.error}>{error}</p></main>
    }

    const t = total
    const tiles = [
        { label: 'Spesa', value: eur(t.spend), hint: 'Spesa Meta nel periodo' },
        { label: 'Lead nel CRM', value: n(t.leads), hint: `${n(t.metaLeads)} Lead ricevuti da Meta (solo con consenso)` },
        { label: 'Costo per lead', value: eur(costPer(t.spend, t.leads)), hint: 'Spesa / lead nel CRM' },
        { label: 'Appuntamenti', value: n(t.appointments), hint: `${p(pct(t.appointments, t.leads))} dei lead` },
        { label: 'Costo per appuntamento', value: eur(costPer(t.spend, t.appointments)), hint: 'Il numero su cui giudicare le campagne' },
        { label: 'Vendite', value: n(t.sales), hint: `Costo per vendita ${eur(costPer(t.spend, t.sales))}` },
    ]

    const adSteps = [
        { label: 'Impression', value: t.impressions, help: 'Volte in cui un video è stato mostrato' },
        { label: 'Visualizzazioni 3 secondi', value: t.videoViews3s, help: 'Hook rate: chi guarda almeno 3 secondi su impression' },
        { label: 'ThruPlay (15 s o fine)', value: t.thruplays, help: 'Hold rate: chi arriva a 15 secondi su chi ne ha guardati 3' },
        { label: 'Clic sul link', value: t.linkClicks, help: 'CTR link: clic su impression' },
    ]
    const siteSteps = [
        { label: 'Clic sul link', value: t.linkClicks, help: 'Da Meta' },
        { label: 'Visite alla pagina', value: t.visits, help: 'Caricamenti della pagina (anche senza consenso). Meno dei clic: chi chiude prima del caricamento non viene contato' },
        { label: 'Form iniziati', value: t.formStarts, help: 'Primo campo toccato (anche dal pulsante fisso su mobile)' },
        { label: 'Lead', value: t.leads, help: 'Richieste salvate nel CRM' },
        { label: 'Appuntamenti', value: t.appointments, help: 'Lead arrivati almeno ad Appuntamento (anche se poi persi)' },
        { label: 'Show-up', value: t.showUps, help: 'Si sono presentati alla chiamata' },
        { label: 'Vendite', value: t.sales, help: 'Arrivati a Vendita' },
    ]

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Report Funnel</h1>
                    <p className={styles.subtitle}>{funnelName} · dal {from} al {to}</p>
                </div>
                <div className={styles.filters}>
                    {funnels.length > 1 && (
                        <select className="input" value={funnelSlug} onChange={e => go({ funnel: e.target.value })} aria-label="Funnel">
                            {funnels.map(f => <option key={f.slug} value={f.slug}>{f.name}</option>)}
                        </select>
                    )}
                    <div className={styles.presets}>
                        {presets.map(pr => (
                            <button key={pr.label} type="button" className={styles.preset} aria-pressed={from === pr.from && to === pr.to} onClick={() => { setRange(pr); go(pr) }}>{pr.label}</button>
                        ))}
                    </div>
                    <label className={styles.date}>Dal <input type="date" className="input" value={range.from} max={range.to} onChange={e => setRange({ ...range, from: e.target.value })} /></label>
                    <label className={styles.date}>Al <input type="date" className="input" value={range.to} min={range.from} onChange={e => setRange({ ...range, to: e.target.value })} /></label>
                    <button type="button" className="btn-primary" onClick={() => go({})}>Aggiorna</button>
                </div>
            </header>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <section className={styles.tiles} aria-label="Numeri principali">
                {tiles.map(tile => (
                    <div key={tile.label} className={styles.tile}>
                        <span className={styles.tileLabel}>{tile.label}</span>
                        <strong className={styles.tileValue}>{tile.value}</strong>
                        <span className={styles.tileHint}>{tile.hint}</span>
                    </div>
                ))}
            </section>

            <div className={styles.funnels}>
                <Funnel title="Annuncio: attenzione e clic" steps={adSteps} />
                <Funnel title="Pagina e CRM: dal clic alla vendita" steps={siteSteps} />
            </div>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>Per video</h2>
                <p className={styles.cardNote}>Passa sopra a un valore per vedere come è calcolato. «—» vuol dire che manca il dato per calcolarlo, non zero.</p>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th scope="col">Video</th>
                                <th scope="col">Spesa</th>
                                <th scope="col">Impression</th>
                                <th scope="col" title="Visualizzazioni 3 s / impression">Hook rate</th>
                                <th scope="col" title="ThruPlay / visualizzazioni 3 s">Hold rate</th>
                                <th scope="col" title="Visualizzazioni al 25/50/75/95% su visualizzazioni 3 s">Visione 25 · 50 · 75 · 95%</th>
                                <th scope="col" title="Clic sul link / impression">CTR link</th>
                                <th scope="col">CPC</th>
                                <th scope="col" title="Visite / clic sul link">Clic → visita</th>
                                <th scope="col" title="Form iniziati / visite">Visita → form</th>
                                <th scope="col" title="Lead / form iniziati">Form → lead</th>
                                <th scope="col" title="Lead / clic sul link">Clic → lead</th>
                                <th scope="col">Lead CRM</th>
                                <th scope="col" title="Lead ricevuti da Meta: solo chi ha lasciato il consenso">Lead Meta</th>
                                <th scope="col">Costo per lead</th>
                                <th scope="col" title="Appuntamenti / lead">Lead → app.</th>
                                <th scope="col">Appuntamenti</th>
                                <th scope="col">Costo per app.</th>
                                <th scope="col" title="Show-up / appuntamenti">Show-up</th>
                                <th scope="col">Vendite</th>
                                <th scope="col">Costo per vendita</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...rows, t].map(r => {
                                const isTotal = r === t
                                return (
                                    <tr key={r.key} className={isTotal ? styles.totalRow : undefined}>
                                        <th scope="row" title={r.label}>{isTotal ? 'Totale' : shortName(r)}</th>
                                        <td>{eur(r.spend)}</td>
                                        <td>{n(r.impressions)}</td>
                                        <td title={`${n(r.videoViews3s)} / ${n(r.impressions)}`}>{p(pct(r.videoViews3s, r.impressions))}</td>
                                        <td title={`${n(r.thruplays)} / ${n(r.videoViews3s)}`}>{p(pct(r.thruplays, r.videoViews3s))}</td>
                                        <td title={`${n(r.p25)} · ${n(r.p50)} · ${n(r.p75)} · ${n(r.p95)} su ${n(r.videoViews3s)}`}>{[r.p25, r.p50, r.p75, r.p95].map(v => p(pct(v, r.videoViews3s))).join(' · ')}</td>
                                        <td title={`${n(r.linkClicks)} / ${n(r.impressions)}`}>{p(pct(r.linkClicks, r.impressions))}</td>
                                        <td>{eur(costPer(r.spend, r.linkClicks))}</td>
                                        <td title={`${n(r.visits)} / ${n(r.linkClicks)}`}>{p(pct(r.visits, r.linkClicks))}</td>
                                        <td title={`${n(r.formStarts)} / ${n(r.visits)}`}>{p(pct(r.formStarts, r.visits))}</td>
                                        <td title={`${n(r.leads)} / ${n(r.formStarts)}`}>{p(pct(r.leads, r.formStarts))}</td>
                                        <td title={`${n(r.leads)} / ${n(r.linkClicks)}`}>{p(pct(r.leads, r.linkClicks))}</td>
                                        <td>{n(r.leads)}</td>
                                        <td>{n(r.metaLeads)}</td>
                                        <td>{eur(costPer(r.spend, r.leads))}</td>
                                        <td title={`${n(r.appointments)} / ${n(r.leads)}`}>{p(pct(r.appointments, r.leads))}</td>
                                        <td>{n(r.appointments)}</td>
                                        <td>{eur(costPer(r.spend, r.appointments))}</td>
                                        <td title={`${n(r.showUps)} / ${n(r.appointments)}`}>{p(pct(r.showUps, r.appointments))}</td>
                                        <td>{n(r.sales)}</td>
                                        <td>{eur(costPer(r.spend, r.sales))}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>Come leggere i numeri</h2>
                <ul className={styles.notes}>
                    <li><strong>Hook rate</strong> (3 s / impression) dice se l’inizio del video ferma lo scorrimento; <strong>hold rate</strong> (ThruPlay / 3 s) se il video tiene. Con video da 70-80 s, il 25-50% è già una visione lunga.</li>
                    <li><strong>Lead CRM</strong> conta tutte le richieste; <strong>Lead Meta</strong> solo quelle con il consenso spuntato. La differenza è la parte che Meta non vede per ottimizzare.</li>
                    <li><strong>Senza annuncio</strong> raccoglie visite e lead senza nome dell’annuncio: traffico organico o richieste inviate senza consenso (in quel caso gli UTM non vengono salvati).</li>
                    <li>Le visite sono caricamenti della pagina, non persone: chi ricarica conta due volte. Appuntamenti, show-up e vendite seguono la pipeline del CRM e crescono nei giorni dopo il lead.</li>
                    <li>Giudica i video sul <strong>costo per appuntamento</strong>, con almeno qualche giorno di dati: pochi lead possono cambiare molto le percentuali.</li>
                </ul>
            </section>
        </main>
    )
}

function Funnel({ title, steps }: { title: string; steps: { label: string; value: number; help: string }[] }) {
    const max = Math.max(...steps.map(s => s.value), 1)
    return (
        <section className={styles.card}>
            <h2 className={styles.cardTitle}>{title}</h2>
            <ol className={styles.funnel}>
                {steps.map((s, i) => {
                    const prev = i > 0 ? steps[i - 1].value : null
                    const width = s.value > 0 ? Math.max((s.value / max) * 100, 1.5) : 0
                    return (
                        <li key={s.label} className={styles.step} title={s.help}>
                            <div className={styles.stepHead}>
                                <span className={styles.stepLabel}>{s.label}</span>
                                <span className={styles.stepValue}>{n(s.value)}</span>
                            </div>
                            <div className={styles.track}><div className={styles.bar} style={{ width: `${width}%` }} /></div>
                            {prev !== null && <span className={styles.stepRate}>{p(pct(s.value, prev))} dal passo prima</span>}
                        </li>
                    )
                })}
            </ol>
        </section>
    )
}
