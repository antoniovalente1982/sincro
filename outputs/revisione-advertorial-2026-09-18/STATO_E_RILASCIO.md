# Stato della revisione

Preparata il 18 settembre 2026. **Versione locale pronta per revisione, non pubblicata.**

- [Anteprima locale](http://127.0.0.1:3000/f/pochi-minuti/anteprima), disponibile mentre il server di sviluppo è acceso.
- [Testo completo aggiornato — V3](ADVERTORIAL_V3.md).
- [Proposta Mappa Sincro](PROPOSTA_MAPPA_SINCRO.md) e [modello compilabile](MAPPA_SINCRO_MODELLO.html).
- [Analisi e scelte](ANALISI_E_SCELTE.md).
- Originali preservati in `ADVERTORIAL_V1_ARCHIVIO.md` e `content-v1.json`.

## Integrazione già preparata

Aggiornamento V3: aggiunte due fotografie illustrative AI (calciatore che si propone per il pallone e sessione online) e due FAQ, per un totale di sei. Le nuove immagini pesano complessivamente circa 256 KB in WebP e vengono caricate in modo differito. Prompt, percorsi e provenienza nel file `IMMAGINI_V3.json`.

La nuova offerta «Mappa Sincro» è progettata nel documento separato: testo, FAQ, traccia per il team e modello compilabile. La sua consegna richiede una scelta operativa ancora aperta. Per questo la promessa nel funnel resta coerente con il servizio attuale. Nessun rilascio o aggiornamento del database eseguito.

Aggiornati renderer, contenuti e CSS della route `/f/pochi-minuti`. Preservato il collegamento alla consulenza e il tracciamento esistente. Metadati: la descrizione segue prima il sottotitolo personalizzato, poi la descrizione del funnel e il valore predefinito.

L’anteprima `/f/pochi-minuti/anteprima` è disponibile soltanto con `NODE_ENV=development`, non accede al database e non monta il componente di tracciamento dell’articolo. Le CTA portano al modulo pubblico con `ab=A`; non sono stati inviati contatti di prova. La preview in produzione risponde con pagina non trovata.

## Per il rilascio

Le impostazioni del gestionale prevalgono sui valori del file `content.json`. Per pubblicare il titolo nuovo bisogna quindi allineare **sia codice sia record Funnel**, conservando tutte le impostazioni estranee alla revisione. I valori sono in `IMPOSTAZIONI_FUNNEL_PROPOSTE.json`: `settings_patch` è un aggiornamento parziale, non deve sostituire tutto l’oggetto `settings`.

Il tentativo di lettura database con la configurazione locale è fallito con `fetch failed`; non sono state effettuate mutazioni. La pagina attualmente pubblica è stata invece letta nel browser e mostra la precedente versione. Prima di aggiornare il record, rileggere lo stato corrente dal gestionale e preservare eventuali personalizzazioni.

Dopo un eventuale rilascio, aprire `/f/pochi-minuti?ab=A` e verificare titolo, immagini e CTA. Non dedurre dalla build che il database, il rilascio o la consegna degli eventi pubblicitari siano stati aggiornati.

## Provenienza font

Source Serif 4 da Google Fonts, licenza SIL OFL conservata in `public/fonts/source-serif-4-OFL.txt`. Copia locale WOFF2 con caratteri latini e punteggiatura, circa 133 KB, nessuna chiamata a Google Fonts durante la visita. Barlow Condensed già presente per la testata. Le immagini conservano la provenienza del progetto precedente.

## Verifiche

V3: build finale, lint mirato e controllo desktop/mobile superati. Test del link e revisione indipendente riguardano la precedente V2; i collegamenti non sono stati modificati nella V3. Dettagli in [VERIFICA.md](VERIFICA.md). Nessuna misura di conversione o redditività disponibile per la nuova versione.
