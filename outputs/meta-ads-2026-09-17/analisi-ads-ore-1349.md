# Metodo Sincro — verifica Ads del 17 settembre, ore 13:49

## Risultato verificato

Snapshot principale API alle 13:49:14 Europe/Rome, periodo **solo 17 settembre 2026**. Le due campagne attive hanno speso complessivamente **100,38 €**, con **97 clic sul link, 73 visualizzazioni della landing e zero eventi Lead attribuiti da Meta**. Costo medio per visualizzazione: **1,38 €**. Non sono 73 visitatori unici verificati.

| Campagna | Spesa oggi | Clic link | Visualizzazioni landing | Lead Meta |
|---|---:|---:|---:|---:|
| Nuova Campagna Settembre 2026 | 71,43 € | 72 | 53 | 0 |
| MS / Genitori 40–60 / Nord+Lazio / 16.09 | 28,95 € | 25 | 20 | 0 |
| Totale | 100,38 € | 97 | 73 | 0 |

Le letture successive possono aumentare: alle 13:51 la prima campagna risultava a 72,30 €. La tabella del browser ancora caricata mostrava 99,79 € complessivi, coerente con uno snapshot precedente; non è stato usato per sovrascrivere quello API.

Dal 16 settembre, le stesse due campagne totalizzano 152,77 € e 124 visualizzazioni della landing nello snapshot delle 13:49. Il totale giornaliero non va confuso con quello cumulato.

## Invii e verifica tecnica

La query corrente restituisce un invio della landing alle **09:29:22 del 17 settembre**, intestato ad **Antonio Valente**, con un indirizzo email corrispondente al titolare. Non va contato come nuovo potenziale cliente. Nessun altro invio nel periodo dal 16 settembre.

Il record ha una corrispondenza nel CRM, è assegnato e un evento Lead server è stato accettato dal provider alle 09:29:23. Questo dimostra che la catena invio → salvataggio → CRM → invio evento può funzionare; non verifica ogni browser mobile né l'attribuzione dell'evento a una campagna. La provenienza UTM è incompleta e il CRM lo etichetta Organico: questa classificazione non dimostra l'origine reale.

Il precedente snapshot `clarity-traffic-check.json` conta gli invii solo dalle 09:36:45: esclude quindi correttamente questo invio delle 09:29. La differenza dipende dalla finestra temporale, non dimostra una modifica dei dati.

Nei log dell'intera organizzazione risultano tre StartForm il 17 settembre UTC, l'ultimo alle 09:29:18 italiane. Questi eventi non hanno attribuzione sufficiente per assegnarli tutti alle due campagne. Da dopo le 09:29 non risultano nuovi StartForm in questa lettura: è un segnale da indagare sul passaggio visita → avvio modulo, non una prova autonoma di abbandono o di errore.

## Budget ed erogazione

- Campagna MS / Genitori: budget di campagna **100 €/giorno**.
- Campagna precedente: due gruppi attivi da **50 €/giorno ciascuno**.
- Totale nominale configurato: **200 €/giorno**; non è il totale già speso né una previsione esatta di spesa odierna.
- Entrambe ottimizzano per Lead sul pixel `311586900940615`, non semplicemente per clic.
- Campagna nuova, relativo gruppo e quattro annunci risultano ACTIVE; nessuna issue restituita dalle letture. Il gruppo risulta LEARNING, con zero conversioni.
- Nonostante lo stato ACTIVE, il dettaglio orario della nuova campagna registra solo **0,17 € nell'ora 08:00–08:59** e nessuna spesa successiva nello snapshot. Ultima pageview con la sua UTM alle 08:18. Dalle 09:00 il traffico pubblicitario rilevato proviene dalla campagna precedente. La causa della mancata erogazione della nuova non è dimostrata: non attribuirla automaticamente a revisione, budget, targeting o a un errore.

## Interpretazione

Il traffico raggiunge la pagina e nessun nuovo contatto risulta salvato. Il passaggio da visita a richiesta è quindi la priorità di diagnosi. Il risultato non permette di scegliere una causa unica fra qualità/intento del pubblico, proposta, frizione o errori su particolari dispositivi.

Il rapporto tra 73 visualizzazioni e 97 clic è circa 75%; non prova che 24 persone siano state perse per lentezza. Sono conteggi di eventi con regole di attribuzione differenti.

La landing è cambiata più volte: modulo diretto alle 07:29, testi alle 08:00, ordine video/modulo alle 08:15, nuovo player alle 08:56, Clarity alle 09:36. Dopo il nuovo video risultano **41 pageview con UTM della campagna precedente, 40 identificativi browser distinti**, oltre a visite senza UTM e collaudi separati. La campagna nuova non ha portato nuove pageview attribuite alla propria UTM dopo quel cambio. Non è corretto attribuire tutta la spesa di oggi all'ultima versione della pagina o dichiararla statisticamente fallita.

La vecchia campagna aveva prodotto **4 Lead attribuiti da Meta su 151,51 €** il 12–13 settembre (37,88 €/Lead attribuito). Qualità e autenticità commerciale di quei quattro contatti non sono state verificate in questo controllo. È uno storico utile, non una garanzia del costo futuro.

## Decisione proposta

Non aumentare il budget e non aggiungere campagne o creatività mentre manca una diagnosi affidabile del passaggio al modulo. Propongo una pausa tecnica delle **due campagne indicate**, per contenere ulteriore spesa durante una verifica completa da mobile e della misurazione degli avvii/errori del modulo; successivamente ripartire con un solo test e un limite di spesa concordato. La pausa è una scelta di controllo della spesa, non una conclusione statistica che le Ads non funzionino.

Se si mantiene l'erogazione, evitare ulteriori cambi simultanei: rendere identificabile una sola revisione e giudicarla su nuove richieste valide, senza includere i collaudi. Un limite numerico sostenibile richiede un costo per lead qualificato e un tasso di chiusura verificati, oggi mancanti.

**Nessuna campagna, budget, creatività, pubblico o landing è stata modificata durante questa analisi.**

## Fonti

- `performance-2026-09-17T11-49-14.155Z.json`: snapshot Meta e aggregati database.
- `performance-followup.json`: verifica invio/CRM e storico campagna precedente, 13:51.
- `read-performance-latest.mjs` e `read-performance-followup.mjs`: interrogazioni in sola lettura; nessun invio evento o contatto.
- `ripristino-consulenza.md`, `allineamento-salto-categoria.md`, `video-prima-del-modulo.md`, `nuovo-video-landing.md`: cronologia delle revisioni.
- `clarity-verifica-replay.md`: prova della ricezione di una visita Instagram e limiti del campione.
- AV Brain: [[percorso-mental-coaching]] e mandato acquisizione del 5 settembre, aggiornato sul target il 7 settembre. I costi coach e le percentuali commerciali non consentono da soli di stimare un CPL o CAC sostenibile.

Nota di lettura API: `offsite_content_view_add_meta_leads` è una metrica aggregata che include visualizzazioni di contenuto; non va interpretata come numero di Lead. Usati i tipi effettivi `lead` e `offsite_conversion.fb_pixel_lead`, senza sommare rappresentazioni multiple della stessa conversione.
