# Allineamento al salto di categoria — 17 settembre 2026

Richiesta di Antonio: «allineamo tutto al Aiutalo a Fare il salto di categoria?».

## Messaggio pubblicato

**Aiutalo a fare il salto di categoria.**

Per affrontare un livello più alto, allena anche la mente. Con Metodo Sincro®, tuo figlio lavora su sicurezza, concentrazione e gestione della pressione con un coach dedicato, in un percorso individuale online.

**Azione: Prenota una consulenza gratuita.**

Il modulo chiarisce che il team richiama per capire come preparare il ragazzo al prossimo livello. Consulenza gratuita e percorso di coaching a pagamento sono distinti nelle FAQ e negli annunci.

## Landing

- URL: https://landing.metodosincro.com/f/salto-di-qualita
- Funnel: `bb4f12d9-4709-4ecf-9d1a-1a96c0960e46`.
- Commit pubblicato: `07cfd6e5`.
- Impostazioni attivate il 17 settembre 2026 alle 07:59:59, ora di Roma.
- Revisione: `salto-categoria-20260917`, tema `salto_categoria`.
- Coerenza estesa a titolo, sottotitolo, modulo, benefici, percorso, FAQ, blocco garanzia, CTA finale, barra mobile, popup e metadati della condivisione.
- I parametri di titolo e i vecchi angoli UTM non sovrascrivono più questo tema. Gli altri funnel mantengono il comportamento precedente.
- Modulo diretto conservato, test A/B spento. Nessun nuovo quiz.
- Video VTurb conservato. Il video non è stato rimontato né ne è stata verificata nuovamente la trascrizione: l’allineamento riguarda i testi della pagina e degli annunci.
- Nella revisione sono sostituite le promesse generiche dei 10/90 giorni con abilità concrete da allenare. La FAQ chiarisce il confine tra miglioramento mentale e decisioni sportive delle società.

## Inserzioni Meta

Campagna `120251721514160047`, gruppo `120251721514170047`.

| Inserzione esistente | Nuova creatività | Titolo |
|---|---|---|
| V01 — `120251721514180047` | `1137373622297606` | Aiutalo a fare il salto di categoria |
| V02 — `120251721835570047` | `1079202107844408` | Aiutalo a fare il salto di categoria |
| V03 — `120251721835580047` | `1095783009609984` | Aiutalo a fare il salto di categoria |
| V04 — `120251721835590047` | `4519716061642659` | Aiutalo a fare il salto di categoria |

Testi principali in `salto-categoria-annunci.json`. Ogni testo collega lo stesso obiettivo al tema del suo video; la descrizione richiama la consulenza gratuita.

Modifiche applicate tra le 08:00:58 e le 08:01:13, ora di Roma. Lettura API di verifica completata alle 08:01:14: tutti e quattro gli annunci configurati ACTIVE, stato effettivo IN_PROCESS (elaborazione Meta). Non equivale ad approvazione o erogazione già ripresa.

Conservati gli stessi ID inserzione, nomi, video, miniature, identità Facebook/Instagram, URL, UTM e pixel Lead `311586900940615`. Nessun nuovo annuncio, gruppo o campagna. Budget verificato invariato a 100 €/giorno; obiettivo e pubblico verificati invariati. Meta usa nuove creatività/post per l’aggiornamento del copy; gli ID precedenti sono conservati nel backup.

Disattivate le variazioni automatiche del testo (`text_optimizations`, `show_destination_blurbs`, `enhance_cta`) e verificato OPT_OUT nel risultato. Le altre funzioni individuali della creatività sono state mantenute. Meta ha rifiutato il vecchio campo aggregato `standard_enhancements` (errore 3858504), pertanto è stato omesso come richiesto dalla risposta API.

## Verifiche e limiti

- `npm run build`: compilazione, TypeScript e generazione pagine completati.
- Landing pubblica osservata a 390 px, 320 px e 1440 px. Modulo entro lo schermo; a 390 px il pulsante è nella prima schermata.
- Verificato il titolo anche con `utm_content=V02 | Talento e continuità`, parametro `ad_title` precedente e anteprima B: restano il messaggio categoria e il modulo diretto.
- Sul testo visibile non compaiono più “10 volte”, “soli 10 giorni”, “Trasformazione in 90 Giorni”.
- Questa verifica non include invii reali del modulo, notifica al team o nuovi risultati di conversione. Non dimostra che la mancata acquisizione fosse causata dalla sola landing.
- Non sono stati cambiati video, prezzi contrattuali o condizioni del servizio. Le condizioni della garanzia vengono rimandate alla proposta personalizzata.
- Modifica preesistente di `app/api/settings/route.ts` lasciata fuori dal commit.

Backup iniziale: `message-alignment-before.json`. Impostazioni finali: `message-alignment-landing-after.json`. Payload e riletture Meta: `message-alignment-ads-payloads.json`, `message-alignment-ads-state.json`.
