import content from '@/app/f/pochi-minuti/content.json'
import type { BlogPost } from '@/lib/blog'

// Demonstration only: this does not seed or publish any database record.
export const samplePost: BlogPost = {
    id: 'preview-pochi-minuti', title: content.headline, slug: 'paura-di-sbagliare-nel-calcio', excerpt: content.subheadline,
    body: [...content.intro, ...content.sections.flatMap(section => [`## ${section.heading}`, ...section.blocks.flatMap(block => 'text' in block && typeof block.text === 'string' ? [...('question' in block && typeof block.question === 'string' ? [`### ${block.question}`] : []), block.type === 'pullquote' ? `> ${block.text}` : block.text] : [])])].join('\n\n'),
    topic: 'fiducia', seoTitle: 'Paura di sbagliare nel calcio: come capire e aiutare tuo figlio', seoDescription: 'In allenamento gioca libero, in partita si blocca. Uno sguardo su pressione, fiducia e risposta all’errore per i genitori di giovani calciatori.',
    cover: '/advertorial-pochi-minuti/calciatore-17-anni.webp', coverAlt: 'Un calciatore di circa 17 anni a bordo campo. Scena illustrativa generata con AI.',
    status: 'draft', publishedAt: null, createdAt: '2026-09-18T10:00:00Z', updatedAt: '2026-09-18T10:00:00Z',
}
