import { BLOG_DEFAULT_COVER, BLOG_DEFAULT_COVER_ALT, blogEntry, isPublishedBlog, safeBlogImagePath, type BlogInput, type BlogRow } from './blog'
import { EDITORIAL_THEMES, isEditorialTheme } from './editorial-landing-themes'

export function buildEditorialLanding(article: BlogInput, entry = `blog-${article.slug}`) {
    const themeId = isEditorialTheme(article.landingTheme) ? article.landingTheme : isEditorialTheme(article.topic) ? article.topic : 'fiducia'
    const theme = EDITORIAL_THEMES[themeId]
    const child = themeId === 'femminile' ? 'tua figlia' : 'tuo figlio'
    return {
        entry, themeId, theme,
        articleTitle: article.title,
        articleHref: entry === 'advertorial-pochi-minuti' ? '/f/pochi-minuti' : `/blog/${article.slug}`,
        headline: article.landingTitle?.trim() || article.title,
        intro: article.landingIntro?.trim() || `Se riconosci ${child} nella situazione raccontata, partiamo da un episodio concreto. Nel primo confronto gratuito con te, il genitore, valutiamo se e come il percorso Metodo Sincro può essere pertinente.`,
        image: safeBlogImagePath(article.cover) || BLOG_DEFAULT_COVER,
        imageAlt: article.cover && safeBlogImagePath(article.cover) ? article.coverAlt : BLOG_DEFAULT_COVER_ALT,
        cta: 'Richiedi il primo confronto gratuito',
        faqs: [theme.faq,
            { q: 'Che cosa succede nel primo confronto?', a: 'Lasci i tuoi contatti e il team ti richiama. Il primo incontro è con te, il genitore che valuta il percorso: partiamo da un episodio, da ciò che hai osservato e da ciò che vorresti chiarire. Se il percorso può essere pertinente, ti spieghiamo come funziona.' },
            { q: 'Mio figlio deve partecipare subito?', a: 'Il primo confronto è rivolto al genitore. Per iniziare un eventuale lavoro con il ragazzo serviranno anche il suo punto di vista e la sua disponibilità. Non gli viene attribuita una valutazione sulla base del solo racconto di un adulto.' },
            { q: 'Come si svolge l’eventuale percorso?', a: 'Le sessioni sono individuali e online, con un coach dedicato. Obiettivi, durata e frequenza vengono definiti nella proposta personalizzata, tenendo conto della sua situazione e degli impegni sportivi.' },
            { q: 'Quanto costa e che cosa sto richiedendo?', a: 'Stai richiedendo un primo confronto gratuito e senza impegno. L’eventuale percorso di coaching è a pagamento: contenuti, durata, prezzo e condizioni vengono presentati prima di decidere se iniziare.' },
        ].map(item => themeId === 'femminile' ? { q: item.q.replaceAll('Mio figlio', 'Mia figlia').replaceAll('mio figlio', 'mia figlia'), a: item.a.replaceAll('il ragazzo', 'la ragazza').replaceAll('del ragazzo', 'della ragazza').replaceAll('con lui', 'con lei') } : item),
    }
}
export type EditorialLanding = ReturnType<typeof buildEditorialLanding>

// Public variants may only use a matching, published article from the target tenant.
export function editorialLandingFromRow(entryValue: unknown, organizationId: string, row: (BlogRow & { organization_id: string }) | null): EditorialLanding | null {
    const entry = blogEntry(entryValue)
    if (!entry?.startsWith('blog-') || !row || row.organization_id !== organizationId || row.slug !== entry.slice(5) || row.settings.blog?.slug !== row.slug || !isPublishedBlog(row)) return null
    return buildEditorialLanding(row.settings.blog, entry)
}
