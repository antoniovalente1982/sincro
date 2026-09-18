import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from '@/app/f/pochi-minuti/advertorial.module.css'

export function ConsultationLink({ href, text = 'Richiedi una consulenza gratuita' }: { href: string; text?: string }) {
    return <a className={styles.cta} href={href}>{text}<ArrowRight size={19} aria-hidden="true" /></a>
}

export function AdvertorialHeader({ headline, subheadline, dateLabel, readingMinutes, cover, coverAlt, caption }: {
    headline: string; subheadline: string; dateLabel: string; readingMinutes: number
    cover: string; coverAlt: string; caption?: string
}) {
    return <>
        <header className={styles.articleHeader}>
            <h1 id="titolo">{headline}</h1>
            <p className={styles.dek}>{subheadline}</p>
            <div className={styles.byline}>
                <Image src="/images/team/antonio-valente.jpg" alt="Antonio Valente, fondatore di Metodo Sincro" width={48} height={48} sizes="48px" />
                <div><strong>A cura di Metodo Sincro®</strong><span>Il metodo di Antonio Valente, mental coach e fondatore</span><span>{dateLabel} · {readingMinutes} {readingMinutes === 1 ? 'minuto' : 'minuti'} di lettura</span></div>
            </div>
        </header>
        <figure className={styles.heroImage}>
            <Image src={cover} alt={coverAlt} width={1122} height={1402} sizes="(max-width: 760px) 100vw, 740px" priority />
            <figcaption>{caption || coverAlt}</figcaption>
        </figure>
    </>
}

export default function AdvertorialFrame({ children, date, preview = false, homeHref = '#inizio', note, tracking }: {
    children: ReactNode; date: string; preview?: boolean; homeHref?: string; tracking?: ReactNode
    note: { title: string; text: string; href: string; label: string }
}) {
    return <div className={styles.page}>
        <a className={styles.skipLink} href="#articolo">Vai all’articolo</a>
        <div className={styles.disclosure}>{preview ? 'Anteprima · Advertorial non pubblicato · ' : 'Contenuto pubblicitario '}a cura di Metodo Sincro®</div>
        <header className={styles.header} id="inizio">
            <a className={styles.masthead} href={homeHref}>Dentro la partita<span>Calcio, mente e crescita</span></a>
            <p className={styles.publisher}>Gli approfondimenti di<br /><strong>Metodo Sincro®</strong></p>
        </header>
        <div className={styles.edition}><span>Calcio giovanile · Atleti e famiglie</span><span>{date}</span></div>
        <main className={styles.layout}>
            <article className={styles.article} id="articolo" aria-labelledby="titolo">{children}</article>
            <aside className={styles.aside} aria-label="Chi cura l’approfondimento">
                <div className={styles.author}>
                    <Image src="/images/team/antonio-valente.jpg" alt="Antonio Valente con un pallone da calcio" width={900} height={1200} sizes="220px" />
                    <h2>Antonio Valente</h2>
                    <p className={styles.authorRole}>Mental coach<br />Fondatore di Metodo Sincro®</p>
                    <p>Un lavoro individuale su attenzione, pressione e risposta all’errore, nel contesto reale del calciatore.</p>
                </div>
                <div className={styles.marginNote}><p>{note.title}</p><p>{note.text}</p><a href={note.href}>{note.label}<ArrowRight size={16} aria-hidden="true" /></a></div>
                <p className={styles.asideDisclosure}>Dentro la partita è uno spazio di approfondimento di Metodo Sincro. Questo articolo presenta il suo servizio di mental coaching.</p>
            </aside>
        </main>
        <footer className={styles.footer}>
            <div><strong className={styles.footerBrand}>Metodo Sincro®</strong><p>Percorsi individuali di mental coaching per calciatori.<br />Sessioni online, con un coach dedicato.</p></div>
            <div><strong>Sincro Group S.R.L.</strong><p>Via Monte Napoleone n. 8 — 20121 Milano<br />C.F. e P.IVA 13508690966</p></div>
        </footer>
        {tracking}
    </div>
}
