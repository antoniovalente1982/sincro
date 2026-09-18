# Blog «Dentro la partita» — piano di implementazione

**Obiettivo:** area Blog nel gestionale, archivio pubblico e articoli indicizzabili, piano dei problemi dei genitori. Nome pubblico confermato da Antonio il 18 settembre 2026: Dentro la partita, a firma Metodo Sincro.

**Architettura:** tabella dedicata `blog_posts` con RLS per organizzazione e ruolo, nessun accesso anonimo. Contenuto strutturato in `settings.blog`. La tabella `funnels` resta fonte degli advertorial precedenti, senza copiarli. API dedicata con controllo ruolo e validazione; migrazione `20260918_blog_posts.sql`, nessuna nuova dipendenza. I funnel già esistenti restano ai propri URL. I nuovi articoli hanno una sola route, `/blog/[slug]`. Il gestionale resta privato; solo articoli attivi sono pubblici. Nessuna pubblicazione, modifica DNS o installazione pixel automatica.

**Stack:** Next.js App Router, React, Supabase, CSS Modules, node:test/tsx.

## Decisioni

- Prima sede tecnica: dominio già configurato `landing.metodosincro.com/blog`. Il dominio definitivo non è stato scelto; proposta: sottocartella del sito principale o sottodominio blog. Nessun acquisto.
- Identità editoriale ereditata dalla V3: fondo carta, nero, accento rosso, Source Serif 4 locale. Dashboard coerente con le variabili del gestionale.
- Copia salvata nel database; anteprime locali chiaramente indicate, non indicizzate e senza tracking. Errori di database dichiarati, senza presentarli come archivio vuoto.
- Piano editoriale: temi dalla ricerca del 17 settembre, domande di ricerca come ipotesi, senza volumi inventati. Le schede sono brief, non articoli già pubblicati.
- SEO: metadata, canonical, Open Graph, BlogPosting/BreadcrumbList, sitemap dei pubblicati, robots. Non dichiarare indicizzazione effettiva senza Search Console.
- Attribuzione: preservare UTM esistenti, aggiungere `entry=blog-[slug]`, conservare provenienza nei dati aggiuntivi della richiesta. Non sostituire l’origine organica con UTM interni.

## Esecuzione

- [x] `lib/blog.ts` e `lib/blog.test.ts`: validazione, normalizzazione, URL, controlli pubblicazione e provenienza. Verificare casi slug riservati, link pericolosi, SEO mancante, parametri estranei, date coerenti.
- [x] `lib/blog-server.ts`, `app/api/blog/route.ts`: CRUD autenticato, filtri tenant e tipo; preservare altri settings, conflitti concorrenti con updated_at; bozze mai esposte dall’archivio.
- [x] `app/(dashboard)/dashboard/blog/*`, sidebar e permessi: lista, ricerca, filtro stato, editor testo/SEO, anteprima, salvataggio, pubblicazione e ritiro, piano editoriale, collegamenti agli advertorial esistenti.
- [x] `app/blog/*`: archivio, pagina articolo con contenuto reso sul server, contenuti correlati, CTA e identità del brand. Anteprima development per revisione della grafica e dell’editor senza dati reali.
- [x] `app/sitemap.ts`, `app/robots.ts`, pubblicazione: esclusione bozze e anteprime, canonical e URL univoci. Homepage gestionale invariata.
- [x] Documentazione dominio/SEO/misurazione e test: test logica, lint dei file nuovi, build, browser desktop/mobile, autorizzazioni e metadata. Registrare limiti del test database remoto.

## Verifica prevista

`npx tsx --test lib/blog.test.ts lib/advertorial.test.ts` → nessun fallimento.
`npx eslint lib/blog*.ts app/blog app/api/blog 'app/(dashboard)/dashboard/blog' app/robots.ts app/sitemap.ts` → nessun errore nuovo.
`npm run build` → build completa. Richieste HTTP locali: anteprima 200, API anonima 401, bozze assenti dalle pagine pubbliche, HTML con canonical/JSON-LD coerenti. Verifica visuale a 1440 e 390 px, nessun overflow.

## Revisione architetturale
La revisione indipendente ha rilevato una policy anonima ampia sui funnel nel repository: le nuove bozze sono quindi isolate in blog_posts. La migrazione deve essere applicata prima del rilascio; il mancato collegamento non viene mascherato con dati dimostrativi.

## Esito
Implementazione e verifiche locali completate; rilascio escluso da questo stato. Migrazione e prova CRUD/RLS remota restano non eseguite: connessione locale non disponibile e browser Supabase non autenticato. Dettagli in outputs/blog-dentro-la-partita-2026-09-18/STATO.md.
