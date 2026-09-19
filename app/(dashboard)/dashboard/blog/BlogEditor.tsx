'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Save, Eye, Send, X } from 'lucide-react'
import { BLOG_TOPICS, BLOG_DEFAULT_COVER, BLOG_DEFAULT_COVER_ALT, blogCanonical, blogConsultationHref, type BlogInput, type BlogPost } from '@/lib/blog'
import { BLOG_IMAGES } from '@/lib/blog-images'
import { EDITORIAL_THEME_OPTIONS } from '@/lib/editorial-landing-themes'
import { buildEditorialLanding } from '@/lib/editorial-landing'
import { BlogArticle } from '@/app/blog/BlogViews'
import styles from './blog-admin.module.css'

export const emptyArticle: BlogInput = { title: '', slug: '', excerpt: '', body: '', topic: 'fiducia', seoTitle: '', seoDescription: '', cover: BLOG_DEFAULT_COVER, coverAlt: BLOG_DEFAULT_COVER_ALT, status: 'draft' }
export default function BlogEditor({ initial, onClose, onSaved, demo = false, initialPreview = false }: { initial: BlogInput | BlogPost; onClose: () => void; onSaved: (post: BlogPost) => void; demo?: boolean; initialPreview?: boolean }) {
    const [form, setForm] = useState(initial)
    const [saved, setSaved] = useState(initial)
    const [saving, setSaving] = useState(false)
    const [preview, setPreview] = useState(initialPreview)
    const [error, setError] = useState('')
    const dirty = JSON.stringify(form) !== JSON.stringify(saved)
    const existing = 'id' in form
    useEffect(() => {
        if (!dirty) return
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [dirty])
    function update(key: keyof BlogInput, value: string) { setForm(current => ({ ...current, [key]: value })) }
    function close() { if (!dirty || window.confirm('Hai modifiche non salvate. Vuoi uscire dall’advertorial?')) onClose() }
    async function save(status: BlogInput['status']) {
        if (demo) return
        setSaving(true); setError('')
        try {
            const response = await fetch('/api/blog', { method: existing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, status }) })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Salvataggio non riuscito.')
            setForm(result); setSaved(result); onSaved(result)
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Connessione non disponibile. Il testo è ancora nell’editor.') }
        finally { setSaving(false) }
    }
    const previewPost: BlogPost = { ...form, id: 'id' in form ? form.id : 'preview', createdAt: '', updatedAt: '', publishedAt: 'publishedAt' in form ? form.publishedAt : null }
    const landingPreview = buildEditorialLanding(form)
    return <div className={`${styles.editor}${preview ? ` ${styles.previewMode}` : ''}`}>
        <div className={styles.toolbar}><button onClick={close} disabled={saving}><ArrowLeft size={17} /> Advertorial</button><span>{dirty ? 'Modifiche da salvare' : existing ? 'Versione salvata' : 'Nuova bozza'}</span><div><button onClick={() => setPreview(!preview)}><Eye size={16} /> {preview ? 'Torna al testo' : 'Anteprima'}</button><button disabled={saving || demo} onClick={() => save(form.status === 'active' ? 'active' : 'draft')}><Save size={16} /> {saving ? 'Salvataggio…' : form.status === 'active' ? 'Aggiorna online' : 'Salva bozza'}</button>{form.status !== 'active' && <button className={styles.primary} disabled={saving || demo} onClick={() => save('active')}><Send size={16} /> Pubblica</button>}</div></div>
        {demo && <p className={styles.notice}>Anteprima del gestionale: puoi provare l’editor, ma qui non vengono salvati o pubblicati contenuti.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {preview ? <div className={styles.articlePreview}><BlogArticle post={previewPost} preview consultationHref={`https://landing.metodosincro.com${blogConsultationHref(form.slug || 'anteprima', '', true)}`} /></div> : <fieldset className={styles.editorGrid} disabled={saving}>
            <section className={styles.writing}><p className={styles.hint}>Template advertorial · Dentro la partita. Firma, colonna autore e inviti alla consulenza sono inclusi nell’impaginazione. Ogni articolo pubblicato usa automaticamente la landing personalizzata e il tracciamento condiviso, secondo le preferenze del visitatore.</p><label>Titolo dell’advertorial<input className={styles.titleInput} value={form.title} maxLength={200} placeholder="La domanda da cui partire" onChange={event => update('title', event.target.value)} /></label><label>Introduzione<textarea rows={3} value={form.excerpt} maxLength={500} placeholder="La situazione del genitore e ciò che troverà nell’advertorial." onChange={event => update('excerpt', event.target.value)} /></label><label>Testo dell’advertorial<textarea className={styles.bodyInput} rows={22} value={form.body} maxLength={80000} placeholder="Comincia da una situazione concreta…" onChange={event => update('body', event.target.value)} /></label><p className={styles.hint}>Usa ## per i sottotitoli, **testo** per il grassetto, - per gli elenchi e [nome](https://…) per le fonti. Separa i paragrafi con una riga vuota. Per un’immagine interna usa un blocco ![descrizione](/images/blog/nome.webp &quot;Didascalia&quot;).</p><p className={styles.hint}>{form.body.trim() ? form.body.trim().split(/\s+/).length : 0} parole · Autore pubblico: Metodo Sincro</p></section>
            <aside className={styles.settings}><h2>Pubblicazione</h2><label>Argomento<select value={form.topic} onChange={event => update('topic', event.target.value)}>{BLOG_TOPICS.map(topic => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label><label>Indirizzo dell’advertorial<input value={form.slug} disabled={existing} placeholder="paura-di-sbagliare-nel-calcio" maxLength={90} onChange={event => update('slug', event.target.value)} /></label><p className={styles.hint}>{existing ? 'L’indirizzo resta stabile per conservare i link.' : 'Lettere minuscole, numeri e trattini. Sarà stabile dopo il primo salvataggio.'}</p><label>Immagine principale<select value={form.cover} onChange={event => { const image = BLOG_IMAGES.find(item => item.path === event.target.value); setForm(current => ({ ...current, cover: image?.path || '', coverAlt: image?.alt || '' })) }}><option value="">Immagine del modello</option>{BLOG_IMAGES.map(image => <option key={image.path} value={image.path}>{image.label}</option>)}</select></label>{form.cover && <label>Descrizione dell’immagine<textarea rows={3} value={form.coverAlt} maxLength={300} onChange={event => update('coverAlt', event.target.value)} /></label>}
                <h2>Landing collegata</h2><p className={styles.hint}>Chi clicca trova una pagina coerente con questo articolo: immagine, problemi, percorso, FAQ e inviti al contatto. Funziona anche lasciando vuoti i testi facoltativi.</p>
                <label>Argomento della landing<select value={form.landingTheme || ''} onChange={event => update('landingTheme', event.target.value)}><option value="">Automatico dall’argomento dell’articolo</option>{EDITORIAL_THEME_OPTIONS.map(theme => <option key={theme.id} value={theme.id}>{theme.label}</option>)}</select></label>
                <label>Titolo della landing (facoltativo)<input value={form.landingTitle || ''} maxLength={200} placeholder={form.title || 'Usa il titolo dell’articolo'} onChange={event => update('landingTitle', event.target.value)} /></label>
                <label>Introduzione della landing (facoltativa)<textarea rows={4} value={form.landingIntro || ''} maxLength={500} placeholder="Il primo confronto parte dalla situazione raccontata nell’articolo." onChange={event => update('landingIntro', event.target.value)} /></label>
                <div className={styles.searchPreview}><small>{landingPreview.theme.label}</small><strong>{landingPreview.headline || 'Il titolo riprenderà quello dell’articolo'}</strong><p>{landingPreview.intro}</p><p>{landingPreview.theme.work}</p></div>
                {form.status === 'active' && existing && <p className={styles.hint}><a href={blogConsultationHref(form.slug, '', true)} target="_blank" rel="noreferrer">Apri la landing salvata ↗</a>{dirty && ' · Salva le modifiche per vederle nella pagina collegata.'}</p>}
                <h2>Come appare su Google</h2><p className={styles.hint}>È una simulazione: Google può scegliere testi diversi. Compilare questi campi non certifica l’indicizzazione.</p><label>Titolo SEO<input value={form.seoTitle} maxLength={100} onChange={event => update('seoTitle', event.target.value)} /></label><label>Descrizione SEO<textarea rows={4} maxLength={240} value={form.seoDescription} onChange={event => update('seoDescription', event.target.value)} /></label><div className={styles.searchPreview}><small>{blogCanonical(form.slug || 'titolo-articolo')}</small><strong>{form.seoTitle || form.title || 'Titolo dell’advertorial'} | Dentro la partita</strong><p>{form.seoDescription || 'La descrizione dell’advertorial apparirà qui.'}</p></div>
                {form.status === 'active' && <div className={styles.unpublish}><p>L’advertorial è pubblico. Puoi ritirarlo e tornare a lavorarci come bozza.</p><button disabled={saving || demo} onClick={() => { if (window.confirm('Ritirare questo advertorial? Il suo indirizzo non sarà più pubblico finché non lo ripubblichi.')) void save('draft') }}><X size={15} /> Ritira dalla pubblicazione</button></div>}
            </aside>
        </fieldset>}
    </div>
}
