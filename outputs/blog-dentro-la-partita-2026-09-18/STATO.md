# Stato — Blog Dentro la partita

18 settembre 2026. **Blog pubblicato online e area gestionale attiva.**

## Modello corretto su indicazione di Antonio

Antonio ha scelto il template della V3 `/f/pochi-minuti/anteprima`. Il precedente archivio pubblico con grafica diversa viene sostituito: `/blog` apre direttamente un advertorial, mentre Blog resta la raccolta nel gestionale. Nuove pagine e anteprima editor condividono testata, firma, immagine, colonna autore, CTA e CSS del modello. La V3 è inclusa in questo aggiornamento. Nessuna nuova bozza viene pubblicata.

Verifiche della correzione: 15 test superati, lint mirato e build isolata superati; browser 1440/390 px senza overflow; smoke produzione locale su redirect con UTM/ab, sitemap, anteprime 404 e bozza privata. Revisione indipendente statica: nessun problema materiale residuo nel perimetro verificato. Correzione pubblicata su Vercel Production nel commit `c7178f19`. Verificati online redirect con UTM/ab, V3 completa, sitemap e 404 per anteprime e bozza. Titolo e sottotitolo allineati al modello scelto conservando tutte le altre impostazioni del funnel.

## Link per Antonio

- [Dentro la partita — apre l’advertorial](https://landing.metodosincro.com/blog)
- [Blog nel gestionale](https://landing.metodosincro.com/dashboard/blog) — richiede accesso al gestionale
- [Advertorial già pubblicato](https://landing.metodosincro.com/f/pochi-minuti)
- [Sitemap](https://landing.metodosincro.com/sitemap.xml)
- [Strategia dominio, SEO e misurazione](STRATEGIA.md)

## Cosa c’è adesso

- 1 advertorial pubblico nel modello V3 approvato; la testata riporta all’inizio della stessa pagina.
- 1 bozza privata: «Mio figlio gioca poco: come stargli vicino senza aumentare la pressione». Contiene una scaletta di lavoro, non un articolo finito; non è pubblicata.
- 12 temi nel piano editoriale, con avvio della bozza dall’interfaccia. Le ricerche SEO indicate sono ipotesi da validare, non volumi misurati.
- Voce Blog nel menu Marketing, elenco, ricerca e filtro; editor e anteprima; salvataggio, pubblicazione e ritiro; campi SEO, argomento e immagine.
- Pagine advertorial con HTML sul server, canonical, Open Graph e dati strutturati; sitemap e robots.
- Provenienza editoriale conservata nei dati della richiesta/CRM, insieme ai parametri di campagna ammessi.

## Rilascio e verifiche

Attivazione iniziale nel commit `a28838ef`. La V3 è stata successivamente rilasciata nella correzione descritta sopra. La modifica preesistente alle impostazioni resta nel progetto locale.

Migrazione `20260918_blog_posts.sql` applicata al progetto Supabase Adpilotik (`bktiuhxenxwhkgvdaxnp`) e registrata nello storico. Tabella dedicata con RLS, distinta dai funnel: anon non può leggerla, un closer non può leggere/scrivere gli articoli, scritture per organizzazione diversa rifiutate. Creazione bozza → pubblicazione → ritiro verificati in transazione SQL, annullata con rollback senza contenuti di test pubblici.

Verifiche eseguite:

- Build isolata dal lavoro V3: superata. 12 test unitari, ESLint mirato e controllo diff superati.
- Browser desktop e mobile sulle superfici locali: nessun overflow rilevato.
- Produzione: archivio HTTP 200 e canonical corretto, nessun noindex; sitemap e robots HTTP 200; collegamento all’advertorial esistente funzionante.
- API senza autenticazione: HTTP 401. Tre anteprime di sviluppo: HTTP 404 in produzione.
- Sessione reale del gestionale: creazione e aggiornamento della bozza tramite editor online riusciti, verificati anche nel database. Bozza riletta dopo il ricaricamento.
- Bozza assente da archivio/sitemap; URL diretto della bozza HTTP 404.
- Revisione statica indipendente completata prima del rilascio. Pubblicazione/ritiro testati nel database, non mediante pubblicazione temporanea di articoli dall’editor online.

## Prossimi passi

1. Sviluppare e revisionare gli articoli del piano editoriale.
2. Collegare Google Search Console e inviare la sitemap, verificando l’indicizzazione effettiva: la predisposizione tecnica non garantisce presenza o posizionamento su Google.
3. Decidere se mantenere `landing.metodosincro.com/blog` o usare `blog.metodosincro.it`; un eventuale cambio richiede dominio, routing e redirect coerenti.
4. Verificare e configurare GA4/Meta e consenso per il blog se richiesti. Nessun nuovo pixel o script GA4 attivato qui.

Nessun dominio acquistato o DNS modificato. Nessun contatto di prova inviato; l’attribuzione completa fino al lead non è stata provata con invii reali. Nessun dato di traffico, conversione o posizionamento del nuovo blog è ancora disponibile.
