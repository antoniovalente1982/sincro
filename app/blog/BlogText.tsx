import { Fragment } from 'react'
import Image from 'next/image'
import { safeBlogLink, blogTextBlocks, blogImageBlock } from '@/lib/blog'
import styles from '@/app/f/pochi-minuti/advertorial.module.css'

function Inline({ text }: { text: string }) {
    return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\))/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (link) { const href = safeBlogLink(link[2]); return href ? <a key={i} href={href}>{link[1]}</a> : <Fragment key={i}>{link[1]}</Fragment> }
        return <Fragment key={i}>{part}</Fragment>
    })
}

// A deliberately small text format: React escapes every user-authored string.
// Raw HTML, embeds and executable Markdown are never rendered.
export default function BlogText({ body }: { body: string }) {
    return blogTextBlocks(body).map((block, index) => {
        const image = blogImageBlock(block)
        if (image) return <figure key={index} className={styles.articleImage}>
            <Image src={image.src} alt={image.alt} width={1536} height={1024} sizes="(max-width: 760px) 100vw, 740px" />
            {image.caption && <figcaption>{image.caption}</figcaption>}
        </figure>
        if (block.startsWith('![')) return <p key={index}>{block}</p>
        if (block.startsWith('### ')) return <h3 key={index}><Inline text={block.slice(4)} /></h3>
        if (block.startsWith('## ')) return <h2 key={index}><Inline text={block.slice(3)} /></h2>
        if (block.startsWith('> ')) return <blockquote key={index}><Inline text={block.slice(2)} /></blockquote>
        if (block.split('\n').every(line => line.startsWith('- '))) return <ul key={index}>{block.split('\n').map((line, i) => <li key={i}><Inline text={line.slice(2)} /></li>)}</ul>
        return <p key={index}><Inline text={block} /></p>
    })
}
