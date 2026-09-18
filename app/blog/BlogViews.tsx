import { Fragment } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { BLOG_DEFAULT_COVER, BLOG_DEFAULT_COVER_ALT, blogNavigationHref, type BlogPost } from '@/lib/blog'
import AdvertorialFrame, { AdvertorialHeader, ConsultationLink } from '@/components/advertorial/AdvertorialFrame'
import BlogText from './BlogText'
import styles from '@/app/f/pochi-minuti/advertorial.module.css'

export function BlogArticle({ post, consultationHref, preview = false, related = [], search = '' }: { post: BlogPost; consultationHref: string; preview?: boolean; related?: BlogPost[]; search?: string }) {
    const timestamp = post.updatedAt || post.publishedAt
    const date = timestamp && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }) : ''
    const readingMinutes = Math.max(1, Math.ceil(post.body.trim().split(/\s+/).filter(Boolean).length / 200))
    const sections = post.body.split(/(?=^## )/m).filter(part => part.trim())
    const ctaAfter = Math.max(0, Math.floor(sections.length / 2) - 1)
    return <AdvertorialFrame date={post.status === 'active' && date ? date : 'Bozza in revisione'} preview={preview}
        note={{ title: 'Da dove partire.', text: 'Raccontaci una situazione concreta. Valutiamo insieme se il percorso è adatto a tuo figlio.', href: '#consulenza', label: 'Il primo confronto' }}>
        <AdvertorialHeader headline={post.title || 'Titolo dell’advertorial'} subheadline={post.excerpt}
            dateLabel={post.status === 'active' && date ? `Aggiornato il ${date}` : 'Bozza in revisione'} readingMinutes={readingMinutes}
            cover={post.cover || BLOG_DEFAULT_COVER} coverAlt={post.cover ? post.coverAlt : BLOG_DEFAULT_COVER_ALT} />
        {sections.map((section, index) => <Fragment key={index}>
            <div className={`${section.startsWith('## ') ? styles.section : styles.opening} ${styles.authored}`}><BlogText body={section} /></div>
            {sections.length > 1 && index === ctaAfter && <div className={styles.inlineCta}>
                <p><strong>Hai già provato ad aiutarlo. Da dove puoi ripartire?</strong><br />Porta un episodio al primo confronto: mettiamo a fuoco i tuoi dubbi e valutiamo se il percorso è adatto alla vostra situazione.</p>
                <ConsultationLink href={consultationHref} text="Voglio capire come aiutarlo" />
                <p className={styles.figureNote}>Primo confronto gratuito e senza impegno. Percorso a pagamento.</p>
            </div>}
        </Fragment>)}
        <section className={styles.consultation} id="consulenza" aria-labelledby="consulenza-titolo">
            <h2 id="consulenza-titolo">Hai riconosciuto la situazione di tuo figlio?</h2>
            <p>Il primo passo è raccontarci un episodio concreto: quella partita, quell’ingresso in campo, quella frase detta tornando a casa.</p>
            <p>Il primo confronto gratuito è rivolto a te, il genitore che sta valutando come aiutarlo. Partiamo da ciò che hai osservato e dai tentativi già fatti, per capire quali domande approfondire e se Metodo Sincro può essere pertinente.</p>
            <p>Se emerge una proposta, chiariremo come coinvolgere tuo figlio, che cosa prevede il lavoro e quale investimento richiede.</p>
            <ConsultationLink href={consultationHref} text="Voglio capire come aiutarlo" />
            <p className={styles.nextStep}>Compila il modulo. Il team ti richiama per il primo confronto.</p>
            <p className={styles.terms}>Consulenza gratuita e senza impegno. Il percorso di coaching è a pagamento; contenuti, durata e prezzo vengono presentati prima di decidere se iniziare.</p>
        </section>
        {related.length > 0 && <section className={styles.related}><h2>Altri approfondimenti</h2>{related.map(item => <a key={item.id} href={blogNavigationHref(`/blog/${item.slug}`, search)}>{item.title}<ArrowUpRight size={16} aria-hidden="true" /></a>)}</section>}
    </AdvertorialFrame>
}
