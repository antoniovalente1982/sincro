import Image from 'next/image'
import { ArrowUpRight, ArrowRight } from 'lucide-react'
import { BLOG_NAME, BLOG_TOPICS, blogNavigationHref, type BlogPost, type LegacyArticle } from '@/lib/blog'
import BlogText from './BlogText'
import styles from './blog.module.css'

function Shell({ children, preview = false, search = '' }: { children: React.ReactNode; preview?: boolean; search?: string }) {
    return <div className={styles.site}>
        <a className={styles.skip} href="#contenuto">Vai al contenuto</a>
        {preview && <div className={styles.preview}>Anteprima locale · Contenuti di esempio, non pubblicati · Nessun tracciamento</div>}
        <header className={styles.header}>
            <a className={styles.masthead} href={preview ? '/blog/anteprima' : blogNavigationHref('/blog', search)}>{BLOG_NAME}<span>CALCIO, MENTE E CRESCITA</span></a>
            <p>Uno spazio per i genitori.<br /><strong>A cura di Metodo Sincro®</strong></p>
        </header>
        <nav className={styles.nav} aria-label="Navigazione blog"><a href={preview ? '/blog/anteprima' : blogNavigationHref('/blog', search)}>Tutti gli articoli</a><a href="https://www.metodosincro.it">Conosci Metodo Sincro <ArrowUpRight size={14} aria-hidden="true" /></a></nav>
        {children}
        <footer className={styles.footer}><div><strong>{BLOG_NAME}</strong><p>Approfondimenti di Metodo Sincro® per le famiglie nel calcio.<br />I contenuti possono presentare i nostri percorsi di coaching.</p></div><div><strong>Sincro Group S.R.L.</strong><p>Via Monte Napoleone 8, Milano<br />C.F. e P.IVA 13508690966</p><a href="https://www.metodosincro.it">Il sito Metodo Sincro ↗</a></div></footer>
    </div>
}

export function BlogArchive({ posts, legacy, preview = false, search = '' }: { posts: BlogPost[]; legacy: LegacyArticle[]; preview?: boolean; search?: string }) {
    const cards = [
        ...posts.map(post => ({ title: post.title, excerpt: post.excerpt, href: preview ? '/blog/anteprima/articolo' : blogNavigationHref(`/blog/${post.slug}`, search), cover: post.cover, alt: post.coverAlt, topic: BLOG_TOPICS.find(t => t.id === post.topic)?.label || 'Approfondimenti' })),
        ...legacy.filter(post => post.status === 'active').map(post => ({ title: post.title, excerpt: post.description, href: blogNavigationHref(`/f/${post.slug}`, search), cover: post.slug === 'pochi-minuti' ? '/advertorial-pochi-minuti/calciatore-17-anni.webp' : '', alt: 'Calciatore a bordo campo. Scena illustrativa generata con AI.', topic: 'Approfondimenti' })),
    ]
    const [featured, ...rest] = cards
    return <Shell preview={preview} search={search}><main id="contenuto" className={styles.archive}>
        <div className={styles.intro}><p className={styles.eyebrow}>DALLA PARTE DI CHI LO ACCOMPAGNA</p><h1>Il suo calcio.<br /><em>Le tue domande.</em></h1><p>La panchina, un errore che pesa, il silenzio dopo la partita. Uno spazio per capire che cosa vive tuo figlio e come stargli vicino.</p></div>
        {featured ? <a href={featured.href} className={styles.featured}>
            {featured.cover && <div className={styles.featureImage}><Image src={featured.cover} alt={featured.alt} fill sizes="(max-width: 720px) 100vw, 48vw" priority /></div>}
            <div className={styles.featureCopy}><span className={styles.eyebrow}>IN PRIMO PIANO · {featured.topic}</span><h2>{featured.title}</h2><p>{featured.excerpt}</p><span className={styles.read}>Leggi l’approfondimento <ArrowRight size={19} aria-hidden="true" /></span></div>
        </a> : <div className={styles.empty}><h2>Stiamo preparando i primi approfondimenti.</h2><p>Torna qui per leggere gli articoli dedicati alle famiglie nel calcio.</p></div>}
        {rest.length > 0 && <section className={styles.more}><h2>Continua a leggere</h2><div className={styles.cards}>{rest.map(card => <article key={card.href}><p className={styles.eyebrow}>{card.topic}</p><h3><a href={card.href}>{card.title}</a></h3><p>{card.excerpt}</p><a href={card.href} className={styles.read}>Leggi l’articolo <ArrowUpRight size={16} aria-hidden="true" /></a></article>)}</div></section>}
        <section className={styles.manifesto}><span className={styles.eyebrow}>IL NOSTRO PUNTO DI PARTENZA</span><h2>Prima di sapere che cosa dirgli,<br />proviamo a capire che cosa vive.</h2><p>Qui trovi situazioni concrete, domande utili e spiegazioni sul lavoro mentale nel calcio. Per accompagnare il ragazzo, rispettando il suo punto di vista.</p></section>
    </main></Shell>
}

export function BlogArticle({ post, consultationHref, preview = false, related = [], search = '' }: { post: BlogPost; consultationHref: string; preview?: boolean; related?: BlogPost[]; search?: string }) {
    const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }) : 'Bozza in revisione'
    return <Shell preview={preview} search={search}><main id="contenuto" className={styles.articleLayout}>
        <article className={styles.article}>
            <p className={styles.eyebrow}>{BLOG_TOPICS.find(topic => topic.id === post.topic)?.label}</p>
            <h1>{post.title}</h1><p className={styles.dek}>{post.excerpt}</p>
            <div className={styles.byline}>A cura di Metodo Sincro <span>· {date}</span></div>
            {post.cover && <figure className={styles.cover}><Image src={post.cover} alt={post.coverAlt} width={1536} height={1024} sizes="(max-width: 720px) 100vw, 760px" priority /><figcaption>{post.coverAlt}</figcaption></figure>}
            <div className={styles.body}><BlogText body={post.body} /></div>
            <section className={styles.cta}><p className={styles.eyebrow}>IL PROSSIMO PASSO</p><h2>Vuoi confrontarti sulla situazione di tuo figlio?</h2><p>Raccontaci un episodio. Il team ti richiama per un primo confronto gratuito e per capire se il percorso può essere pertinente.</p><a href={consultationHref}>Richiedi una consulenza gratuita <ArrowRight size={18} aria-hidden="true" /></a><small>Il primo contatto è gratuito. L’eventuale percorso di coaching è a pagamento.</small></section>
            {related.length > 0 && <section className={styles.related}><h2>Potrebbe esserti utile anche</h2>{related.map(item => <a key={item.id} href={blogNavigationHref(`/blog/${item.slug}`, search)}>{item.title} <ArrowUpRight size={16} aria-hidden="true" /></a>)}</section>}
        </article>
        <aside className={styles.aside}><Image src="/images/team/antonio-valente.jpg" alt="Antonio Valente, fondatore di Metodo Sincro" width={220} height={280} /><h2>Dentro la partita</h2><p>Gli approfondimenti di Metodo Sincro, fondato da Antonio Valente.</p><p>Il lavoro mentale raccontato nel contesto reale dei ragazzi, del campo e delle famiglie.</p><a href={preview ? '/blog/anteprima' : blogNavigationHref('/blog', search)}>Esplora gli articoli →</a></aside>
    </main></Shell>
}
