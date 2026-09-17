import Image from 'next/image'
import { ArrowDown, ArrowRight } from 'lucide-react'
import content from './content.json'
import AdvertorialTracking, { type AdvertorialTrackingProps } from './AdvertorialTracking'
import styles from './advertorial.module.css'

function Emphasis({ text }: { text: string }) {
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) =>
        part.startsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part,
    )
}

export default function Advertorial({ headline, subheadline, ctaText, consultationHref, tracking }: {
    headline: string
    subheadline: string
    ctaText: string
    consultationHref: string
    tracking: AdvertorialTrackingProps
}) {
    return <div className={styles.page}>
        <a className={styles.skipLink} href="#articolo">Vai all’articolo</a>
        <header className={styles.header}>
            <a className={styles.brand} href="#inizio" aria-label="Metodo Sincro, inizio articolo">Metodo <strong>Sincro<span>®</span></strong></a>
            <a className={styles.headerLink} href="#consulenza">Parliamone <ArrowDown size={16} aria-hidden="true" /></a>
        </header>
        <main id="inizio">
            <section className={styles.hero} aria-labelledby="titolo">
                <div className={styles.heroCopy}>
                    <h1 id="titolo">{headline}</h1>
                    <p className={styles.dek}>{subheadline}</p>
                    <div className={styles.byline}>
                        <span>A cura di <strong>Metodo Sincro®</strong></span>
                        <span>17 settembre 2026 · 5 minuti di lettura</span>
                    </div>
                    <p className={styles.disclosure}>Approfondimento promozionale · Per genitori di calciatori di 16–18 anni</p>
                    <a className={styles.readLink} href="#articolo">Leggi l’approfondimento <ArrowDown size={17} aria-hidden="true" /></a>
                </div>
                <figure className={styles.heroImage}>
                    <Image src="/advertorial-pochi-minuti/calciatore-17-anni.webp" alt="Scena illustrativa: un calciatore di circa 17 anni attende a bordo campo vicino alla panchina." width={1122} height={1402} sizes="(max-width: 760px) 100vw, 40vw" priority />
                    <figcaption>Scena illustrativa generata con AI</figcaption>
                </figure>
            </section>
            <div className={styles.articleLayout}>
                <aside className={styles.aside} aria-label="In questo articolo">
                    <p>In questo articolo</p>
                    <nav aria-label="Indice dell’articolo">
                        {content.sections.map((section, index) => <a key={section.id} href={`#${section.id}`}>{content.indexLabels[index]}</a>)}
                        <a href="#consulenza">Il primo passo</a>
                    </nav>
                    <p className={styles.asideNote}>Un percorso individuale.<br />Un coach dedicato.<br />Obiettivi definiti insieme.</p>
                </aside>
                <article className={styles.article} id="articolo">
                    <div className={styles.opening}>
                        {content.intro.map((paragraph, index) => <p key={index}><Emphasis text={paragraph} /></p>)}
                    </div>
                    {content.sections.map(section => <section key={section.id} id={section.id} className={styles.section}>
                        <h2>{section.heading}</h2>
                        {section.id === 'genitore' && <figure className={styles.articleImage}>
                            <Image src="/advertorial-pochi-minuti/genitore-calciatore-17-anni.webp" alt="Scena illustrativa: un calciatore di circa 17 anni parla con suo padre all’uscita dal campo." width={1536} height={1024} sizes="(max-width: 760px) 100vw, 720px" />
                            <figcaption>Il confronto dopo la partita, dal punto di vista del ragazzo e del genitore. Scena illustrativa generata con AI.</figcaption>
                        </figure>}
                        {section.blocks.map((block, index) => block.type === 'list'
                            ? <ul key={index}>{block.items?.map((item, itemIndex) => <li key={itemIndex}><Emphasis text={item} /></li>)}</ul>
                            : <p key={index} className={block.text?.startsWith('**') && block.text?.endsWith('**') ? styles.pullquote : undefined}><Emphasis text={block.text || ''} /></p>)}
                    </section>)}
                    <section className={styles.consultation} id="consulenza" aria-labelledby="consulenza-titolo">
                        <h2 id="consulenza-titolo">{content.conclusion.heading}</h2>
                        {content.conclusion.paragraphs.map((paragraph, index) => <p key={index}><Emphasis text={paragraph} /></p>)}
                        <a className={styles.cta} href={consultationHref}>{ctaText}<ArrowRight size={20} aria-hidden="true" /></a>
                        <p className={styles.terms}>La consulenza è gratuita e senza impegno. Il percorso di coaching è a pagamento: contenuti, durata e prezzo vengono presentati nella proposta personalizzata prima di decidere se iniziare.</p>
                    </section>
                </article>
            </div>
        </main>
        <footer className={styles.footer}>
            <div><span className={styles.footerBrand}>Metodo Sincro®</span><p>Percorsi individuali di mental coaching per calciatori.<br />Sessioni online, con un coach dedicato.</p></div>
            <div><strong>Sincro Group S.R.L.</strong><p>Via Monte Napoleone n. 8 — 20121 Milano<br />C.F. e P.IVA 13508690966</p></div>
        </footer>
        <AdvertorialTracking {...tracking} />
    </div>
}
