> Aggiornamento: le 17 bozze sono state pubblicate su richiesta esplicita il 18 settembre 2026. Vedi `PUBBLICAZIONE.json`, `VERIFICA_PUBBLICAZIONE.json` e `ANTEPRIME.md`. I comandi di applicazione immagini descritti sotto riguardano la fase precedente: richiedono lo stato draft e ora rifiutano le pagine attive.

# Mappatura delle immagini degli advertorial

Questo pacchetto prepara l’aggiornamento delle immagini nelle 17 nuove bozze. Comprende 17 protagonisti di fantasia distinti e 50 nuovi asset: 17 copertine e 33 immagini interne. La fotografia reale di Antonio rimane come seconda immagine interna dell’articolo `mental-coaching-calcio-ragazzi`; viene corretta soltanto la sua descrizione alternativa errata.

- `PERSONAGGI.json`: identità e scene pianificate; gestito dal processo di generazione.
- `IMAGE_MAPPING.json`: percorsi, descrizioni alternative e didascalie. Le descrizioni seguono le scene pianificate e vanno confrontate con gli asset finali.
- `BASELINE.json`: copia integrale dei 17 articoli al momento della preparazione, con hash e blocchi immagine originali.
- `apply-story-images.mjs`: controllo e applicazione, senza pubblicazione.

Le immagini sono illustrazioni: non documentano clienti, testimonianze o risultati. I nomi degli articoli servono soltanto a collegare gli asset. Non sono stati inventati nomi dei ragazzi.

## Controlli in sola lettura

Dalla radice del progetto:

```sh
node outputs/advertorial-storie-2026-09-18/apply-story-images.mjs
node outputs/advertorial-storie-2026-09-18/apply-story-images.mjs --require-assets
node outputs/advertorial-storie-2026-09-18/apply-story-images.mjs --check-db
```

Il primo comando non modifica alcun file e non apre connessioni al database. Verifica le identità, i percorsi, i blocchi Markdown, le etichette AI e l’integrità del resto del testo. Segnala gli asset ancora mancanti. `--require-assets` esige tutti i 50 WebP, decodificabili e con contenuti distinti. `--check-db` apre una transazione in sola lettura per confrontare le 17 bozze con la baseline.

## Applicazioni distinte, dopo la revisione delle immagini

```sh
node outputs/advertorial-storie-2026-09-18/apply-story-images.mjs --apply-local
node outputs/advertorial-storie-2026-09-18/apply-story-images.mjs --write-db
```

I due comandi sono separati e non possono essere combinati. Eseguiti il 18 settembre 2026: sorgenti locali e 17 bozze nel database aggiornate; ricevute e copie precedenti in `snapshots/`. Richiedono tutti i 50 asset in `public/images/blog/storie`. Prima dell’applicazione occorre verificare visivamente la continuità del protagonista in ogni articolo e la corrispondenza delle descrizioni alle immagini finali.

`--apply-local` aggiorna soltanto `cover`, `coverAlt` e i due blocchi immagine di `body` nelle sorgenti JSON. Confronta gli hash originali e salva prima una copia integrale. Le scritture sono atomiche per singolo file; se una modifica concorrente interrompe il lotto, i file già aggiornati restano tali e la nuova esecuzione li riconosce. Il programma non ripristina automaticamente altri lavori.

`--write-db` carica `.env.local` tramite dotenv silenzioso e usa `DATABASE_URL`. Seleziona e blocca esclusivamente i 17 slug noti del tenant `a5dd4842-f0ea-4909-b4a3-be2cb1c6ffa5`. Richiede stato `draft`, `publishedAt: null` e contenuto identico alla baseline, oppure già identico alla mappatura. Aggiorna i tre campi delle immagini e `updated_at` in una sola transazione. Preserva tutti gli altri campi della riga e di `settings`. Una modifica editoriale inattesa blocca tutto il lotto. Non inserisce articoli e non cambia gli stati di pubblicazione.

Gli snapshot e le ricevute vengono scritti in `snapshots/` con permessi riservati. La pagina pubblica `/f/pochi-minuti`, il suo contenuto e i suoi asset non rientrano nelle scritture.

Se cambia una sorgente editoriale, non aggirare il controllo dell’hash: confrontare la modifica con la baseline e preparare una nuova baseline revisionata. Se cambiano le scene generate, aggiornare le descrizioni in `IMAGE_MAPPING.json` dopo aver visto le immagini.
