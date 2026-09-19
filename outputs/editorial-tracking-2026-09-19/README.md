# Tracciamento advertorial → landing → richiesta

Implementato il 19 settembre 2026. Migrazione database applicata; verifiche locali completate. Pubblicazione in corso di verifica.

## Cosa cambia

- Ogni articolo attuale e futuro usa il template comune: landing personalizzata, provenienza editoriale e pixel risolto automaticamente dalla connessione Meta dell’organizzazione.
- Advertorial e landing usano il pixel `311586900940615`. PageView distingue i due tipi di pagina; AdvertorialEngaged misura 30 secondi visibili più 50% dell’articolo; AdvertorialCTAClick identifica il passaggio. La landing conserva ViewContent, StartForm e Lead.
- Il server registra la richiesta soltanto dopo il salvataggio. Browser e CAPI condividono nome ed event ID; i retry della stessa richiesta riutilizzano l’ID.
- **Blog → Risultati** mostra visite, coinvolgimento, clic, arrivi, moduli iniziati, richieste e contatti distinti. Le percentuali seguono una coorte di visitatori per 30 giorni; provenienze senza visita osservata sono separate.
- La scheda contatto del CRM mostra il percorso disponibile prima della richiesta, anche per un contatto già esistente.
- Preferenze condivise fra articolo e landing, con analisi e marketing separati. Rifiuto e revoca fermano il tracciamento pertinente. La compilazione del modulo resta disponibile.

## Per i prossimi articoli

Crea e pubblica l’articolo nel Blog. Titolo, immagine e tema alimentano la landing personalizzata; i campi di “Landing collegata” permettono modifiche specifiche. Non occorre inserire il pixel, modificare codice o aggiungere ogni slug a una lista. Prima della pubblicazione si può usare l’anteprima, che è esclusa dal tracking.

## Verifiche

- 48 test automatici su dominio, consenso, identità, report, blog, landing e regressioni.
- TypeScript, lint mirato, build Next.js e controllo patch superati.
- [Sei scenari browser locali](BROWSER_CHECK.json): percorso completo con form simulato, retry dopo errore di rete, pixel lento, identità e ID eventi, rifiuto e analisi a 320 px, anteprime, revoca anche fra schede e interazione con Clarity.
- [Prova endpoint/database](SERVER_CHECK.json): ordine cronologico anche con richieste fuori ordine, deduplicazione, variante B, rifiuto di Lead pubblici e origini estranee, consenso e API protette. Dati tecnici di prova rimossi tramite UUID dedicato.
- Migrazione privata con RLS e vincoli verificati; revisione indipendente della specifica e della qualità approvata.

## Limiti della verifica

Gli invii browser e CAPI a Meta sono verificati tramite configurazione e simulazione, senza eventi reali o lead fittizi nelle automazioni commerciali. La ricezione e deduplicazione effettive in Gestione eventi Meta non sono ancora confermate. Il report raccoglie dati dall’attivazione: non ricostruisce visite storiche mancanti. Prima del modulo si osserva un browser, non il nome della persona; consenso, blocchi e dispositivi diversi possono interrompere il collegamento.

## Ripetere i controlli

`browser-check.mjs` richiede Playwright/Chromium. Si possono impostare `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `CHECK_ORIGIN` e `CHECK_LABEL`. Tutti gli endpoint di tracking e invio modulo sono intercettati; le destinazioni esterne sono bloccate. `server-check.mjs` usa il server locale su porta 3011 e `DATABASE_URL` da `.env.local`, salva soltanto telemetria tecnica con marketing disattivato e la rimuove in `finally`.
