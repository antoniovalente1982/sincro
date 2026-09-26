# Verifica registrazioni Clarity — 17 settembre 2026

Controllo svolto intorno alle 11:22–11:25 Europe/Rome. Progetto `yjm4a7mui9`, filtro ultimi tre giorni, nessun altro filtro.

## Risultato osservato

L'elenco delle registrazioni concluse è passato da un risultato a due:

- 09:38, Chrome/PC, 2 minuti e 27 secondi: collaudo originale.
- 10:41, InstagramApp/Mobile, 32 secondi, una pagina, zero clic: visita con provenienza Instagram e parametri della campagna `120251644311030047`, distinta dai collaudi.

Il secondo replay è stato aperto e riprodotto: il lettore è avanzato fino a 00:11 su 00:32, con contenuto della landing presente e modulo oscurato. Collegamento riservato agli utenti del progetto: https://clarity.microsoft.com/player/yjm4a7mui9/1glml22/33jvvj/?ss=1789634464000&sd=32075

La visita delle 10:41 non era disponibile nel precedente controllo della mattina. Questo dimostra un ritardo nella disponibilità nell'elenco; non quantifica il tempo esatto di elaborazione e non spiega da solo tutte le visite prive di replay. Esiste ora una prova diretta di registrazione dal browser interno di Instagram; non è una verifica di tutti i browser o di Facebook.

## Prova controllata del consenso

Visitata la landing con `utm_source=collaudo&utm_medium=diagnostica&utm_campaign=clarity_20260917`:

1. Il consenso già presente nel browser caricava il tag del progetto e lo SDK Clarity 0.8.69.
2. Selezionato Rifiuta analisi e ricaricata la pagina: nessuno script Clarity, confermato anche dopo il caricamento completo.
3. Aperte le preferenze e controllato il layout a 390×844: entrambe le scelte visibili, nessun overflow orizzontale.
4. Selezionato Accetta analisi: tag e SDK caricati; il pannello Clarity ha mostrato le sessioni diagnostiche in Live recordings.
5. Chiuso il tab di prova e rimossa la dimensione temporanea del viewport. Ripristinato il consenso accettato presente all'inizio.

Le sessioni Chrome/PC delle 11:22–11:23 con la campagna UTM `clarity_20260917` sono prove tecniche. I cambi di consenso hanno prodotto tre identificativi mostrati fra le sessioni live: non rappresentano tre potenziali clienti. Non è stato compilato o inviato alcun modulo. Il layout mobile è stato provato su Chrome desktop, senza simulare un browser Instagram.

## Verifiche e limiti

- I tre test esistenti di `node --import tsx --test lib/landing-behavior.test.ts` sono passati.
- Nessuna modifica al codice di produzione o alle impostazioni del progetto. Il tag attende esplicitamente il consenso nella configurazione attuale.
- Le scelte di consenso dei visitatori precedenti non sono registrate nel database: non possiamo attribuire ogni replay mancante a un rifiuto o a un banner ignorato.
- Il confronto storico delle visite fino alle 11:15 resta in `clarity-traffic-check.json`; non comprende questi nuovi collaudi e non è stato sovrascritto.
- La sintassi del consenso usata nel codice corrisponde alla documentazione Microsoft: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2
