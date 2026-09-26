# Metodo Sincro — diagnosi di ads, funnel e mancata acquisizione

17 settembre 2026. Dati Meta principali letti alle 14:15–14:17, ulteriori verifiche fino alle 14:38 circa, fuso Europe/Rome. Audit in sola lettura: nessuna campagna riattivata, nessun budget o contenuto di produzione modificato, nessun contatto di prova inviato. Trascrizione dei video eseguita localmente.

## Valutazione principale

**Non ho trovato prove di un blocco pubblicitario o di uno “shadowban” che spieghi il risultato. Ho trovato un sistema che raggiunge le persone, ma trasforma poche visite in richieste, con frizioni concrete e una misurazione insufficiente per attribuire una causa unica.**

Le ipotesi commerciali più solide da verificare sono: beneficio della prima telefonata poco tangibile, distanza fra promessa aspirazionale e problema immediato del genitore, inviti all’azione non uniformi nei video, selezione del pubblico basata su segnali deboli e poca varietà nel formato degli annunci. Sono ipotesi motivate dai contenuti, non cause dimostrate da un esperimento.

Antonio riferisce che la difficoltà economica dura da tempo, associandola al periodo successivo ad Andromeda, e che arrivava a malapena al pareggio. È un’informazione dichiarata, non un bilancio verificato. Quindi l’ultima pagina non può essere considerata da sola l’origine del problema storico.

## 1. Risultati verificati e significato economico

| Periodo / campagna | Spesa | Impression | Clic link | Visite landing Meta | Lead Meta |
|---|---:|---:|---:|---:|---:|
| 17 settembre, campagna precedente | 75,37 € | 11.007 | 78 | 56 | 0 |
| 17 settembre, campagna nuova genitori | 29,15 € | 4.040 | 25 | 20 | 0 |
| **17 settembre, totale** | **104,52 €** | **15.047** | **103** | **76** | **0** |
| 16–17 settembre, totale delle due | **156,93 €** | **23.732** | **181** | **127** | **0** |
| 12–13 settembre, campagna precedente | 151,51 € | 25.764 | 220 | 164 | 4 |

I numeri possono consolidarsi anche dopo lo spegnimento. Il precedente 100,38 € / 73 visite era lo snapshot delle 13:49, non un errore.

Le 127 visite non hanno tutte visto la pagina attuale: questa mattina sono cambiati modulo, testo, ordine degli elementi e video; il player attuale è stato pubblicato intorno alle 08:56 e Clarity attivato alle 09:36. Il totale misura il rendimento del percorso nel periodo, non un test isolato dell'ultima versione. Le modifiche ravvicinate impediscono di attribuire tutto il risultato al video ora online.

Le due campagne risultano PAUSED dalle 14:02:18 e 14:02:20. I tre gruppi risultano CAMPAIGN_PAUSED. Prima della pausa il budget nominale complessivo era 200 €/giorno: 100 € sulla nuova più due gruppi da 50 € sulla precedente.

Nel database della landing, dal 16 settembre, c’è solo l’invio delle 09:29 del titolare: nessun altro nuovo contatto salvato. Il problema quindi non è soltanto un contatore Lead vuoto in Meta. Il 12–13 settembre risultano quattro invii non corrispondenti alle email del titolare e senza evidenti marcatori di test: tre con UTM della campagna precedente, uno senza UTM. Non ho verificato qualità commerciale, appuntamenti o vendite di questi quattro.

Il tasso grezzo storico del 12–13 settembre è 4/164 = **2,44%**, costo 37,88 € per Lead Meta. Già non era un funnel ad alta conversione. Oggi una visita costa circa **1,38 €**. A parità di costo del traffico:

| Conversione visita → lead, ipotetica | Costo per lead atteso |
|---|---:|
| 1% | circa 138 € |
| 2% | circa 69 € |
| 5% | circa 28 € |
| 10% | circa 14 € |

Sono scenari aritmetici, non previsioni. Per tornare a un CPL di circa 15 € con questo traffico servirebbe una conversione vicina al 9%, oppure visite meno costose, oppure entrambe le cose. Cambiare un colore non è una strategia sufficiente per colmare una distanza simile.

