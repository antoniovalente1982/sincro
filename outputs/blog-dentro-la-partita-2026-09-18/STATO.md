# Stato — Blog Dentro la partita

18 settembre 2026. **Database attivato e verificato. Codice pronto per il rilascio online.**

## Link per Antonio

- [Blog pubblico in anteprima](http://127.0.0.1:3000/blog/anteprima)
- [Area Blog del gestionale in anteprima](http://127.0.0.1:3000/blog/anteprima/gestionale)
- [Articolo di esempio](http://127.0.0.1:3000/blog/anteprima/articolo)
- [Strategia dominio, SEO e misurazione](STRATEGIA.md)

Le anteprime funzionano su questo Mac mentre il server di sviluppo è acceso. Usano dati dimostrativi, non sono indicizzate e non consentono salvataggi reali.

## Preparato

- Voce Blog nella navigazione marketing, accessi per ruolo, elenco e ricerca articoli.
- Editor, anteprima, titolo/descrizione SEO, immagine, argomento, salvataggio bozza, pubblicazione e ritiro.
- Catalogo degli advertorial precedenti ai loro indirizzi esistenti; 12 brief editoriali, non 12 articoli finiti.
- Archivio pubblico e nuove pagine articolo, HTML sul server, canonical/OG, BlogPosting/BreadcrumbList, sitemap e robots.
- Preservazione parametri di campagna e provenienza editoriale della richiesta nei dati del CRM.
- Tabella dedicata con RLS, per non esporre le bozze e non alterare i conteggi dei funnel.

## Verificato

- Build finale Next.js e TypeScript: superata.
- 12 test su validazione, attribuzione e collegamento consulenza: superati.
- ESLint mirato delle nuove superfici: superato; git diff --check superato.
- Browser: archivio e articolo a 1440 px, editor e piano a 390 px, archivio e articolo a 390 px; nessun overflow orizzontale. Immagine principale caricata; ritratto laterale desktop nascosto e non caricato su mobile per lazy loading.
- API senza autenticazione: HTTP 401 in development e production locale.
- Tutte e tre le anteprime: HTTP 404 su server production locale; robots.txt HTTP 200.
- Revisione indipendente statica: correzioni verificate e nessun problema materiale residuo nel perimetro controllato. Non è una verifica del database remoto.
- Detector grafico: due warning su Arial di servizio e linea a lato delle citazioni; scelte intenzionali derivate dall’impaginazione esistente.

## Da attivare e verificare online

Migrazione `20260918_blog_posts.sql` applicata al progetto Supabase Adpilotik (`bktiuhxenxwhkgvdaxnp`) e registrata nello storico. Verifica SQL transazionale superata: owner crea/legge una bozza, pubblica e ritira; anon non può leggere la tabella; un closer non legge o scrive gli articoli; scritture per organizzazione diversa rifiutate. I record di prova sono stati annullati con rollback: nessun contenuto di test è pubblico.

Build isolata dal lavoro V3 e dalle impostazioni già in modifica: superata, 12 test superati, ESLint mirato e diff pulito. Produzione locale collegata al database reale: archivio, sitemap e robots HTTP 200; API anonima HTTP 401; tre anteprime HTTP 404. Il ciclo API/editor con sessione autenticata non è ancora verificato; il browser locale non ha una sessione del gestionale.

Rilascio online in corso. Nessuna modifica DNS, nuovo pixel, GA4 o Search Console configurato in questo intervento.

La raccomandazione è `blog.metodosincro.it`. Dominio definitivo, routing abbreviato e reindirizzamenti vanno allineati prima di avviare l’indicizzazione. Non sono stati acquistati domini. Il sito tecnico attuale è su `landing.metodosincro.com`.

Non sono stati inviati contatti di prova: la catena articolo → richiesta → lead è implementata ma non verificata end-to-end sul database. Non ci sono dati di posizionamento o conversione del nuovo blog.
