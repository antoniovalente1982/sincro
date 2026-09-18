import Image from 'next/image'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import content from './content.json'
import AdvertorialTracking, { type AdvertorialTrackingProps } from './AdvertorialTracking'
import styles from './advertorial.module.css'
import AdvertorialFrame, { AdvertorialHeader, ConsultationLink } from '@/components/advertorial/AdvertorialFrame'

function Emphasis({ text }: { text: string }) {
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) =>
        part.startsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part,
    )
}

function EditorialImage({ image }: { image: { src: string; alt: string; caption: string } }) {
    return <figure className={styles.articleImage}>
        <Image src={image.src} alt={image.alt} width={1536} height={1024} sizes="(max-width: 760px) 100vw, 740px" />
        <figcaption>{image.caption}</figcaption>
    </figure>
}

function PressureSequence() {
    return <figure className={styles.sequence}>
        <figcaption>{content.diagram.caption}</figcaption>
        <ol>{content.diagram.steps.map(step => <li key={step}>{step}<ArrowRight size={18} aria-hidden="true" /></li>)}</ol>
        <p>{content.diagram.note}</p>
    </figure>
}

function Demonstration() {
    return <figure className={styles.demonstration}>
        <figcaption>{content.demonstration.caption}</figcaption>
        <div className={styles.comparison}>
            {[content.demonstration.before, content.demonstration.practice].map(item => <div key={item.title}>
                <h3>{item.title}</h3>
                <p className={styles.thought}>{item.thought}</p>
                <p>{item.action}</p>
            </div>)}
        </div>
        <p className={styles.figureNote}>{content.demonstration.note}</p>
    </figure>
}

function Proof() {
    return <div className={styles.proof}>
        <p><strong>{content.proof.score}</strong> · {content.proof.count} su Trustpilot</p>
        <a href={content.proof.url} target="_blank" rel="noopener noreferrer">{content.proof.label}<ArrowUpRight size={17} aria-hidden="true" /></a>
        <p className={styles.figureNote}>Dato rilevato il {content.proof.date}. Profilo Metodo Sincro di Antonio Valente.</p>
    </div>
}

export default function Advertorial({ headline, subheadline, ctaText, consultationHref, tracking }: {
    headline: string
    subheadline: string
    ctaText: string
    consultationHref: string
    tracking?: AdvertorialTrackingProps
}) {
    return <AdvertorialFrame date="18 settembre 2026"
        note={{ title: '«Gioca tranquillo».', text: 'Il passaggio da allenare è ciò che fa quando tranquillo non si sente.', href: '#lavoro-concreto', label: 'Leggi l’esempio' }}
        tracking={tracking && <AdvertorialTracking {...tracking} />}>
                <AdvertorialHeader headline={headline} subheadline={subheadline} dateLabel="Aggiornato il 18 settembre 2026" readingMinutes={8}
                    cover="/advertorial-pochi-minuti/calciatore-17-anni.webp"
                    coverAlt="Scena illustrativa: un calciatore di circa 17 anni aspetta di entrare in campo vicino alla panchina."
                    caption="L’attesa prima di entrare: quando pochi minuti sembrano un esame. Scena illustrativa generata con AI." />
                <div className={styles.opening}>
                    {content.intro.map((paragraph, index) => <p key={index}><Emphasis text={paragraph} /></p>)}
                </div>
                {content.sections.map(section => <section key={section.id} id={section.id} className={styles.section}>
                    <h2>{section.heading}</h2>
                    {section.id === 'genitore' && <figure className={styles.articleImage}>
                        <Image src="/advertorial-pochi-minuti/genitore-calciatore-17-anni.webp" alt="Scena illustrativa: un ragazzo di circa 17 anni parla con suo padre vicino al campo." width={1536} height={1024} sizes="(max-width: 760px) 100vw, 740px" />
                        <figcaption>Il lavoro con la famiglia comprende anche il modo di affrontare il dopo partita. Scena illustrativa generata con AI.</figcaption>
                    </figure>}
                    {section.blocks.map((block, index) => {
                        if (block.type === 'image' && 'image' in block && block.image) return <EditorialImage key={index} image={block.image} />
                        if (block.type === 'diagram') return <PressureSequence key={index} />
                        if (block.type === 'demonstration') return <Demonstration key={index} />
                        if (block.type === 'proof') return <Proof key={index} />
                        if (block.type === 'inlineCta') return <div key={index} className={styles.inlineCta}>
                            <p><strong>Vuoi capire da dove partire con tuo figlio?</strong><br />Raccontaci che cosa succede in campo: valutiamo insieme se il percorso è adatto.</p>
                            <ConsultationLink href={consultationHref} text={ctaText} />
                            <p className={styles.figureNote}>Primo confronto gratuito e senza impegno. Percorso a pagamento.</p>
                        </div>
                        if (block.type === 'faq' && 'question' in block) return <div className={styles.faq} key={index}>
                            <h3>{block.question}</h3><p>{block.text}</p>
                        </div>
                        const text = 'text' in block ? block.text || '' : ''
                        if (block.type === 'pullquote') return <p key={index} className={styles.pullquote}>{text}</p>
                        return <p key={index}><Emphasis text={text} /></p>
                    })}
                </section>)}
                <section className={styles.consultation} id="consulenza" aria-labelledby="consulenza-titolo">
                    <h2 id="consulenza-titolo">{content.conclusion.heading}</h2>
                    {content.conclusion.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    <ConsultationLink href={consultationHref} text={ctaText} />
                    <p className={styles.nextStep}>Compila il modulo. Il team ti richiama per il primo confronto.</p>
                    <p className={styles.terms}>{content.terms}</p>
                </section>
    </AdvertorialFrame>
}