Zero lead su 76 visite non prova da solo un guasto: con un tasso reale del 2%, un modello semplice darebbe circa il 22% di probabilità di osservarne zero. Su 127 visite sarebbe circa l’8%. Sono esempi orientativi: visite ripetute, pubblici e versioni diverse violano l’ipotesi di prove identiche e indipendenti. Il risultato richiede un intervento economico e diagnostico, senza inventare una certezza statistica.

## 2. Shadowban, restrizioni e qualità Meta

### Evidenze direttamente verificate

- API account: `account_status=1`, `disable_reason=0`; nessun limite totale di spesa configurato nel campo `spend_cap`.
- Pagina pubblicata: `is_published=true`.
- **Stato della Pagina Facebook, verificato direttamente:** “La Pagina non presenta problemi”, nessuna violazione degli Standard della community da mostrare, “Nessuna restrizione”, consigli attivi.
- **Raccomandazioni della stessa Pagina:** “Raccomandabile”. Meta conferma che la Pagina è inclusa nelle liste suggerite a persone nuove. Sono stati consultati i pannelli [Stato della Pagina](https://www.facebook.com/settings/?tab=profile_quality) e [Pagina consigliata](https://www.facebook.com/settings/?tab=profile_recommendations), nel profilo Antonio Valente “Mental Coach”.
- Nei sei annunci interrogati non sono state restituite segnalazioni nei campi `issues_info` / `ad_review_feedback`.
- Home assistenza business: l’account Antonio Valente Mental Coach Calciatori mostra **“Nessuna inserzione rifiutata”**.
- Dettaglio dello stesso account, filtro **ultimi 90 giorni**, tutte le campagne e tutte le violazioni: zero elementi disponibili per controllo, zero controlli in corso, zero ancora rifiutati; tabella vuota.
- Le campagne hanno effettivamente raggiunto oltre 15.000 impression oggi. Il dominio ha ricevuto visite e risponde HTTP 200, senza redirect, sia con richiesta ordinaria sia con user agent `facebookexternalhit/1.1`.

Questo rende **non supportata la tesi di un blocco pubblicitario generale o di una Pagina Facebook esclusa dalle raccomandazioni**. Non certifica l’assenza di ogni fattore di qualità o di ogni limitazione organica su Instagram, il cui stato specifico non è stato verificato. Il dettaglio feedback della Pagina nella Home assistenza business ha ricondotto alla panoramica; la successiva verifica diretta dalle impostazioni Facebook ha invece restituito i responsi sopra. Non esiste in questa analisi un test binario che certifichi “shadowban sì/no” per tutti i prodotti Meta.

### Esiste un segnale di qualità da prendere sul serio

Per il vecchio annuncio, il 12 settembre Meta restituisce `BELOW_AVERAGE_35` sia nella qualità sia nel ranking di conversione. Il 13 la qualità passa ad AVERAGE, mentre la conversione resta sotto la media. Oggi i valori sono UNKNOWN, non “penalizzato”. Il segnale storico è compatibile con un annuncio/esperienza che compete meno bene, **non equivale a un ban** e non identifica la ragione precisa.

I CPM osservati sono circa 6,85–7,22 € oggi, contro 5,56–6,58 € il 12–13: un peggioramento, ma nessun salto tale da dimostrare una sanzione. Le frequenze giornaliere attuali sono circa 1,22: non documentano saturazione intensa nello stesso giorno; non escludono stanchezza accumulata nel tempo.

Meta documenta che la qualità della destinazione può incidere sulla distribuzione. Questo principio generale non è una diagnosi della tua pagina: [fonte Meta sulle pagine di bassa qualità](https://about.fb.com/news/2017/05/reducing-links-to-low-quality-web-page-experiences/), pubblicata originariamente nel 2017. Nel controllo odierno non è comparso un avviso di destinazione bloccata.

### L’anomalia di erogazione resta distinta

La nuova campagna aveva quasi smesso di spendere dopo le 08:00, prima della pausa delle 14:02. L’ultima visita con la sua UTM nello snapshot era delle 08:18. Nel registro del mattino compaiono passaggi di revisione e approvazione degli annunci, oltre alla riattivazione della vecchia alle 06:57. Non ho trovato una motivazione ufficiale che spieghi l’intero intervallo di mancata erogazione della nuova. Revisione, riallocazione e apprendimento restano spiegazioni possibili, non dimostrate.

Il nome tecnico di un elemento di sistema contiene `shadow`: è un nome nel registro di erogazione, **non una segnalazione di shadowban**.

## 3. Andromeda e confronto con il passato

Andromeda è il sistema di selezione preliminare degli annunci descritto da Meta il 2 dicembre 2024. Personalizza quali candidati passano alle fasi successive. Non è descritto come una penalizzazione delle pagine di coaching. La documentazione non dimostra che abbia causato il calo di questo account. Non disponiamo qui di un confronto controllato prima/dopo la sua introduzione. [Meta Engineering](https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/).

La mia indicazione pratica è testare messaggi e prove realmente differenti, con segnali di conversione affidabili, invece di trattare ogni interesse come un pubblico di compratori. Non è una regola ufficiale che richieda decine di nuovi video o maggiore spesa.

Lo storico recente dell’account mostra:

| Mese 2026 | Spesa totale account | Lead Meta aggregati | Rapporto grezzo spesa/lead |
|---|---:|---:|---:|
| Giugno | 4.264,20 € | 293 | 14,55 € |
| Luglio | 841,27 € | 16 | 52,58 € |
| Settembre, fino allo snapshot | 308,50 € | 4 | 77,13 € |

**Questa tabella non è una serie omogenea di CPL per contatti validi.** Comprende campagne diverse, anche e-commerce e tennis. Agosto non restituisce righe di erogazione nella query effettuata.

La campagna storica “Quiz — modulo interattivo” usa `destination_type=ON_AD` e ottimizzazione LEAD_GENERATION. Nel periodo giugno–luglio ha 2.636,62 € di spesa e 224 eventi Lead aggregati: Meta li articola in 123 lead interni e 101 eventi web. Senza riconciliazione dei contatti non possiamo considerarli automaticamente 224 persone diverse o qualificate. È quindi sbagliato usare il 14,55 € di giugno come prova che l’attuale landing debba produrre gli stessi risultati.

Il confronto web più pertinente è luglio: “sport x angolo” 436,70 € / 323 visite / 5 Lead; “sport 6/07 CBO” 404,57 € / 932 visite / 11 Lead. Il totale è **16 Lead su 1.255 visite, circa 1,27%**, con costo 52,58 €. Le landing e le offerte di allora non sono state ricostruite integralmente: il dato mostra che una difficoltà nel trasformare traffico web in richieste era già presente.

## 4. Annunci e pubblico

### La configurazione cerca Lead, ma non garantisce compratori

Le campagne attuali ottimizzano OFFSITE_CONVERSIONS / LEAD sul pixel `311586900940615`, coerente con landing e connessione server. Non ho trovato un errore del tipo “campagna clic anziché lead” o un pixel diverso.

Il gruppo “imprenditori / lusso / calcio” incrocia interessi e ruoli aziendali, lusso/viaggi e calcio. Non impone il segnale genitore. Amare Ferrari o gestire un’impresa non dimostra avere un figlio calciatore né voler acquistare coaching. Gli altri gruppi usano genitori + calcio: più coerenti, ma ancora segnali indiretti. È il messaggio a dover qualificare situazione, destinatario e disponibilità al percorso.

Ci sono sovrapposizioni possibili fra le aree geografiche e le fasce di età dei gruppi. Non ho una misura di sovrapposizione effettiva né una prova di “aste contro se stessi”. Il problema certo è che tre gruppi e due campagne dividevano la spesa mentre mancavano conversioni da interpretare.

### Quattro video, una struttura molto simile

Ho scaricato e trascritto l’audio dei quattro video realmente associati agli annunci nuovi. Durate 78–96 secondi. Tutti usano sostanzialmente: problema → tre consigli → terzo consiglio enfatizzato → consulenza alla fine. Gli argomenti cambiano, il modo di persuadere cambia poco. Sono contenuti educativi utili; il loro valore come annunci di acquisizione va verificato.

| Annuncio, 16–17 settembre | Spesa | Clic | Visite landing | Lead |
|---|---:|---:|---:|---:|
| V01 — tre capacità mentali | 10,99 € | 7 | 3 | 0 |
| V02 — talento e continuità | 4,85 € | 4 | 2 | 0 |
| V03 — salto di categoria | 52,80 € | 76 | 55 | 0 |
| V04 — prima della partita | 12,92 € | 16 | 11 | 0 |

V03 porta circa il 77% delle visite della campagna nuova, assorbendo circa il 65% della spesa: è il miglior generatore di visite del gruppo, **non un vincitore commerciale**. Gli altri hanno campioni troppo piccoli per una condanna definitiva.

Per V03 Meta conta 7.069 avvii video, 498 raggiungimenti del 25% e 83 completamenti. Il 25% di un video da 90 secondi è circa 22,5 secondi. Il rapporto fra eventi indica che una piccola parte degli avvii arriva al messaggio finale; non è una misura di visitatori unici o della retention della VSL. Le trasformazioni automatiche delle creatività possono inoltre produrre formati diversi, e il registro ne mostra alcuni.

### Incoerenze verificabili nel percorso

- **V01** invita a “rispondere alle brevi domande”. La pagina attuale chiede subito nome/cognome, telefono ed email; il vecchio modulo a passaggi è spento.
- **V02** nell’audio indica `www.metodosincro.it`. Il pulsante pubblicitario conduce a `landing.metodosincro.com/f/salto-di-qualita`. Chi segue l’istruzione parlata può imboccare un percorso diverso, la cui conversione non è misurata qui.
- **V03** parla di un figlio già titolare che affronta una nuova squadra e forse meno minuti. È un caso preciso. La landing allarga immediatamente a “fare il salto di categoria”: continuità tematica presente, ma meno continuità sulla situazione concreta.
- **V04** aggancia tensione prima della partita. L’arrivo sulla promessa di salto di categoria può sembrare una risposta a un obiettivo diverso dal problema che ha fatto cliccare.
- Il vecchio annuncio, che ha generato la maggior parte del traffico odierno, dura **152,5 secondi**. Il suo testo è “Aiutalo a fare finalmente il salto di categoria, lavorando sulla Mentalità”. Non ho recuperato l’audio di questo specifico asset: non attribuisco ad esso le trascrizioni dei quattro nuovi.

Nel dettaglio posizionamenti, il vecchio annuncio su Instagram Reels ha speso circa 13,35 € per tre visite, mentre Facebook Feed circa 21,77 € per 31. È una pista per controllare adattamento del formato e costo del traffico; con zero lead e pochi eventi non dimostra che un posizionamento sia commercialmente migliore.

## 5. Landing, video e leve psicologiche

### Cosa funziona già

È chiaro che si tratta di mental coaching individuale online; esistono CTA ripetute, durata orientativa della prima telefonata, riferimenti a professionisti, spiegazione del percorso e FAQ che chiarisce che un ingaggio o una promozione non sono garantiti. Il form è raggiungibile senza essere obbligati a finire il video. Il video prima del modulo su mobile è una preferenza esplicita di Antonio: non è stato invertito durante l’audit.

### Il beneficio della telefonata rimane debole

“Consulenza gratuita” descrive il prezzo e il formato; “capiamo se il percorso è adatto” descrive soprattutto il processo commerciale. Un genitore freddo deve lasciare telefono ed email senza sapere con sufficiente concretezza cosa saprà o potrà fare dopo quella telefonata.

**Ipotesi:** il costo percepito è essere richiamato e affrontare una vendita, mentre il beneficio immediato appare generico. “Senza impegno” e “massimo 15 minuti” aiutano, ma non sostituiscono un risultato utile. Proposta da definire con il team: una prima valutazione con situazione attuale, priorità su cui lavorare e spiegazione del passo successivo. Va promessa solo se realmente erogata, senza trasformarla in una diagnosi clinica.

### Aspirazione e problema urgente sono su livelli diversi

“Salto di categoria” può attrarre, ma alcuni genitori vogliono anzitutto che il figlio non si blocchi dopo un errore, torni ad affrontare la partita o riesca a parlare dopo una panchina. Le recensioni analizzate in AV Brain documentano questi temi. Non sono un campione rappresentativo di tutti i visitatori e non dimostrano che ogni famiglia abbia la stessa motivazione.

La leva da testare è **riconoscimento della propria situazione → cambiamento osservabile → aiuto specifico**. L’ambizione può restare, collegata a un problema sul quale il coaching può lavorare. Evitare di far sentire il genitore accusato o di suggerire che il percorso compri un posto in squadra.

### Autorità presente, identificazione meno sviluppata

I professionisti e i club costruiscono credibilità. Non rispondono da soli a “funzionerà con un ragazzo come il mio?” o “mio figlio accetterà di parlare con il coach?”. Un caso documentato di una famiglia nella stessa situazione, con prima/dopo circostanziato e limiti espliciti, può colmare questo passaggio. È un’ipotesi da provare, non una promessa di conversioni.

Nella landing i badge Trustpilot e le quattro recensioni sono testo statico; nel DOM prima della conferma non risultano link esterni, neppure ai singoli originali. Le quattro testimonianze mostrate non sono state riconciliate con le fonti originali in questo audit: **non le dichiaro false, ma non posso confermarne le attribuzioni, le età e il marchio “Verificata”**. Prima di usarle come prova principale occorre verificarle e renderle consultabili. I numeri 356 / oltre 360 tra pagina e video vanno aggiornati da un’unica fonte.

### Video della landing: il punto forte arriva tardi

Ho trascritto l’audio del player attualmente pubblicato, non una vecchia bozza locale. Parlato fino a circa **3:26**:

| Tempo approssimativo | Contenuto | Lettura di conversione |
|---|---|---|
| 0:00–1:00 | Salto di categoria, fare cose diverse, citazione, 90%, metafora Panda/Mercedes/Ferrari | Occupa il primo minuto prima della situazione più riconoscibile |
| 1:06–1:30 | Potenziale, alti e bassi, blocco, delusione | È una parte più concreta per l’identificazione del genitore |
| 1:30–2:30 | Interferenze, allenatore, errore, concorrenza | Spiega il meccanismo, con ripetizioni che possono essere ridotte |
| 2:33 circa | Miglioramenti subito e grandi cambiamenti nel primo mese | Affermazioni più assolute del testo prudente della pagina; verificare e qualificare |
| 2:54 circa | Invito a cercare recensioni su Google | Può interrompere il percorso; meglio prova verificabile disponibile accanto |
| **3:10** | Invito a completare il modulo e farsi contattare | Il prossimo passo arriva molto tardi per chi non ha ancora deciso di restare |

La trascrizione automatica contiene errori di nomi e alcune parole: è un supporto di analisi, non testo da ripubblicare. La frase sul “90%” non ha una fonte verificata in questo controllo. Le promesse di miglioramento immediato non diventano dimostrate perché pronunciate nel video.

Non ho una curva VTurb di visualizzazione dei visitatori reali: non posso dire quante persone abbandonino al secondo 20 o che la durata sia la causa unica. Raccomando di testare un’apertura più concreta e di spiegare il beneficio della telefonata entro i primi 20–30 secondi, mantenendo approfondimento e pulsante disponibile. Non serve imporre la visione completa.

### Frizione del modulo e fiducia

- Nome e cognome nello stesso campo, telefono ed email sono tutti obbligatori; età opzionale.
- Compare un errore già mentre si scrive il solo nome, prima di aggiungere il cognome. Si può validare al termine del campo invece di interrompere la compilazione.
- I campi non hanno attributi espliciti `name` / `autocomplete`; il browser può comunque usare euristiche, ma l’esperienza di compilazione automatica non è ben specificata.
- Il contenitore non è un elemento HTML `form`: il clic è gestito da React, senza il comportamento standard di invio da tastiera.
- “Prenota” conduce a una richiesta di richiamata, non alla scelta di un appuntamento. La pagina lo spiega, ma il verbo crea un’aspettativa leggermente diversa.
- Nel percorso precedente all’invio non ho trovato un link visibile all’informativa sui dati: il lucchetto e “zero spam” non spiegano chi richiama e come usa i recapiti. È una lacuna di trasparenza percepibile, non una spiegazione già dimostrata dell’abbandono.

Test utile: rendere l’email facoltativa se il primo contatto viene realmente gestito per telefono, spiegare con precisione la richiamata e usare prove verificabili vicino al modulo. Misurare anche reperibilità e qualità: più moduli non significa automaticamente più vendite.

## 6. Verifica tecnica e misurazione

### Verificato

- Landing pubblica raggiungibile, HTML HTTP 200 senza redirect. Due richieste di laboratorio: circa 0,69 s e 0,48 s al primo byte. **Non sono un test su rete mobile né una misura del caricamento completo.**
- Player e flusso audio disponibili; nel browser il player mostra il pannello di ripresa. Ci sono avvisi cross-origin del player, che da soli non dimostrano un blocco di riproduzione.
- Clic sul modulo vuoto verificato nel browser: compaiono gli errori nome/cognome, telefono ed email. Nessun invio eseguito.
- L’invio del titolare delle 09:29 è arrivato nel CRM ed è stato accettato come evento server. Dimostra che la catena può funzionare, non che funzioni su tutti i dispositivi.
- Nel controllo precedente della mattina la pagina era stata osservata a 390×844 senza overflow e con entrambe le scelte Clarity visibili. In questo turno l’override mobile non è stato applicato correttamente dal browser: le nuove prove visive sono desktop. Non dichiaro un collaudo iPhone/Android/Instagram completo.

### Difetto di osservabilità concreto

In `lib/useMetaTracking.ts`, `fireStartForm()` termina immediatamente se manca `window.fbq`. Di conseguenza non parte nemmeno la richiesta server che dovrebbe accompagnare l’evento. Il componente segna inoltre il primo focus come già eseguito prima di chiamare la funzione: se l’evento non parte, non ritenta ai focus successivi.

Questo può sottocontare chi comincia il modulo. Non dimostra che sia successo alle visite odierne, e **non blocca di per sé il salvataggio del Lead**. È però il motivo per cui non bisogna concludere “nessuno compila” dal solo StartForm.

Gli eventi di form Clarity dipendono dal consenso; il database delle visite non registra attualmente tutta la sequenza form visto → primo focus → tentativo → errore → invio accettato con attribuzione omogenea. Mancano dati affidabili per distinguere disinteresse, abbandono e problemi di compilazione.

### Clarity non è il contatore del traffico

È stato attivato alle 09:36 e nel sito parte solo dopo “Accetta analisi”. La sola registrazione desktop iniziale era un collaudo; è poi comparsa una visita Instagram reale delle 10:41, 32 secondi. Questo esclude l’ipotesi che Instagram non possa mai essere registrato, ma non quantifica la copertura.

Il file `clarity-traffic-check.json` è una fotografia delle 11:15 relativa al periodo successivo alle 09:36; non rappresenta tutta la giornata. I suoi zero invii escludono correttamente l’invio del titolare delle 09:29. Nessuna incoerenza del database è necessaria per spiegare i due conteggi.

## 7. Cosa fare prima di investire di nuovo

| Priorità | Intervento proposto | Perché | Verifica necessaria |
|---|---|---|---|
| 1 | Rendere affidabili focus, tentativi, errori e invii; separare i collaudi | Ora non sappiamo dove si interrompe il percorso | Un test controllato per browser porta alla stessa catena di eventi e a un solo contatto |
| 1 | Collaudo completo su iPhone/Android e browser interni | Il test desktop non copre la maggioranza delle visite | Invio, conferma, CRM, assegnazione, evento e richiamata verificati |
| 1 | Uniformare la CTA parlata, il pulsante e la destinazione | V01 e V02 hanno discrepanze osservabili | Ogni annuncio promette esattamente ciò che appare dopo il clic |
| 1 | Definire il risultato utile della prima telefonata | “Gratis” da solo non giustifica il contatto | Il team conferma un contenuto erogabile e lo usa nella call |
| 2 | Portare il problema concreto all’inizio del video e una prova pertinente vicino al modulo | Aumentare riconoscimento e fiducia prima della richiesta | Confronto su richieste valide, non soltanto visualizzazioni video |
| 2 | Verificare recensioni e rendere chiare richiamata e uso dei dati | Ridurre dubbi evitabili | Ogni prova è rintracciabile; nessuna promessa ambigua |
| 2 | Ridurre frizione di compilazione | Tre recapiti/identificativi obbligatori possono ostacolare | Tasso di completamento insieme a reperibilità e qualità |
| 3 | Confrontare modulo interno Meta e landing con un messaggio coerente | Isolare il costo dell’uscita dall’app | Costo per contatto valido, call svolta e cliente, con deduplicazione |

Il test a pagamento va preparato come confronto limitato e controllato, con un tetto totale concordato, non come ritorno automatico ai 200 €/giorno. Con poco traffico, evitare contemporaneamente nuove campagne, pubblici, video e pagine: diventerebbe impossibile capire quale cambio abbia funzionato.

Tre direzioni creative da confrontare, senza moltiplicare variazioni superficiali:

1. **Situazione concreta:** comportamento dopo un errore o una panchina, cosa può allenare e cosa ottiene il genitore nella prima valutazione.
2. **Caso documentato:** famiglia con età/contesto pertinente, problema iniziale, lavoro svolto, cambiamento osservato e limiti; solo materiale verificato e utilizzabile.
3. **Obiezione reale:** come presentare il coaching a un figlio poco convinto, mostrando il lavoro pratico senza svalutare altre professioni.

Il salto di categoria può restare una direzione aspirazionale; non dovrebbe essere l’unico motivo per cui lasciare oggi il numero di telefono.

## 8. Sostenibilità: il numero che manca

Serve il tasso **contatto valido → cliente pagante**, insieme al costo completo di erogazione e vendita. Il tasso dichiarato per segnalazioni da procuratori non è trasferibile ai lead freddi Meta.

Una regola di pianificazione è: **CPL massimo = CAC obiettivo × probabilità di vendita per lead**. Il CAC obiettivo deve lasciare il margine desiderato dopo coach, commerciale, gestione, fissi allocati e altri costi. Il prezzo del percorso da solo non basta a stabilirlo. Valore contrattualizzato, incassi e utile vanno tenuti distinti.

Un modulo interno che riporta tanti nominativi poco interessati può peggiorare il pareggio: per questo la prova deve misurare persone raggiungibili, appuntamenti svolti e vendite. La pausa attuale consente di correggere la diagnosi senza comprare altro traffico nel frattempo.

## Fonti e limiti

- `deep-audit-data.json`: Meta account, campagne, ranking, gruppi, posizionamenti, demografia, creatività e configurazione landing.
- `performance-2026-09-17T12-14-57.556Z.json`: stato dopo pausa e visite/database aggregati.
- `deep-audit-followup.json`: storico mensile, registro del 17 settembre, metadati video e invii classificati senza recapiti.
- `deep-audit-history-june-july.json` e `deep-audit-old-assets.json`: distinzione campagne storiche, modulo interno e durata vecchio video.
- `vsl-current-words.txt` e quattro file `ad-…-words.txt`: trascrizioni automatiche dell’audio effettivo, con intervalli da 15 secondi.
- Browser: landing in anteprima A, validazione vuota, Home assistenza business e dettaglio account ultimi 90 giorni; stato e idoneità alle raccomandazioni della Pagina Facebook. Nessuna richiesta di revisione inviata. Riscontri sintetici in `verifica-stato-pagina.json`.
- Codice: `app/f/[slug]/MetodoSincroLandingV2.tsx`, `lib/useMetaTracking.ts`, `app/api/submit/route.ts`, `components/LandingBehaviorAnalytics.tsx`.
- AV Brain: [[casi-studio-recensioni]], [[risultati-e-casi-di-successo]], [[percorso-mental-coaching]]; mandato acquisizione aggiornato sul target il 7 settembre. L’analisi delle recensioni è qualitativa, non una misura rappresentativa del mercato.
- Fonti Meta ufficiali citate nelle sezioni restrizioni e Andromeda. Nessuna diagnosi ricavata da forum o da venditori di account “antiban”.

Non verificati: ricavi e vendite attribuibili alle campagne storiche; curva di retention VTurb; invio completo su dispositivi mobili reali; idoneità organica Instagram; causa ufficiale della scarsa erogazione della nuova campagna dopo le 08:00. Queste lacune limitano una spiegazione causale definitiva, ma non impediscono di correggere le discrepanze osservate e preparare un test informativo.
